-- =====================================================================
-- Itens de uso interno do petshop (produtos de limpeza, shampoo próprio,
-- insumos): entram no controle de estoque mas NÃO ficam à venda no app
-- dos tutores. Reaproveita product/stock_movement/min_stock.
--   for_sale = true  -> catálogo (visível/reservável pelo tutor)
--   for_sale = false -> uso interno (somente staff)
-- =====================================================================

alter table product add column for_sale boolean not null default true;

-- Tutores só enxergam itens à venda; uso interno fica restrito ao staff.
drop policy product_read on product;
create policy product_read on product for select using (
  is_staff(tenant_id) or (active and for_sale and my_tutor_id(tenant_id) is not null)
);

-- Reserva de produto passa a recusar itens de uso interno (defesa extra: o
-- tutor não os vê via RLS, mas não pode reservá-los nem com o id em mãos).
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
    where id = v_product_id and tenant_id = p_tenant_id and for_sale
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
