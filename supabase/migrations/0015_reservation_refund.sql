-- =====================================================================
-- Estorno/reembolso de uma venda de produtos (reserva já COMPLETED).
--   * Devolve o estoque de todos os itens (o trigger product_stock_log
--     gera as entradas IN automáticas).
--   * Lança uma DESPESA compensatória em finance_entry que anula a
--     receita original (source RESERVATION, reservation_id null para não
--     conflitar com o unique da receita). A receita original permanece —
--     as duas linhas se anulam no saldo, preservando o histórico.
--   * Marca a reserva como CANCELLED.
-- Espelha staff_cancel_reservation (0007): valida is_staff no tenant e usa
-- SECURITY DEFINER para a movimentação atômica de estoque + finanças.
-- =====================================================================

create or replace function refund_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status reservation_status;
  v_total int;
  v_item record;
begin
  select tenant_id, status into v_tenant_id, v_status
  from product_reservation
  where id = p_reservation_id;

  if v_tenant_id is null then
    raise exception 'Reserva não encontrada';
  end if;
  if not is_staff(v_tenant_id) then
    raise exception 'Sem permissão para estornar esta venda';
  end if;
  if v_status <> 'COMPLETED' then
    raise exception 'Só é possível estornar uma venda concluída';
  end if;

  -- Devolve o estoque de cada item (gera movimentação IN via trigger).
  for v_item in
    select product_id, quantity from product_reservation_item where reservation_id = p_reservation_id
  loop
    update product set stock = stock + v_item.quantity where id = v_item.product_id;
  end loop;

  -- Despesa que anula a receita da venda.
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
