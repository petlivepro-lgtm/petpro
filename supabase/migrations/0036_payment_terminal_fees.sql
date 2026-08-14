-- =====================================================================
-- Maquininhas de cartão e suas taxas por forma de pagamento.
--
-- Cada petshop cadastra suas maquininhas (adquirentes) e, para cada uma,
-- quanto a operadora retém por forma de pagamento — no crédito, por faixa
-- de parcelas. A receita nasce com a taxa já calculada e congelada, para
-- que a gestão leia o líquido real e o histórico não mude quando o petshop
-- renegociar a taxa depois.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Maquininhas
-- ---------------------------------------------------------------------
create table payment_terminal (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 2 and 60),
  active      boolean not null default true,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

create index payment_terminal_tenant_idx on payment_terminal (tenant_id, name);
create unique index payment_terminal_name_uniq
  on payment_terminal (tenant_id, lower(btrim(name)));
-- No máximo uma padrão por petshop (a que já vem escolhida na venda).
create unique index payment_terminal_default_uniq
  on payment_terminal (tenant_id) where is_default;

/**
 * Mantém a exclusividade da maquininha padrão sem exigir dois saves do app:
 * marcar uma como padrão desmarca a anterior. A primeira maquininha do
 * petshop já entra como padrão, e desativar uma tira o posto dela.
 */
create or replace function payment_terminal_sync_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not new.active then
    new.is_default := false;
  elsif tg_op = 'INSERT' and not exists (
    select 1 from payment_terminal where tenant_id = new.tenant_id
  ) then
    new.is_default := true;
  end if;

  if new.is_default then
    update payment_terminal
    set is_default = false
    where tenant_id = new.tenant_id and id <> new.id and is_default;
  end if;

  return new;
end;
$$;

create trigger payment_terminal_default_sync
  before insert or update of is_default, active on payment_terminal
  for each row execute function payment_terminal_sync_default();

-- ---------------------------------------------------------------------
-- Taxas: uma linha por forma de pagamento (crédito, por faixa de parcelas)
-- ---------------------------------------------------------------------
create table payment_fee_rule (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenant(id) on delete cascade,
  terminal_id        uuid not null references payment_terminal(id) on delete cascade,
  payment_method     payment_method not null,
  installments_from  smallint not null default 1 check (installments_from between 1 and 24),
  installments_to    smallint not null default 1 check (installments_to between 1 and 24),
  -- Percentual retido pela operadora (ex.: 4.990 = 4,99%).
  fee_percent        numeric(6,3) not null default 0 check (fee_percent >= 0 and fee_percent <= 100),
  -- Tarifa fixa por transação, quando a operadora cobra além do percentual.
  fee_fixed_cents    integer not null default 0 check (fee_fixed_cents >= 0),
  -- Dias até o dinheiro cair na conta (D+0, D+1, D+30...).
  settlement_days    smallint not null default 0 check (settlement_days between 0 and 365),
  created_at         timestamptz not null default now(),
  check (installments_to >= installments_from),
  -- Só o crédito parcela; nas demais formas a faixa é sempre 1x.
  check (payment_method = 'CREDIT_CARD' or (installments_from = 1 and installments_to = 1))
);

create index payment_fee_rule_tenant_idx on payment_fee_rule (tenant_id);
create unique index payment_fee_rule_range_uniq
  on payment_fee_rule (terminal_id, payment_method, installments_from);

alter table payment_terminal enable row level security;
alter table payment_fee_rule enable row level security;

-- Todo staff enxerga (a venda precisa listar as maquininhas); só quem mexe em
-- dinheiro edita — mesmo recorte de can_manage_finance usado em 0026.
create policy payment_terminal_staff_read on payment_terminal for select
  using (is_staff(tenant_id));
create policy payment_terminal_manage on payment_terminal for all
  using (can_manage_finance(tenant_id)) with check (can_manage_finance(tenant_id));

create policy payment_fee_rule_staff_read on payment_fee_rule for select
  using (is_staff(tenant_id));
create policy payment_fee_rule_manage on payment_fee_rule for all
  using (can_manage_finance(tenant_id)) with check (can_manage_finance(tenant_id));

-- ---------------------------------------------------------------------
-- Onde a maquininha é escolhida: venda de balcão, reserva e atendimento
-- ---------------------------------------------------------------------
alter table appointment
  add column terminal_id uuid references payment_terminal(id) on delete set null,
  add column installments smallint not null default 1 check (installments between 1 and 24);

alter table appointment
  add constraint appointment_installments_credit_only
  check (installments = 1 or payment_method = 'CREDIT_CARD');

alter table product_reservation
  add column terminal_id uuid references payment_terminal(id) on delete set null,
  add column installments smallint not null default 1 check (installments between 1 and 24);

alter table product_reservation
  add constraint reservation_installments_credit_only
  check (installments = 1 or payment_method = 'CREDIT_CARD');

-- ---------------------------------------------------------------------
-- Receita com taxa congelada
--
-- terminal_name é snapshot: a taxa de uma venda antiga continua legível
-- mesmo que a maquininha seja excluída do cadastro depois.
-- ---------------------------------------------------------------------
alter table finance_entry
  add column terminal_id uuid references payment_terminal(id) on delete set null,
  add column terminal_name text,
  add column installments smallint not null default 1 check (installments between 1 and 24),
  add column fee_percent numeric(6,3) not null default 0 check (fee_percent >= 0),
  add column fee_fixed_cents integer not null default 0 check (fee_fixed_cents >= 0),
  add column fee_cents integer not null default 0 check (fee_cents >= 0),
  add column settlement_date date;

alter table finance_entry
  add constraint finance_entry_installments_credit_only
  check (installments = 1 or payment_method = 'CREDIT_CARD');

-- Líquido derivado: nunca sai de sincronia com bruto e taxa.
alter table finance_entry
  add column net_amount_cents integer
  generated always as (amount_cents - fee_cents) stored;

create index finance_entry_terminal_idx on finance_entry (tenant_id, terminal_id);
create index finance_entry_settlement_idx on finance_entry (tenant_id, settlement_date);

/**
 * Formas que passam pela maquininha. Só elas herdam a maquininha padrão
 * quando a venda não escolhe uma explicitamente — dinheiro e transferência
 * não têm adquirente e ficariam com um vínculo enganoso.
 */
create or replace function payment_method_uses_terminal(p_method payment_method)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_method in ('DEBIT_CARD', 'CREDIT_CARD', 'PIX');
$$;

/**
 * Resolve a taxa de uma cobrança: acha a maquininha (a informada ou a padrão),
 * a regra da forma de pagamento/faixa de parcelas, e devolve quanto a operadora
 * retém. Sem maquininha ou sem regra cadastrada, a taxa é zero — o petshop que
 * ainda não configurou nada continua operando normalmente.
 */
create or replace function resolve_payment_fee(
  p_tenant_id uuid,
  p_terminal_id uuid,
  p_method payment_method,
  p_installments int,
  p_amount_cents int,
  out o_terminal_id uuid,
  out o_terminal_name text,
  out o_fee_percent numeric,
  out o_fee_fixed_cents int,
  out o_fee_cents int,
  out o_settlement_days int
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rule payment_fee_rule%rowtype;
  v_amount int := greatest(coalesce(p_amount_cents, 0), 0);
  v_installments int := greatest(coalesce(p_installments, 1), 1);
begin
  o_terminal_id := p_terminal_id;
  o_terminal_name := null;
  o_fee_percent := 0;
  o_fee_fixed_cents := 0;
  o_fee_cents := 0;
  o_settlement_days := 0;

  if p_method is null then
    o_terminal_id := null;
    return;
  end if;

  if o_terminal_id is null and payment_method_uses_terminal(p_method) then
    select id into o_terminal_id
    from payment_terminal
    where tenant_id = p_tenant_id and active and is_default
    limit 1;
  end if;

  if o_terminal_id is null then
    return;
  end if;

  select name into o_terminal_name
  from payment_terminal
  where id = o_terminal_id and tenant_id = p_tenant_id;

  -- Maquininha de outro petshop: ignora em vez de vazar o vínculo.
  if o_terminal_name is null then
    o_terminal_id := null;
    return;
  end if;

  select * into v_rule
  from payment_fee_rule r
  where r.terminal_id = o_terminal_id
    and r.payment_method = p_method
    and v_installments between r.installments_from and r.installments_to
  limit 1;

  if not found then
    return;
  end if;

  o_fee_percent := v_rule.fee_percent;
  o_fee_fixed_cents := v_rule.fee_fixed_cents;
  o_settlement_days := v_rule.settlement_days;
  -- A taxa nunca pode passar do valor cobrado (tarifa fixa em venda de R$ 1).
  o_fee_cents := least(
    v_amount,
    round(v_amount * v_rule.fee_percent / 100.0)::int + v_rule.fee_fixed_cents
  );
end;
$$;
revoke execute on function resolve_payment_fee(uuid, uuid, payment_method, int, int) from public;
grant execute on function resolve_payment_fee(uuid, uuid, payment_method, int, int) to authenticated;

/**
 * Congela a taxa no lançamento. Roda em todo insert de finance_entry, então
 * vale para venda de balcão, reserva, atendimento e lançamento manual sem que
 * cada caminho precise repetir o cálculo.
 *
 * Despesas (inclusive o estorno) não têm taxa de maquininha: a operadora não
 * devolve o que reteve na venda original, então o custo continua na receita.
 */
create or replace function finance_entry_apply_fee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  if new.type <> 'INCOME' then
    new.terminal_id := null;
    new.terminal_name := null;
    new.installments := 1;
    new.fee_percent := 0;
    new.fee_fixed_cents := 0;
    new.fee_cents := 0;
    new.settlement_date := null;
    return new;
  end if;

  select * into v from resolve_payment_fee(
    new.tenant_id, new.terminal_id, new.payment_method,
    new.installments, new.amount_cents
  );

  new.terminal_id := v.o_terminal_id;
  new.terminal_name := v.o_terminal_name;
  new.fee_percent := v.o_fee_percent;
  new.fee_fixed_cents := v.o_fee_fixed_cents;
  new.fee_cents := v.o_fee_cents;
  new.settlement_date := new.occurred_on + v.o_settlement_days;
  return new;
end;
$$;

create trigger finance_entry_apply_fee
  before insert on finance_entry
  for each row execute function finance_entry_apply_fee();

-- ---------------------------------------------------------------------
-- Salvar a grade de taxas de uma maquininha de uma vez
-- ---------------------------------------------------------------------
/**
 * Substitui todas as regras da maquininha pelas enviadas, validando que as
 * faixas de parcelas não se sobrepõem — duas faixas cobrindo 3x deixariam a
 * taxa aplicada à sorte do plano de execução.
 */
create or replace function save_payment_fee_rules(
  p_terminal_id uuid,
  p_rules jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_rule record;
  v_prev_method payment_method;
  v_prev_to int;
begin
  select tenant_id into v_tenant from payment_terminal where id = p_terminal_id;
  if v_tenant is null then
    raise exception 'Maquininha não encontrada';
  end if;
  if not can_manage_finance(v_tenant) then
    raise exception 'Sem permissão para editar as taxas';
  end if;

  delete from payment_fee_rule where terminal_id = p_terminal_id;

  for v_rule in
    select (e->>'payment_method')::payment_method as payment_method,
           coalesce(nullif(e->>'installments_from', '')::int, 1) as installments_from,
           coalesce(nullif(e->>'installments_to', '')::int, 1) as installments_to,
           coalesce(nullif(e->>'fee_percent', '')::numeric, 0) as fee_percent,
           coalesce(nullif(e->>'fee_fixed_cents', '')::int, 0) as fee_fixed_cents,
           coalesce(nullif(e->>'settlement_days', '')::int, 0) as settlement_days
    from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) e
    order by 1, 2
  loop
    if v_rule.installments_to < v_rule.installments_from then
      raise exception 'Faixa de parcelas inválida: de % a %',
        v_rule.installments_from, v_rule.installments_to;
    end if;
    if v_prev_method is not distinct from v_rule.payment_method
       and v_prev_to is not null
       and v_rule.installments_from <= v_prev_to then
      raise exception 'Faixas de parcelas sobrepostas na forma %', v_rule.payment_method;
    end if;

    insert into payment_fee_rule (
      tenant_id, terminal_id, payment_method, installments_from, installments_to,
      fee_percent, fee_fixed_cents, settlement_days
    )
    values (
      v_tenant, p_terminal_id, v_rule.payment_method,
      v_rule.installments_from, v_rule.installments_to,
      v_rule.fee_percent, v_rule.fee_fixed_cents, v_rule.settlement_days
    );

    v_prev_method := v_rule.payment_method;
    v_prev_to := v_rule.installments_to;
  end loop;
end;
$$;
revoke execute on function save_payment_fee_rules(uuid, jsonb) from public;
grant execute on function save_payment_fee_rules(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Receitas automáticas passam a carregar a maquininha da venda
-- ---------------------------------------------------------------------
create or replace function finance_on_appointment_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price int;
  v_desc text;
  v_snapshot jsonb;
begin
  if new.status = 'COMPLETED' and old.status is distinct from new.status then
    if not can_complete_appointment(new.tenant_id, new.collaborator_id) then
      raise exception 'Sem permissão para concluir atendimentos';
    end if;
    if new.payment_method is null then
      raise exception 'Informe a forma de pagamento';
    end if;

    select
      st.price_cents,
      'Atendimento: ' || st.name,
      jsonb_build_object(
        'kind', 'SERVICE',
        'customer', jsonb_build_object(
          'id', t.id,
          'name', t.full_name,
          'cpf', t.cpf,
          'phone', t.phone,
          'email', t.email
        ),
        'pet', jsonb_build_object('id', p.id, 'name', p.name),
        'service', jsonb_build_object('id', st.id, 'name', st.name),
        'collaborator', jsonb_build_object('id', c.id, 'name', c.full_name),
        'scheduled_at', new.scheduled_at,
        'started_at', new.started_at,
        'finished_at', coalesce(new.finished_at, now()),
        'total_cents', st.price_cents
      )
    into v_price, v_desc, v_snapshot
    from tutor t
    join pet p on p.id = new.pet_id
    left join service_type st on st.id = new.service_type_id
    left join collaborator c on c.id = new.collaborator_id
    where t.id = new.tutor_id;

    if coalesce(v_price, 0) > 0 then
      insert into finance_entry (
        tenant_id, type, source, description, category, amount_cents,
        occurred_on, appointment_id, payment_method, snapshot, created_by,
        terminal_id, installments
      )
      values (
        new.tenant_id, 'INCOME', 'APPOINTMENT', v_desc, 'servico', v_price,
        coalesce(new.finished_at, now())::date, new.id, new.payment_method,
        coalesce(v_snapshot, '{}'::jsonb), new.completed_by,
        new.terminal_id, coalesce(new.installments, 1)
      )
      on conflict (appointment_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create or replace function finance_on_reservation_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_snapshot jsonb;
  v_customer jsonb;
begin
  if new.status = 'COMPLETED' and old.status is distinct from new.status then
    if not can_manage_finance(new.tenant_id) then
      raise exception 'Sem permissão para concluir vendas';
    end if;
    if new.payment_method is null then
      raise exception 'Informe a forma de pagamento';
    end if;

    select coalesce(sum(ri.quantity * ri.price_cents), 0),
           coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'reservation_item_id', ri.id,
                 'product_id', p.id,
                 'name', p.name,
                 'variant_id', ri.variant_id,
                 'variant', ri.variant_label,
                 'quantity', ri.quantity,
                 'unit_price_cents', ri.price_cents,
                 'subtotal_cents', ri.quantity * ri.price_cents
               )
               order by p.name, ri.id
             ),
             '[]'::jsonb
           )
      into v_total, v_snapshot
      from product_reservation_item ri
      join product p on p.id = ri.product_id
     where ri.reservation_id = new.id;

    select case
      when t.id is null then jsonb_build_object('id', null, 'name', 'Consumidor final')
      else jsonb_build_object(
        'id', t.id, 'name', t.full_name, 'cpf', t.cpf,
        'phone', t.phone, 'email', t.email
      )
    end
    into v_customer
    from (select 1) seed
    left join tutor t on t.id = new.tutor_id;

    if v_total > 0 then
      insert into finance_entry (
        tenant_id, type, source, description, category, amount_cents,
        occurred_on, reservation_id, payment_method, snapshot, created_by,
        terminal_id, installments
      )
      values (
        new.tenant_id,
        'INCOME',
        'RESERVATION',
        case when new.origin = 'STAFF' then 'Venda de produtos (balcão)' else 'Venda de produtos (reserva)' end,
        'produto',
        v_total,
        coalesce(new.completed_at, now())::date,
        new.id,
        new.payment_method,
        jsonb_build_object(
          'kind', 'PRODUCT',
          'origin', new.origin,
          'customer', coalesce(v_customer, jsonb_build_object('name', 'Consumidor final')),
          'responsible', coalesce((
            select jsonb_build_object('id', p.id, 'name', p.full_name)
            from profile p where p.id = new.completed_by
          ), jsonb_build_object('id', null, 'name', null)),
          'items', v_snapshot,
          'total_cents', v_total
        ),
        new.completed_by,
        new.terminal_id,
        coalesce(new.installments, 1)
      )
      on conflict (reservation_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- RPCs de venda com maquininha e parcelas
-- ---------------------------------------------------------------------
drop function if exists register_counter_sale(uuid, uuid, payment_method, jsonb, uuid);

create or replace function register_counter_sale(
  p_tenant_id uuid,
  p_tutor_id uuid,
  p_payment_method payment_method,
  p_items jsonb,
  p_idempotency_key uuid,
  p_terminal_id uuid default null,
  p_installments int default 1
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation_id uuid;
  v_item record;
  v_stock int;
  v_price int;
  v_label text;
  v_has_variants boolean;
  v_installments int := greatest(coalesce(p_installments, 1), 1);
begin
  if not can_manage_finance(p_tenant_id) then
    raise exception 'Sem permissão para registrar vendas';
  end if;
  if p_payment_method is null then
    raise exception 'Informe a forma de pagamento';
  end if;
  if p_idempotency_key is null then
    raise exception 'Identificador da operação ausente';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Adicione ao menos um produto';
  end if;
  if p_tutor_id is not null and not exists (
    select 1 from tutor where id = p_tutor_id and tenant_id = p_tenant_id
  ) then
    raise exception 'Cliente não encontrado';
  end if;
  if p_terminal_id is not null and not exists (
    select 1 from payment_terminal where id = p_terminal_id and tenant_id = p_tenant_id
  ) then
    raise exception 'Maquininha não encontrada';
  end if;
  if v_installments > 1 and p_payment_method <> 'CREDIT_CARD' then
    raise exception 'Só o crédito pode ser parcelado';
  end if;

  insert into product_reservation (
    tenant_id, tutor_id, origin, status, payment_method,
    completed_at, completed_by, idempotency_key, terminal_id, installments
  )
  values (
    p_tenant_id, p_tutor_id, 'STAFF', 'RESERVED', p_payment_method,
    now(), auth.uid(), p_idempotency_key, p_terminal_id, v_installments
  )
  on conflict (tenant_id, idempotency_key) where idempotency_key is not null
  do nothing
  returning id into v_reservation_id;

  if v_reservation_id is null then
    select id into v_reservation_id
    from product_reservation
    where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
    return v_reservation_id;
  end if;

  perform set_stock_context('SALE', 'Venda de balcão', v_reservation_id, null);

  for v_item in
    select (e->>'product_id')::uuid as product_id,
           nullif(e->>'variant_id', '')::uuid as variant_id,
           (e->>'quantity')::int as quantity
    from jsonb_array_elements(p_items) e
    order by 1, 2 nulls first
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Quantidade inválida';
    end if;

    select exists (
      select 1 from product_variant v where v.product_id = p.id and v.active
    )
    into v_has_variants
    from product p
    where p.id = v_item.product_id
      and p.tenant_id = p_tenant_id
      and p.active
      and p.for_sale;

    if v_has_variants is null then
      raise exception 'Produto não encontrado';
    end if;
    if v_has_variants <> (v_item.variant_id is not null) then
      raise exception 'Selecione uma variação válida';
    end if;

    if v_item.variant_id is not null then
      select stock, price_cents, product_variant_label(v)
      into v_stock, v_price, v_label
      from product_variant v
      where v.id = v_item.variant_id
        and v.product_id = v_item.product_id
        and v.tenant_id = p_tenant_id
        and v.active
      for update;

      if v_stock is null then raise exception 'Variação não encontrada'; end if;
      if v_stock < v_item.quantity then
        raise exception 'Estoque insuficiente para %', coalesce(v_label, 'a variação');
      end if;
      update product_variant set stock = stock - v_item.quantity where id = v_item.variant_id;
    else
      select stock, price_cents into v_stock, v_price
      from product
      where id = v_item.product_id and tenant_id = p_tenant_id
      for update;
      if v_stock < v_item.quantity then raise exception 'Estoque insuficiente'; end if;
      update product set stock = stock - v_item.quantity where id = v_item.product_id;
      v_label := null;
    end if;

    insert into product_reservation_item (
      tenant_id, reservation_id, product_id, variant_id,
      variant_label, quantity, price_cents
    )
    values (
      p_tenant_id, v_reservation_id, v_item.product_id, v_item.variant_id,
      v_label, v_item.quantity, v_price
    );
  end loop;

  perform set_stock_context('MANUAL', null, null, null);

  update product_reservation
  set status = 'COMPLETED'
  where id = v_reservation_id;

  return v_reservation_id;
end;
$$;

grant execute on function register_counter_sale(
  uuid, uuid, payment_method, jsonb, uuid, uuid, int
) to authenticated;

drop function if exists complete_product_sale(uuid, payment_method);

create or replace function complete_product_sale(
  p_reservation_id uuid,
  p_payment_method payment_method,
  p_terminal_id uuid default null,
  p_installments int default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status reservation_status;
  v_installments int := greatest(coalesce(p_installments, 1), 1);
begin
  select tenant_id, status into v_tenant_id, v_status
  from product_reservation
  where id = p_reservation_id
  for update;

  if v_tenant_id is null then raise exception 'Reserva não encontrada'; end if;
  if not can_manage_finance(v_tenant_id) then raise exception 'Sem permissão para concluir'; end if;
  if v_status = 'COMPLETED' then return; end if;
  if v_status <> 'PICKED' then raise exception 'A reserva precisa estar separada'; end if;
  if p_payment_method is null then raise exception 'Informe a forma de pagamento'; end if;
  if p_terminal_id is not null and not exists (
    select 1 from payment_terminal where id = p_terminal_id and tenant_id = v_tenant_id
  ) then
    raise exception 'Maquininha não encontrada';
  end if;
  if v_installments > 1 and p_payment_method <> 'CREDIT_CARD' then
    raise exception 'Só o crédito pode ser parcelado';
  end if;

  -- Sobrescreve sempre: a reserva nasce pelo tutor, quem define a cobrança é
  -- o balcão no momento do pagamento.
  update product_reservation
  set status = 'COMPLETED',
      payment_method = p_payment_method,
      terminal_id = p_terminal_id,
      installments = v_installments,
      completed_at = now(),
      completed_by = auth.uid()
  where id = p_reservation_id;
end;
$$;
grant execute on function complete_product_sale(uuid, payment_method, uuid, int) to authenticated;

-- ---------------------------------------------------------------------
-- Leitura: view e busca expõem taxa, líquido e previsão de recebimento
-- ---------------------------------------------------------------------
create or replace view finance_movement_view
with (security_invoker = true)
as
select
  fe.id,
  fe.tenant_id,
  fe.type,
  fe.source,
  fe.description,
  fe.category,
  fe.amount_cents,
  fe.occurred_on,
  fe.payment_method,
  fe.snapshot,
  fe.appointment_id,
  fe.reservation_id,
  fe.refund_id,
  fe.created_at,
  case
    when fe.source = 'REFUND' then 'REFUND'
    else fe.type::text
  end as movement_kind,
  case
    when fe.source = 'APPOINTMENT' then 'SERVICE'
    when fe.source = 'RESERVATION' then 'PRODUCT'
    when fe.source = 'REFUND' and fe.category = 'servico' then 'SERVICE'
    when fe.source = 'REFUND' and fe.category = 'produto' then 'PRODUCT'
    else 'MANUAL'
  end as movement_origin,
  pr.status::text as reservation_status,
  (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', fr.id,
        'kind', fr.kind,
        'amount_cents', fr.amount_cents,
        'reason', fr.reason,
        'payment_method', fr.payment_method,
        'created_at', fr.created_at,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'reservation_item_id', fri.reservation_item_id,
            'quantity', fri.quantity,
            'unit_price_cents', fri.unit_price_cents,
            'product', fri.product_snapshot
          ))
          from finance_refund_item fri
          where fri.refund_id = fr.id
        ), '[]'::jsonb)
      )
      order by fr.created_at
    ), '[]'::jsonb)
    from finance_refund fr
    where fr.original_entry_id = fe.id
  ) as refunds,
  fe.terminal_id,
  fe.terminal_name,
  fe.installments,
  fe.fee_percent,
  fe.fee_fixed_cents,
  fe.fee_cents,
  fe.net_amount_cents,
  fe.settlement_date
from finance_entry fe
left join product_reservation pr on pr.id = fe.reservation_id;

grant select on finance_movement_view to authenticated;

drop function if exists search_finance_movements(
  uuid, text, date, date, integer, integer, text, text, payment_method, uuid, integer, integer
);

create or replace function search_finance_movements(
  p_tenant_id uuid,
  p_q text default null,
  p_from date default null,
  p_to date default null,
  p_min_cents integer default null,
  p_max_cents integer default null,
  p_kind text default null,
  p_origin text default null,
  p_payment payment_method default null,
  p_item uuid default null,
  p_terminal uuid default null,
  p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with filtered as (
    select *
    from finance_movement_view v
    where v.tenant_id = p_tenant_id
      and (p_from is null or v.occurred_on >= p_from)
      and (p_to is null or v.occurred_on <= p_to)
      and (p_min_cents is null or v.amount_cents >= p_min_cents)
      and (p_max_cents is null or v.amount_cents <= p_max_cents)
      and (p_kind is null or v.movement_kind = p_kind)
      and (p_origin is null or v.movement_origin = p_origin)
      and (p_payment is null or v.payment_method = p_payment)
      and (p_terminal is null or v.terminal_id = p_terminal)
      and (
        p_item is null
        or v.snapshot #>> '{service,id}' = p_item::text
        or exists (
          select 1
          from jsonb_array_elements(coalesce(v.snapshot->'items', '[]'::jsonb)) item
          where item->>'product_id' = p_item::text
        )
      )
      and (
        nullif(btrim(coalesce(p_q, '')), '') is null
        or lower(v.description || ' ' || v.snapshot::text)
           like '%' || lower(btrim(p_q)) || '%'
      )
  ),
  totals as (
    select
      count(*)::integer as total,
      coalesce(sum(amount_cents) filter (where type = 'INCOME'), 0)::bigint as income,
      coalesce(sum(amount_cents) filter (where type = 'EXPENSE'), 0)::bigint as expense,
      coalesce(sum(fee_cents) filter (where type = 'INCOME'), 0)::bigint as fee
    from filtered
  ),
  page_rows as (
    select *
    from filtered
    order by occurred_on desc, created_at desc
    limit greatest(1, least(p_page_size, 50))
    offset (greatest(p_page, 1) - 1) * greatest(1, least(p_page_size, 50))
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(to_jsonb(page_rows)) from page_rows), '[]'::jsonb),
    'total', totals.total,
    'income_cents', totals.income,
    'expense_cents', totals.expense,
    'balance_cents', totals.income - totals.expense,
    'fee_cents', totals.fee,
    'net_income_cents', totals.income - totals.fee,
    'net_balance_cents', totals.income - totals.fee - totals.expense
  )
  from totals;
$$;
grant execute on function search_finance_movements(
  uuid, text, date, date, integer, integer, text, text, payment_method, uuid, uuid, integer, integer
) to authenticated;
