-- =====================================================================
-- Financeiro (receitas/despesas) + controle de estoque simples.
--   * finance_entry: lançamentos manuais e automáticos (atendimento
--     concluído / reserva retirada geram receita via trigger).
--   * stock_movement: histórico de estoque com fonte única — trigger em
--     product.stock cobre movimentações manuais, edição de produto e as
--     RPCs de reserva (0005) sem duplicar lógica.
--   * product.min_stock: alerta de estoque baixo.
-- =====================================================================

create type finance_entry_type  as enum ('INCOME', 'EXPENSE');
create type finance_source      as enum ('MANUAL', 'APPOINTMENT', 'RESERVATION');
create type stock_movement_type as enum ('IN', 'OUT');

alter table product add column min_stock integer not null default 0 check (min_stock >= 0);

-- ---------------------------------------------------------------------
-- Lançamentos financeiros
-- ---------------------------------------------------------------------
create table finance_entry (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id) on delete cascade,
  type            finance_entry_type not null,
  source          finance_source not null default 'MANUAL',
  description     text not null,
  category        text,             -- slug livre (opções predefinidas na UI)
  amount_cents    integer not null check (amount_cents > 0),
  occurred_on     date not null default current_date,
  -- unique em coluna nullable: garante 1 receita automática por origem
  appointment_id  uuid unique references appointment(id) on delete set null,
  reservation_id  uuid unique references product_reservation(id) on delete set null,
  created_by      uuid references profile(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index on finance_entry (tenant_id, occurred_on desc);

-- ---------------------------------------------------------------------
-- Movimentações de estoque
-- ---------------------------------------------------------------------
create table stock_movement (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant(id) on delete cascade,
  product_id  uuid not null references product(id) on delete cascade,
  type        stock_movement_type not null,
  quantity    integer not null check (quantity > 0),  -- sempre positiva; direção no type
  stock_after integer not null,
  note        text,                                   -- nula = movimentação automática (reserva etc.)
  created_by  uuid references profile(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on stock_movement (tenant_id, created_at desc);
create index on stock_movement (product_id, created_at desc);

alter table finance_entry  enable row level security;
alter table stock_movement enable row level security;
create policy finance_staff on finance_entry for all
  using (is_staff(tenant_id)) with check (is_staff(tenant_id));
create policy stock_movement_staff on stock_movement for all
  using (is_staff(tenant_id)) with check (is_staff(tenant_id));

-- ---------------------------------------------------------------------
-- Histórico de estoque: fonte única via trigger em product.stock.
-- SECURITY DEFINER: as RPCs de reserva rodam como tutor, que não tem
-- insert em stock_movement.
-- ---------------------------------------------------------------------
create or replace function log_stock_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stock is distinct from old.stock then
    insert into stock_movement (tenant_id, product_id, type, quantity, stock_after, note, created_by)
    values (
      new.tenant_id,
      new.id,
      case when new.stock > old.stock then 'IN'::stock_movement_type else 'OUT'::stock_movement_type end,
      abs(new.stock - old.stock),
      new.stock,
      nullif(current_setting('app.stock_note', true), ''),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger product_stock_log
  after update of stock on product
  for each row execute function log_stock_change();

-- ---------------------------------------------------------------------
-- Movimentação manual de estoque (staff). A nota viaja por GUC
-- transacional para o trigger acima — único caminho de escrita no log.
-- ---------------------------------------------------------------------
create or replace function register_stock_movement(
  p_product_id uuid,
  p_type stock_movement_type,
  p_quantity int,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_stock int;
begin
  select tenant_id, stock into v_tenant, v_stock
  from product where id = p_product_id
  for update;

  if v_tenant is null or not is_staff(v_tenant) then
    raise exception 'Sem permissão para movimentar este produto';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantidade inválida';
  end if;
  if p_type = 'OUT' and v_stock < p_quantity then
    raise exception 'Estoque insuficiente (disponível: %)', v_stock;
  end if;

  perform set_config('app.stock_note', coalesce(p_note, ''), true);
  update product
     set stock = stock + case when p_type = 'IN' then p_quantity else -p_quantity end
   where id = p_product_id;
  perform set_config('app.stock_note', '', true);
end;
$$;

grant execute on function register_stock_movement(uuid, stock_movement_type, int, text) to authenticated;

-- ---------------------------------------------------------------------
-- Receita automática: atendimento concluído.
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
begin
  if new.status = 'COMPLETED' and old.status is distinct from new.status then
    select st.price_cents, 'Atendimento: ' || st.name
      into v_price, v_desc
      from service_type st
     where st.id = new.service_type_id;
    if coalesce(v_price, 0) > 0 then
      insert into finance_entry (tenant_id, type, source, description, category, amount_cents, occurred_on, appointment_id)
      values (new.tenant_id, 'INCOME', 'APPOINTMENT', v_desc, 'servico', v_price, current_date, new.id)
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger appointment_finance
  after update of status on appointment
  for each row execute function finance_on_appointment_completed();

-- ---------------------------------------------------------------------
-- Receita automática: reserva de produtos retirada/paga.
-- ---------------------------------------------------------------------
create or replace function finance_on_reservation_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
begin
  if new.status = 'COMPLETED' and old.status is distinct from new.status then
    select coalesce(sum(quantity * price_cents), 0)
      into v_total
      from product_reservation_item
     where reservation_id = new.id;
    if v_total > 0 then
      insert into finance_entry (tenant_id, type, source, description, category, amount_cents, occurred_on, reservation_id)
      values (new.tenant_id, 'INCOME', 'RESERVATION', 'Venda de produtos (reserva)', 'produto', v_total, current_date, new.id)
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger reservation_finance
  after update of status on product_reservation
  for each row execute function finance_on_reservation_completed();
