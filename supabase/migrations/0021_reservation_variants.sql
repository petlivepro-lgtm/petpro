-- =====================================================================
-- Reservas passam a gravar a variação escolhida pelo tutor. O estoque é
-- debitado da variação; o trigger de agregação (0020) atualiza
-- product.stock e o product_stock_log continua sendo a fonte única do
-- histórico de estoque.
-- =====================================================================

alter table product_reservation_item
  add column variant_id    uuid references product_variant(id) on delete restrict,
  add column variant_label text;   -- snapshot: "Preto · M · 1 kg"

create index on product_reservation_item (variant_id);

-- ---------------------------------------------------------------------
-- Devolução de estoque: o mesmo laço estava repetido em 4 funções.
-- Interna — NÃO exposta ao cliente (não faz checagem de permissão).
-- Ordena por product_id: ordem de lock determinística entre reservas
-- concorrentes.
-- ---------------------------------------------------------------------
create or replace function restore_reservation_stock(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_item record;
begin
  for v_item in
    select product_id, variant_id, quantity
      from product_reservation_item
     where reservation_id = p_reservation_id
     order by product_id, variant_id nulls first
  loop
    if v_item.variant_id is not null then
      update product_variant set stock = stock + v_item.quantity where id = v_item.variant_id;
    else
      update product set stock = stock + v_item.quantity where id = v_item.product_id;
    end if;
  end loop;
end;
$$;

revoke execute on function restore_reservation_stock(uuid) from public;

-- ---------------------------------------------------------------------
-- reserve_products: p_items = [{product_id, variant_id?, quantity}]
--   * produto COM variações ativas -> variant_id obrigatório
--   * produto SEM variações        -> variant_id deve ser nulo
--   * com variação, product é lido SEM for update: o lock vem da variação
--     e o trigger escala para product (ordem única variant -> product)
--   * itens ordenados por product_id: corrige o deadlock multi-item que
--     já existia em 0005 (dois tutores reservando {A,B} e {B,A})
-- ---------------------------------------------------------------------
create or replace function reserve_products(
  p_tenant_id uuid,
  p_items jsonb,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tutor_id       uuid;
  v_reservation_id uuid;
  v_item           record;
  v_stock          int;
  v_price          int;
  v_label          text;
  v_has_variants   boolean;
  v_found          boolean;
begin
  v_tutor_id := my_tutor_id(p_tenant_id);
  if v_tutor_id is null then
    raise exception 'Tutor não encontrado para este tenant';
  end if;

  insert into product_reservation (tenant_id, tutor_id, status, note, expires_at)
  values (p_tenant_id, v_tutor_id, 'RESERVED', p_note, now() + interval '48 hours')
  returning id into v_reservation_id;

  for v_item in
    select (e->>'product_id')::uuid          as product_id,
           nullif(e->>'variant_id','')::uuid as variant_id,
           (e->>'quantity')::int             as quantity
      from jsonb_array_elements(p_items) e
     order by 1, 2 nulls first
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'Quantidade inválida';
    end if;

    select true,
           exists (select 1 from product_variant v
                    where v.product_id = p.id and v.active)
      into v_found, v_has_variants
      from product p
     where p.id = v_item.product_id
       and p.tenant_id = p_tenant_id
       and p.for_sale
       and p.active;

    if not coalesce(v_found, false) then
      raise exception 'Produto não encontrado';
    end if;
    if v_has_variants and v_item.variant_id is null then
      raise exception 'Selecione a variação do produto';
    end if;
    if not v_has_variants and v_item.variant_id is not null then
      raise exception 'Produto sem variações';
    end if;

    if v_item.variant_id is not null then
      select v.stock, v.price_cents, product_variant_label(v)
        into v_stock, v_price, v_label
        from product_variant v
       where v.id = v_item.variant_id
         and v.product_id = v_item.product_id
         and v.tenant_id  = p_tenant_id
         and v.active
       for update;

      if v_stock is null then
        raise exception 'Variação não encontrada';
      end if;
      if v_stock < v_item.quantity then
        raise exception 'Estoque insuficiente para a variação %', coalesce(v_label, '');
      end if;

      update product_variant set stock = stock - v_item.quantity where id = v_item.variant_id;
    else
      select stock, price_cents into v_stock, v_price
        from product where id = v_item.product_id for update;

      if v_stock < v_item.quantity then
        raise exception 'Estoque insuficiente para o produto %', v_item.product_id;
      end if;

      update product set stock = stock - v_item.quantity where id = v_item.product_id;
      v_label := null;
    end if;

    insert into product_reservation_item
      (tenant_id, reservation_id, product_id, variant_id, quantity, price_cents, variant_label)
    values (p_tenant_id, v_reservation_id, v_item.product_id, v_item.variant_id,
            v_item.quantity, v_price, v_label);
  end loop;

  return v_reservation_id;
end;
$$;

grant execute on function reserve_products(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------
create or replace function cancel_reservation_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id      uuid;
  v_reservation_id uuid;
  v_product_id     uuid;
  v_variant_id     uuid;
  v_qty            int;
  v_owner_tutor    uuid;
  v_status         reservation_status;
  v_caller_tutor   uuid;
  v_remaining      int;
begin
  select ri.tenant_id, ri.reservation_id, ri.product_id, ri.variant_id, ri.quantity, r.tutor_id, r.status
    into v_tenant_id, v_reservation_id, v_product_id, v_variant_id, v_qty, v_owner_tutor, v_status
  from product_reservation_item ri
  join product_reservation r on r.id = ri.reservation_id
  where ri.id = p_item_id;

  if v_tenant_id is null then
    raise exception 'Item de reserva não encontrado';
  end if;

  v_caller_tutor := my_tutor_id(v_tenant_id);
  if v_caller_tutor is null or v_caller_tutor <> v_owner_tutor then
    raise exception 'Sem permissão para cancelar este item';
  end if;
  if v_status <> 'RESERVED' then
    raise exception 'Reserva não está mais ativa';
  end if;

  if v_variant_id is not null then
    update product_variant set stock = stock + v_qty where id = v_variant_id;
  else
    update product set stock = stock + v_qty where id = v_product_id;
  end if;

  delete from product_reservation_item where id = p_item_id;

  select count(*) into v_remaining from product_reservation_item where reservation_id = v_reservation_id;
  if v_remaining = 0 then
    update product_reservation set status = 'CANCELLED' where id = v_reservation_id;
  end if;
end;
$$;

grant execute on function cancel_reservation_item(uuid) to authenticated;

-- ---------------------------------------------------------------------
create or replace function cancel_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id    uuid;
  v_owner_tutor  uuid;
  v_status       reservation_status;
  v_caller_tutor uuid;
begin
  select tenant_id, tutor_id, status into v_tenant_id, v_owner_tutor, v_status
  from product_reservation where id = p_reservation_id;

  if v_tenant_id is null then
    raise exception 'Reserva não encontrada';
  end if;

  v_caller_tutor := my_tutor_id(v_tenant_id);
  if v_caller_tutor is null or v_caller_tutor <> v_owner_tutor then
    raise exception 'Sem permissão para cancelar esta reserva';
  end if;
  if v_status <> 'RESERVED' then
    raise exception 'Reserva não está mais ativa';
  end if;

  perform restore_reservation_stock(p_reservation_id);
  update product_reservation set status = 'CANCELLED' where id = p_reservation_id;
end;
$$;

grant execute on function cancel_reservation(uuid) to authenticated;

-- ---------------------------------------------------------------------
create or replace function refund_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status    reservation_status;
  v_total     int;
begin
  select tenant_id, status into v_tenant_id, v_status
  from product_reservation where id = p_reservation_id;

  if v_tenant_id is null then
    raise exception 'Reserva não encontrada';
  end if;
  if not is_staff(v_tenant_id) then
    raise exception 'Sem permissão para estornar esta venda';
  end if;
  if v_status <> 'COMPLETED' then
    raise exception 'Só é possível estornar uma venda concluída';
  end if;

  perform set_config('app.stock_note', 'Estorno de venda', true);
  perform restore_reservation_stock(p_reservation_id);
  perform set_config('app.stock_note', '', true);

  select coalesce(sum(quantity * price_cents), 0) into v_total
    from product_reservation_item where reservation_id = p_reservation_id;
  if v_total > 0 then
    insert into finance_entry (tenant_id, type, source, description, category, amount_cents, occurred_on)
    values (v_tenant_id, 'EXPENSE', 'RESERVATION', 'Estorno: venda de produtos (reserva)', 'produto', v_total, current_date);
  end if;

  update product_reservation set status = 'CANCELLED' where id = p_reservation_id;
end;
$$;

grant execute on function refund_reservation(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- register_stock_movement ganha p_variant_id: com variações, o ajuste
-- manual passa a ser por variação (product.stock é derivado).
-- Precisa DROPAR a versão de 4 args antes — com as duas no catálogo, a
-- chamada de 4 args viraria "function is not unique". PostgREST resolve
-- por nome, então o call existente continua válido (default null).
-- ---------------------------------------------------------------------
drop function if exists register_stock_movement(uuid, stock_movement_type, int, text);

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
  v_stock  int;
  v_has    boolean;
begin
  select tenant_id,
         exists (select 1 from product_variant v where v.product_id = p.id and v.active)
    into v_tenant, v_has
  from product p where p.id = p_product_id;

  if v_tenant is null or not is_staff(v_tenant) then
    raise exception 'Sem permissão para movimentar este produto';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantidade inválida';
  end if;
  if v_has and p_variant_id is null then
    raise exception 'Selecione a variação para movimentar o estoque';
  end if;
  if not v_has and p_variant_id is not null then
    raise exception 'Produto sem variações';
  end if;

  if p_variant_id is not null then
    select stock into v_stock from product_variant
     where id = p_variant_id and product_id = p_product_id and tenant_id = v_tenant
     for update;

    if v_stock is null then
      raise exception 'Variação não encontrada';
    end if;
    if p_type = 'OUT' and v_stock < p_quantity then
      raise exception 'Estoque insuficiente (disponível: %)', v_stock;
    end if;

    perform set_config('app.stock_note', coalesce(p_note, ''), true);
    update product_variant
       set stock = stock + case when p_type = 'IN' then p_quantity else -p_quantity end
     where id = p_variant_id;
    perform set_config('app.stock_note', '', true);
  else
    select stock into v_stock from product where id = p_product_id for update;

    if p_type = 'OUT' and v_stock < p_quantity then
      raise exception 'Estoque insuficiente (disponível: %)', v_stock;
    end if;

    perform set_config('app.stock_note', coalesce(p_note, ''), true);
    update product
       set stock = stock + case when p_type = 'IN' then p_quantity else -p_quantity end
     where id = p_product_id;
    perform set_config('app.stock_note', '', true);
  end if;
end;
$$;

grant execute on function register_stock_movement(uuid, stock_movement_type, int, text, uuid) to authenticated;
