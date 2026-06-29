-- =====================================================================
-- Reservas de produto passam a debitar/devolver estoque de forma atômica.
-- SECURITY DEFINER: tutor não tem UPDATE em `product` (policy product_staff),
-- então a movimentação de estoque roda com privilégio elevado, validando a
-- posse da reserva manualmente (mesmo padrão de is_staff/my_tutor_id).
-- =====================================================================

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
  v_tutor_id uuid;
  v_reservation_id uuid;
  v_item jsonb;
  v_product_id uuid;
  v_qty int;
  v_stock int;
  v_price int;
begin
  v_tutor_id := my_tutor_id(p_tenant_id);
  if v_tutor_id is null then
    raise exception 'Tutor não encontrado para este tenant';
  end if;

  insert into product_reservation (tenant_id, tutor_id, status, note, expires_at)
  values (p_tenant_id, v_tutor_id, 'RESERVED', p_note, now() + interval '48 hours')
  returning id into v_reservation_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::int;

    select stock, price_cents into v_stock, v_price
    from product
    where id = v_product_id and tenant_id = p_tenant_id
    for update;

    if v_stock is null then
      raise exception 'Produto não encontrado';
    end if;
    if v_stock < v_qty then
      raise exception 'Estoque insuficiente para o produto %', v_product_id;
    end if;

    update product set stock = stock - v_qty where id = v_product_id;

    insert into product_reservation_item (tenant_id, reservation_id, product_id, quantity, price_cents)
    values (p_tenant_id, v_reservation_id, v_product_id, v_qty, v_price);
  end loop;

  return v_reservation_id;
end;
$$;

grant execute on function reserve_products(uuid, jsonb, text) to authenticated;

create or replace function cancel_reservation_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_reservation_id uuid;
  v_product_id uuid;
  v_qty int;
  v_owner_tutor uuid;
  v_status reservation_status;
  v_caller_tutor uuid;
  v_remaining int;
begin
  select ri.tenant_id, ri.reservation_id, ri.product_id, ri.quantity, r.tutor_id, r.status
    into v_tenant_id, v_reservation_id, v_product_id, v_qty, v_owner_tutor, v_status
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

  update product set stock = stock + v_qty where id = v_product_id;
  delete from product_reservation_item where id = p_item_id;

  select count(*) into v_remaining from product_reservation_item where reservation_id = v_reservation_id;
  if v_remaining = 0 then
    update product_reservation set status = 'CANCELLED' where id = v_reservation_id;
  end if;
end;
$$;

grant execute on function cancel_reservation_item(uuid) to authenticated;

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
  v_caller_tutor uuid;
  v_item record;
begin
  select tenant_id, tutor_id, status into v_tenant_id, v_owner_tutor, v_status
  from product_reservation
  where id = p_reservation_id;

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

  for v_item in
    select product_id, quantity from product_reservation_item where reservation_id = p_reservation_id
  loop
    update product set stock = stock + v_item.quantity where id = v_item.product_id;
  end loop;

  update product_reservation set status = 'CANCELLED' where id = p_reservation_id;
end;
$$;

grant execute on function cancel_reservation(uuid) to authenticated;
