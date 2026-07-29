-- =====================================================================
-- Gestão financeira auditável, venda de balcão e devoluções atômicas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- CPF normalizado por petshop.
-- ---------------------------------------------------------------------
alter table tutor add column cpf text;

create or replace function normalize_tutor_cpf()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.cpf := nullif(regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g'), '');
  return new;
end;
$$;

create trigger tutor_normalize_cpf
  before insert or update of cpf on tutor
  for each row execute function normalize_tutor_cpf();

alter table tutor
  add constraint tutor_cpf_digits check (cpf is null or cpf ~ '^[0-9]{11}$');

create unique index tutor_tenant_cpf_uniq
  on tutor (tenant_id, cpf)
  where cpf is not null;

-- ---------------------------------------------------------------------
-- Pagamento, autoria e cancelamento.
-- ---------------------------------------------------------------------
alter table appointment
  add column payment_method payment_method,
  add column completed_by uuid references profile(id) on delete set null,
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references profile(id) on delete set null,
  add column cancellation_reason text;

alter table product_reservation
  alter column tutor_id drop not null,
  add column origin reservation_origin not null default 'TUTOR',
  add column payment_method payment_method,
  add column completed_at timestamptz,
  add column completed_by uuid references profile(id) on delete set null,
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references profile(id) on delete set null,
  add column cancellation_reason text,
  add column idempotency_key uuid;

alter table product_reservation
  add constraint reservation_tutor_origin_check
  check (origin = 'STAFF' or tutor_id is not null);

create unique index reservation_tenant_idempotency_uniq
  on product_reservation (tenant_id, idempotency_key)
  where idempotency_key is not null;

-- ---------------------------------------------------------------------
-- Snapshots e estornos financeiros.
-- ---------------------------------------------------------------------
alter table finance_entry
  add column payment_method payment_method,
  add column snapshot jsonb not null default '{}'::jsonb;

create table finance_refund (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenant(id) on delete cascade,
  original_entry_id  uuid not null references finance_entry(id) on delete restrict,
  kind               finance_refund_kind not null,
  reservation_id     uuid references product_reservation(id) on delete set null,
  appointment_id     uuid references appointment(id) on delete set null,
  amount_cents       integer not null check (amount_cents > 0),
  reason             text not null check (length(btrim(reason)) between 3 and 500),
  payment_method     payment_method not null,
  idempotency_key    uuid not null,
  created_by         uuid references profile(id) on delete set null,
  created_at         timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create unique index finance_refund_service_once
  on finance_refund (appointment_id)
  where appointment_id is not null;
create index finance_refund_reservation_idx on finance_refund (reservation_id, created_at);

create table finance_refund_item (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenant(id) on delete cascade,
  refund_id            uuid not null references finance_refund(id) on delete cascade,
  reservation_item_id  uuid not null references product_reservation_item(id) on delete restrict,
  quantity             integer not null check (quantity > 0),
  unit_price_cents     integer not null check (unit_price_cents >= 0),
  product_snapshot     jsonb not null default '{}'::jsonb,
  unique (refund_id, reservation_item_id)
);
create index finance_refund_item_reservation_item_idx
  on finance_refund_item (reservation_item_id);

alter table finance_entry
  add column refund_id uuid unique references finance_refund(id) on delete set null;

alter table finance_refund enable row level security;
alter table finance_refund_item enable row level security;

create policy finance_refund_staff_read on finance_refund for select
  using (is_staff(tenant_id));
create policy finance_refund_item_staff_read on finance_refund_item for select
  using (is_staff(tenant_id));

-- ---------------------------------------------------------------------
-- Contexto auditável no histórico de estoque.
-- ---------------------------------------------------------------------
alter table stock_movement
  add column stock_before integer,
  add column source stock_movement_source not null default 'MANUAL',
  add column reservation_id uuid references product_reservation(id) on delete set null,
  add column refund_id uuid references finance_refund(id) on delete set null;

update stock_movement
set stock_before = case
  when type = 'IN' then stock_after - quantity
  else stock_after + quantity
end
where stock_before is null;

alter table stock_movement alter column stock_before set not null;
create index stock_movement_reservation_idx on stock_movement (reservation_id);
create index stock_movement_refund_idx on stock_movement (refund_id);

create or replace function log_stock_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stock is distinct from old.stock then
    insert into stock_movement (
      tenant_id, product_id, variant_id, type, quantity,
      stock_before, stock_after, note, source, reservation_id, refund_id, created_by
    )
    values (
      new.tenant_id,
      new.id,
      nullif(current_setting('app.stock_variant_id', true), '')::uuid,
      case when new.stock > old.stock then 'IN'::stock_movement_type else 'OUT'::stock_movement_type end,
      abs(new.stock - old.stock),
      old.stock,
      new.stock,
      nullif(current_setting('app.stock_note', true), ''),
      coalesce(
        nullif(current_setting('app.stock_source', true), '')::stock_movement_source,
        'MANUAL'::stock_movement_source
      ),
      nullif(current_setting('app.stock_reservation_id', true), '')::uuid,
      nullif(current_setting('app.stock_refund_id', true), '')::uuid,
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create or replace function set_stock_context(
  p_source stock_movement_source,
  p_note text default null,
  p_reservation_id uuid default null,
  p_refund_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.stock_source', p_source::text, true);
  perform set_config('app.stock_note', coalesce(p_note, ''), true);
  perform set_config('app.stock_reservation_id', coalesce(p_reservation_id::text, ''), true);
  perform set_config('app.stock_refund_id', coalesce(p_refund_id::text, ''), true);
end;
$$;
revoke execute on function set_stock_context(stock_movement_source, text, uuid, uuid) from public;

create or replace function reservation_stock_context_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_stock_context('RESERVATION', 'Reserva de produtos', new.id, null);
  return new;
end;
$$;

create trigger product_reservation_stock_context
  after insert on product_reservation
  for each row execute function reservation_stock_context_on_insert();

-- Escritas financeiras são permitidas para todos os papéis operacionais,
-- mantendo VIEWER estritamente somente leitura.
create or replace function can_manage_finance(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select has_staff_role(
    p_tenant_id,
    array['OWNER', 'MANAGER', 'ATTENDANT']::staff_role[]
  );
$$;
revoke execute on function can_manage_finance(uuid) from public;
grant execute on function can_manage_finance(uuid) to authenticated;

drop policy if exists finance_staff on finance_entry;
create policy finance_entry_staff_read on finance_entry for select
  using (is_staff(tenant_id));
create policy finance_entry_staff_insert on finance_entry for insert
  with check (can_manage_finance(tenant_id));
create policy finance_entry_staff_update on finance_entry for update
  using (can_manage_finance(tenant_id)) with check (can_manage_finance(tenant_id));
create policy finance_entry_staff_delete on finance_entry for delete
  using (can_manage_finance(tenant_id));

create or replace function require_finance_payment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.payment_method is null
     and coalesce(current_setting('app.allow_missing_payment', true), '') <> '1' then
    raise exception 'Informe a forma de pagamento';
  end if;
  return new;
end;
$$;

create trigger finance_entry_payment_required
  before insert on finance_entry
  for each row execute function require_finance_payment();

create or replace function register_stock_movement(
  p_product_id uuid,
  p_type stock_movement_type,
  p_quantity int,
  p_note text default null,
  p_variant_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_stock int;
  v_has boolean;
begin
  select tenant_id,
         exists (select 1 from product_variant v where v.product_id = p.id and v.active)
  into v_tenant, v_has
  from product p where p.id = p_product_id;

  if v_tenant is null or not can_manage_finance(v_tenant) then
    raise exception 'Sem permissão para movimentar este produto';
  end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantidade inválida'; end if;
  if v_has and p_variant_id is null then raise exception 'Selecione a variação'; end if;
  if not v_has and p_variant_id is not null then raise exception 'Produto sem variações'; end if;

  perform set_stock_context('MANUAL', p_note, null, null);
  if p_variant_id is not null then
    select stock into v_stock
    from product_variant
    where id = p_variant_id and product_id = p_product_id and tenant_id = v_tenant
    for update;
    if v_stock is null then raise exception 'Variação não encontrada'; end if;
    if p_type = 'OUT' and v_stock < p_quantity then
      raise exception 'Estoque insuficiente (disponível: %)', v_stock;
    end if;
    update product_variant
    set stock = stock + case when p_type = 'IN' then p_quantity else -p_quantity end
    where id = p_variant_id;
  else
    select stock into v_stock from product where id = p_product_id for update;
    if p_type = 'OUT' and v_stock < p_quantity then
      raise exception 'Estoque insuficiente (disponível: %)', v_stock;
    end if;
    update product
    set stock = stock + case when p_type = 'IN' then p_quantity else -p_quantity end
    where id = p_product_id;
  end if;
  perform set_stock_context('MANUAL', null, null, null);
end;
$$;

-- ---------------------------------------------------------------------
-- Snapshot imutável ao concluir atendimento.
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
    if not can_manage_finance(new.tenant_id) then
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
        occurred_on, appointment_id, payment_method, snapshot, created_by
      )
      values (
        new.tenant_id, 'INCOME', 'APPOINTMENT', v_desc, 'servico', v_price,
        coalesce(new.finished_at, now())::date, new.id, new.payment_method,
        coalesce(v_snapshot, '{}'::jsonb), new.completed_by
      )
      on conflict (appointment_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Snapshot imutável ao concluir venda/reserva.
-- ---------------------------------------------------------------------
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
        occurred_on, reservation_id, payment_method, snapshot, created_by
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
        new.completed_by
      )
      on conflict (reservation_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- Backfill best-effort para lançamentos antigos. Pagamento/CPF ausentes
-- continuam nulos e aparecem como "Não informado" na interface.
update finance_entry fe
set snapshot = jsonb_build_object(
  'kind', 'SERVICE',
  'customer', jsonb_build_object(
    'id', t.id, 'name', t.full_name, 'cpf', t.cpf,
    'phone', t.phone, 'email', t.email
  ),
  'pet', jsonb_build_object('id', p.id, 'name', p.name),
  'service', jsonb_build_object('id', st.id, 'name', st.name),
  'collaborator', jsonb_build_object('id', c.id, 'name', c.full_name),
  'scheduled_at', a.scheduled_at,
  'started_at', a.started_at,
  'finished_at', a.finished_at,
  'total_cents', fe.amount_cents
)
from appointment a
join tutor t on t.id = a.tutor_id
join pet p on p.id = a.pet_id
left join service_type st on st.id = a.service_type_id
left join collaborator c on c.id = a.collaborator_id
where fe.appointment_id = a.id
  and fe.source = 'APPOINTMENT'
  and fe.snapshot = '{}'::jsonb;

update finance_entry fe
set snapshot = jsonb_build_object(
  'kind', 'PRODUCT',
  'origin', r.origin,
  'customer', case
    when t.id is null then jsonb_build_object('id', null, 'name', 'Consumidor final')
    else jsonb_build_object(
      'id', t.id, 'name', t.full_name, 'cpf', t.cpf,
      'phone', t.phone, 'email', t.email
    )
  end,
  'responsible', jsonb_build_object('id', null, 'name', null),
  'items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'reservation_item_id', ri.id,
      'product_id', p.id,
      'name', p.name,
      'variant_id', ri.variant_id,
      'variant', ri.variant_label,
      'quantity', ri.quantity,
      'unit_price_cents', ri.price_cents,
      'subtotal_cents', ri.quantity * ri.price_cents
    ) order by p.name, ri.id)
    from product_reservation_item ri
    join product p on p.id = ri.product_id
    where ri.reservation_id = r.id
  ), '[]'::jsonb),
  'total_cents', fe.amount_cents
)
from product_reservation r
left join tutor t on t.id = r.tutor_id
where fe.reservation_id = r.id
  and fe.source = 'RESERVATION'
  and fe.snapshot = '{}'::jsonb;

-- ---------------------------------------------------------------------
-- Venda de balcão: cria venda, itens, baixa e receita em uma transação.
-- p_items = [{product_id, variant_id?, quantity}]
-- ---------------------------------------------------------------------
create or replace function register_counter_sale(
  p_tenant_id uuid,
  p_tutor_id uuid,
  p_payment_method payment_method,
  p_items jsonb,
  p_idempotency_key uuid
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

  insert into product_reservation (
    tenant_id, tutor_id, origin, status, payment_method,
    completed_at, completed_by, idempotency_key
  )
  values (
    p_tenant_id, p_tutor_id, 'STAFF', 'RESERVED', p_payment_method,
    now(), auth.uid(), p_idempotency_key
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

grant execute on function register_counter_sale(uuid, uuid, payment_method, jsonb, uuid)
  to authenticated;

-- ---------------------------------------------------------------------
-- Conclusão paga e idempotente de reserva já separada.
-- ---------------------------------------------------------------------
create or replace function complete_product_sale(
  p_reservation_id uuid,
  p_payment_method payment_method
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status reservation_status;
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

  update product_reservation
  set status = 'COMPLETED',
      payment_method = p_payment_method,
      completed_at = now(),
      completed_by = auth.uid()
  where id = p_reservation_id;
end;
$$;
grant execute on function complete_product_sale(uuid, payment_method) to authenticated;

-- ---------------------------------------------------------------------
-- Cancelamento/recusa/expiração sem receita: reposição única.
-- ---------------------------------------------------------------------
create or replace function cancel_product_reservation(
  p_reservation_id uuid,
  p_reason text,
  p_target_status reservation_status default 'CANCELLED'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status reservation_status;
  v_item record;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  select tenant_id, status into v_tenant_id, v_status
  from product_reservation
  where id = p_reservation_id
  for update;

  if v_tenant_id is null then raise exception 'Reserva não encontrada'; end if;
  if not can_manage_finance(v_tenant_id) then raise exception 'Sem permissão para cancelar'; end if;
  if v_status in ('CANCELLED', 'REJECTED', 'EXPIRED') then return; end if;
  if v_status not in ('RESERVED', 'PICKED') then
    raise exception 'Venda concluída deve ser devolvida, não cancelada';
  end if;
  if p_target_status not in ('CANCELLED', 'REJECTED', 'EXPIRED') then
    raise exception 'Status de cancelamento inválido';
  end if;
  if length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'Informe um motivo entre 3 e 500 caracteres';
  end if;

  perform set_stock_context(
    (
      case when p_target_status = 'EXPIRED' then 'EXPIRATION' else 'CANCELLATION' end
    )::stock_movement_source,
    v_reason,
    p_reservation_id,
    null
  );
  perform restore_reservation_stock(p_reservation_id);
  perform set_stock_context('MANUAL', null, null, null);

  update product_reservation
  set status = p_target_status,
      cancellation_reason = v_reason,
      cancelled_at = now(),
      cancelled_by = case when p_target_status = 'EXPIRED' then null else auth.uid() end,
      rejection_reason = case when p_target_status = 'REJECTED' then v_reason else rejection_reason end,
      rejected_at = case when p_target_status = 'REJECTED' then now() else rejected_at end,
      rejected_by = case when p_target_status = 'REJECTED' then auth.uid() else rejected_by end
  where id = p_reservation_id;
end;
$$;
grant execute on function cancel_product_reservation(uuid, text, reservation_status)
  to authenticated;

create or replace function cancel_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_owner_tutor uuid;
  v_status reservation_status;
begin
  select tenant_id, tutor_id, status
  into v_tenant_id, v_owner_tutor, v_status
  from product_reservation
  where id = p_reservation_id
  for update;

  if v_tenant_id is null then raise exception 'Reserva não encontrada'; end if;
  if my_tutor_id(v_tenant_id) is distinct from v_owner_tutor then
    raise exception 'Sem permissão para cancelar esta reserva';
  end if;
  if v_status = 'CANCELLED' then return; end if;
  if v_status <> 'RESERVED' then raise exception 'Reserva não está mais ativa'; end if;

  perform set_stock_context(
    'CANCELLATION',
    'Reserva cancelada pelo tutor',
    p_reservation_id,
    null
  );
  perform restore_reservation_stock(p_reservation_id);
  perform set_stock_context('MANUAL', null, null, null);
  update product_reservation
  set status = 'CANCELLED',
      cancellation_reason = 'Cancelada pelo tutor',
      cancelled_at = now(),
      cancelled_by = auth.uid()
  where id = p_reservation_id;
end;
$$;

create or replace function cancel_reservation_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_remaining int;
begin
  select
    ri.tenant_id, ri.reservation_id, ri.product_id, ri.variant_id, ri.quantity,
    r.tutor_id, r.status
  into v_item
  from product_reservation_item ri
  join product_reservation r on r.id = ri.reservation_id
  where ri.id = p_item_id
  for update of r;

  if v_item.tenant_id is null then raise exception 'Item não encontrado'; end if;
  if my_tutor_id(v_item.tenant_id) is distinct from v_item.tutor_id then
    raise exception 'Sem permissão para cancelar este item';
  end if;
  if v_item.status <> 'RESERVED' then raise exception 'Reserva não está mais ativa'; end if;

  perform set_stock_context(
    'CANCELLATION',
    'Item cancelado pelo tutor',
    v_item.reservation_id,
    null
  );
  if v_item.variant_id is not null then
    update product_variant set stock = stock + v_item.quantity where id = v_item.variant_id;
  else
    update product set stock = stock + v_item.quantity where id = v_item.product_id;
  end if;
  perform set_stock_context('MANUAL', null, null, null);

  delete from product_reservation_item where id = p_item_id;
  select count(*) into v_remaining
  from product_reservation_item where reservation_id = v_item.reservation_id;
  if v_remaining = 0 then
    update product_reservation
    set status = 'CANCELLED',
        cancellation_reason = 'Todos os itens foram cancelados pelo tutor',
        cancelled_at = now(),
        cancelled_by = auth.uid()
    where id = v_item.reservation_id;
  end if;
end;
$$;

-- Mantém o contrato usado pela tela de solicitações, agora com a mesma
-- automação e proteção contra reposição dupla.
create or replace function staff_cancel_reservation(
  p_reservation_id uuid,
  p_reason text
)
returns void
language sql
security definer
set search_path = public
as $$
  select cancel_product_reservation(p_reservation_id, p_reason, 'REJECTED');
$$;

-- ---------------------------------------------------------------------
-- Devolução parcial/total de produtos.
-- p_items = [{reservation_item_id, quantity}]
-- ---------------------------------------------------------------------
create or replace function refund_product_sale(
  p_reservation_id uuid,
  p_items jsonb,
  p_reason text,
  p_payment_method payment_method,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status reservation_status;
  v_original_entry_id uuid;
  v_refund_id uuid;
  v_total int := 0;
  v_original_total int;
  v_refunded_total int;
  v_item record;
  v_available int;
  v_product_snapshot jsonb;
begin
  select tenant_id, status into v_tenant_id, v_status
  from product_reservation
  where id = p_reservation_id
  for update;

  if v_tenant_id is null then raise exception 'Venda não encontrada'; end if;
  if not can_manage_finance(v_tenant_id) then raise exception 'Sem permissão para devolver'; end if;
  if v_status not in ('COMPLETED', 'PARTIALLY_REFUNDED') then
    raise exception 'Esta venda não possui saldo devolvível';
  end if;
  if p_payment_method is null then raise exception 'Informe o meio do reembolso'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Informe o motivo'; end if;
  if p_idempotency_key is null then raise exception 'Identificador da operação ausente'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Selecione ao menos um item';
  end if;

  select id, amount_cents into v_original_entry_id, v_original_total
  from finance_entry
  where reservation_id = p_reservation_id and type = 'INCOME'
  for update;
  if v_original_entry_id is null then raise exception 'Receita original não encontrada'; end if;

  select id into v_refund_id
  from finance_refund
  where tenant_id = v_tenant_id and idempotency_key = p_idempotency_key;
  if v_refund_id is not null then return v_refund_id; end if;

  -- Primeiro valida e calcula tudo, com a reserva travada serializando as
  -- devoluções concorrentes.
  for v_item in
    select (e->>'reservation_item_id')::uuid as reservation_item_id,
           (e->>'quantity')::int as quantity
    from jsonb_array_elements(p_items) e
    order by 1
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Quantidade de devolução inválida';
    end if;

    select
      ri.quantity - coalesce((
        select sum(fri.quantity)
        from finance_refund_item fri
        join finance_refund fr on fr.id = fri.refund_id
        where fri.reservation_item_id = ri.id
      ), 0),
      ri.price_cents,
      jsonb_build_object(
        'product_id', p.id, 'name', p.name,
        'variant_id', ri.variant_id, 'variant', ri.variant_label
      )
    into v_available, v_original_total, v_product_snapshot
    from product_reservation_item ri
    join product p on p.id = ri.product_id
    where ri.id = v_item.reservation_item_id
      and ri.reservation_id = p_reservation_id;

    if v_available is null then raise exception 'Item não pertence à venda'; end if;
    if v_item.quantity > v_available then
      raise exception 'Quantidade excede o saldo devolvível';
    end if;
    v_total := v_total + (v_item.quantity * v_original_total);
  end loop;

  insert into finance_refund (
    tenant_id, original_entry_id, kind, reservation_id, amount_cents,
    reason, payment_method, idempotency_key, created_by
  )
  values (
    v_tenant_id, v_original_entry_id, 'PRODUCT_RETURN', p_reservation_id,
    v_total, btrim(p_reason), p_payment_method, p_idempotency_key, auth.uid()
  )
  returning id into v_refund_id;

  perform set_stock_context('REFUND', 'Devolução: ' || btrim(p_reason), p_reservation_id, v_refund_id);

  for v_item in
    select (e->>'reservation_item_id')::uuid as reservation_item_id,
           (e->>'quantity')::int as quantity
    from jsonb_array_elements(p_items) e
    order by 1
  loop
    insert into finance_refund_item (
      tenant_id, refund_id, reservation_item_id, quantity,
      unit_price_cents, product_snapshot
    )
    select
      v_tenant_id, v_refund_id, ri.id, v_item.quantity,
      ri.price_cents, jsonb_build_object(
        'product_id', p.id, 'name', p.name,
        'variant_id', ri.variant_id, 'variant', ri.variant_label
      )
    from product_reservation_item ri
    join product p on p.id = ri.product_id
    where ri.id = v_item.reservation_item_id;

    update product_variant
    set stock = stock + v_item.quantity
    where id = (
      select variant_id from product_reservation_item
      where id = v_item.reservation_item_id
    );

    if not found then
      update product
      set stock = stock + v_item.quantity
      where id = (
        select product_id from product_reservation_item
        where id = v_item.reservation_item_id
      );
    end if;
  end loop;

  perform set_stock_context('MANUAL', null, null, null);

  insert into finance_entry (
    tenant_id, type, source, description, category, amount_cents,
    occurred_on, payment_method, snapshot, refund_id, created_by
  )
  values (
    v_tenant_id, 'EXPENSE', 'REFUND', 'Devolução de produtos', 'produto',
    v_total, current_date, p_payment_method,
    (
      select snapshot || jsonb_build_object(
        'kind', 'REFUND',
        'original_entry_id', v_original_entry_id
      )
      from finance_entry where id = v_original_entry_id
    ),
    v_refund_id, auth.uid()
  );

  select coalesce(sum(amount_cents), 0) into v_refunded_total
  from finance_refund where reservation_id = p_reservation_id;

  update product_reservation
  set status = case
    when v_refunded_total >= (
      select amount_cents from finance_entry where id = v_original_entry_id
    ) then 'REFUNDED'::reservation_status
    else 'PARTIALLY_REFUNDED'::reservation_status
  end
  where id = p_reservation_id;

  return v_refund_id;
end;
$$;
grant execute on function refund_product_sale(uuid, jsonb, text, payment_method, uuid)
  to authenticated;
revoke execute on function refund_reservation(uuid) from authenticated, public;

-- ---------------------------------------------------------------------
-- Estorno integral de serviço, preservando o atendimento concluído.
-- ---------------------------------------------------------------------
create or replace function refund_service(
  p_appointment_id uuid,
  p_reason text,
  p_payment_method payment_method,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status appointment_status;
  v_entry finance_entry%rowtype;
  v_refund_id uuid;
begin
  select tenant_id, status into v_tenant_id, v_status
  from appointment where id = p_appointment_id for update;

  if v_tenant_id is null then raise exception 'Atendimento não encontrado'; end if;
  if not can_manage_finance(v_tenant_id) then raise exception 'Sem permissão para estornar'; end if;
  if v_status <> 'COMPLETED' then raise exception 'Somente atendimentos concluídos podem ser estornados'; end if;
  if p_payment_method is null then raise exception 'Informe o meio do reembolso'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Informe o motivo'; end if;

  select * into v_entry
  from finance_entry
  where appointment_id = p_appointment_id and type = 'INCOME'
  for update;
  if v_entry.id is null then raise exception 'Receita original não encontrada'; end if;

  select id into v_refund_id from finance_refund
  where appointment_id = p_appointment_id;
  if v_refund_id is not null then return v_refund_id; end if;

  insert into finance_refund (
    tenant_id, original_entry_id, kind, appointment_id, amount_cents,
    reason, payment_method, idempotency_key, created_by
  )
  values (
    v_tenant_id, v_entry.id, 'SERVICE_REFUND', p_appointment_id,
    v_entry.amount_cents, btrim(p_reason), p_payment_method,
    p_idempotency_key, auth.uid()
  )
  returning id into v_refund_id;

  insert into finance_entry (
    tenant_id, type, source, description, category, amount_cents,
    occurred_on, payment_method, snapshot, refund_id, created_by
  )
  values (
    v_tenant_id, 'EXPENSE', 'REFUND', 'Estorno: ' || v_entry.description,
    'servico', v_entry.amount_cents, current_date, p_payment_method,
    v_entry.snapshot || jsonb_build_object(
      'kind', 'REFUND',
      'original_entry_id', v_entry.id
    ),
    v_refund_id, auth.uid()
  );

  return v_refund_id;
end;
$$;
grant execute on function refund_service(uuid, text, payment_method, uuid)
  to authenticated;

-- ---------------------------------------------------------------------
-- Expiração horária. Somente service_role executa a rotina em lote.
-- ---------------------------------------------------------------------
create or replace function expire_product_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_count int := 0;
begin
  for v_row in
    select id
    from product_reservation
    where status in ('RESERVED', 'PICKED')
      and expires_at is not null
      and expires_at <= now()
    order by id
    for update skip locked
  loop
    perform set_stock_context('EXPIRATION', 'Reserva expirada automaticamente', v_row.id, null);
    perform restore_reservation_stock(v_row.id);
    update product_reservation
    set status = 'EXPIRED',
        cancellation_reason = 'Reserva expirada automaticamente',
        cancelled_at = now(),
        cancelled_by = null
    where id = v_row.id;
    v_count := v_count + 1;
  end loop;
  perform set_stock_context('MANUAL', null, null, null);
  return v_count;
end;
$$;
revoke execute on function expire_product_reservations() from public;
grant execute on function expire_product_reservations() to service_role;

-- ---------------------------------------------------------------------
-- View security_invoker + busca/agregação antes da paginação.
-- ---------------------------------------------------------------------
create view finance_movement_view
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
  ) as refunds
from finance_entry fe
left join product_reservation pr on pr.id = fe.reservation_id;

grant select on finance_movement_view to authenticated;

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
      coalesce(sum(amount_cents) filter (where type = 'EXPENSE'), 0)::bigint as expense
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
    'balance_cents', totals.income - totals.expense
  )
  from totals;
$$;
grant execute on function search_finance_movements(
  uuid, text, date, date, integer, integer, text, text, payment_method, uuid, integer, integer
) to authenticated;

create or replace function search_stock_movements(
  p_tenant_id uuid,
  p_q text default null,
  p_from date default null,
  p_to date default null,
  p_type stock_movement_type default null,
  p_source stock_movement_source default null,
  p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language sql
stable
set search_path = public
as $$
  with filtered as (
    select
      sm.id,
      sm.type,
      sm.source,
      sm.quantity,
      sm.stock_before,
      sm.stock_after,
      sm.note,
      sm.created_at,
      sm.reservation_id,
      sm.refund_id,
      jsonb_build_object('name', p.name) as product,
      case
        when sm.refund_id is not null then (
          select jsonb_build_object(
            'kind', 'REFUND',
            'reason', fr.reason,
            'finance_entry_id', refund_entry.id,
            'customer', original_entry.snapshot->'customer'
          )
          from finance_refund fr
          join finance_entry original_entry on original_entry.id = fr.original_entry_id
          left join finance_entry refund_entry on refund_entry.refund_id = fr.id
          where fr.id = sm.refund_id
        )
        when sm.reservation_id is not null then (
          select jsonb_build_object(
            'kind', case
              when sm.source = 'CANCELLATION' then 'CANCELLATION'
              when sm.source = 'EXPIRATION' then 'EXPIRATION'
              else 'SALE'
            end,
            'reservation_id', r.id,
            'status', r.status,
            'reason', r.cancellation_reason,
            'finance_entry_id', sale_entry.id,
            'customer', sale_entry.snapshot->'customer'
          )
          from product_reservation r
          left join finance_entry sale_entry on sale_entry.reservation_id = r.id
          where r.id = sm.reservation_id
        )
        else null
      end as related,
      case when v.id is null then null else jsonb_build_object(
        'color_name', v.color_name,
        'size', v.size,
        'weight_value', v.weight_value,
        'weight_unit', v.weight_unit
      ) end as variant_label
    from stock_movement sm
    join product p on p.id = sm.product_id
    left join product_variant v on v.id = sm.variant_id
    where sm.tenant_id = p_tenant_id
      and (
        p_from is null
        or sm.created_at >= (p_from::timestamp at time zone 'America/Sao_Paulo')
      )
      and (
        p_to is null
        or sm.created_at < ((p_to + 1)::timestamp at time zone 'America/Sao_Paulo')
      )
      and (p_type is null or sm.type = p_type)
      and (p_source is null or sm.source = p_source)
      and (
        nullif(btrim(coalesce(p_q, '')), '') is null
        or lower(concat_ws(' ', p.name, v.color_name, v.size, v.weight_value, v.weight_unit))
           like '%' || lower(btrim(p_q)) || '%'
      )
  )
  select jsonb_build_object(
    'rows', coalesce((
      select jsonb_agg(to_jsonb(page_rows))
      from (
        select *
        from filtered
        order by created_at desc
        limit greatest(1, least(p_page_size, 50))
        offset (greatest(p_page, 1) - 1) * greatest(1, least(p_page_size, 50))
      ) page_rows
    ), '[]'::jsonb),
    'total', (select count(*)::integer from filtered)
  );
$$;
grant execute on function search_stock_movements(
  uuid, text, date, date, stock_movement_type, stock_movement_source, integer, integer
) to authenticated;
