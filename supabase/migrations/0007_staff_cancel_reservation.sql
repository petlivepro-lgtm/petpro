-- =====================================================================
-- O petshop (staff) pode recusar uma reserva ativa do tutor, devolvendo o
-- estoque de todos os itens. Espelha cancel_reservation (0005), mas valida
-- is_staff(tenant) em vez de my_tutor_id (a reserva pertence ao tutor, mas
-- quem cancela aqui é o staff do mesmo tenant).
-- SECURITY DEFINER: garante a movimentação atômica de estoque + status.
-- =====================================================================

create or replace function staff_cancel_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status reservation_status;
  v_item record;
begin
  select tenant_id, status into v_tenant_id, v_status
  from product_reservation
  where id = p_reservation_id;

  if v_tenant_id is null then
    raise exception 'Reserva não encontrada';
  end if;

  if not is_staff(v_tenant_id) then
    raise exception 'Sem permissão para recusar esta reserva';
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

grant execute on function staff_cancel_reservation(uuid) to authenticated;
