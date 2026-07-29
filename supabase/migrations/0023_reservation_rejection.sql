-- =====================================================================
-- Recusa da reserva pelo petshop passa a exigir motivo e a gravar
-- REJECTED (0022) em vez de CANCELLED. O tutor já enxerga a reserva por
-- reservation_tutor_select (sem filtro de status) e não consegue gravar
-- REJECTED — o with check de reservation_tutor_update segue restrito a
-- RESERVED/CANCELLED.
-- =====================================================================

alter table product_reservation
  add column rejection_reason text,
  add column rejected_at      timestamptz,
  add column rejected_by      uuid references profile(id) on delete set null;

alter table product_reservation
  add constraint product_reservation_rejection_reason_required
  check (status <> 'REJECTED' or coalesce(btrim(rejection_reason), '') <> '');

-- A assinatura passa de 1 para 2 args, o segundo SEM default: um caller
-- desatualizado falha alto em vez de recusar em silêncio sem motivo.
drop function if exists staff_cancel_reservation(uuid);

create or replace function staff_cancel_reservation(
  p_reservation_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status    reservation_status;
  v_reason    text := btrim(coalesce(p_reason, ''));
begin
  select tenant_id, status into v_tenant_id, v_status
  from product_reservation where id = p_reservation_id;

  if v_tenant_id is null then
    raise exception 'Reserva não encontrada';
  end if;
  if not is_staff(v_tenant_id) then
    raise exception 'Sem permissão para recusar esta reserva';
  end if;
  if v_status <> 'RESERVED' then
    raise exception 'Reserva não está mais ativa';
  end if;
  if v_reason = '' then
    raise exception 'Informe o motivo da recusa';
  end if;
  if length(v_reason) > 500 then
    raise exception 'Motivo muito longo (máx. 500 caracteres)';
  end if;

  perform set_config('app.stock_note', 'Reserva recusada pelo petshop', true);
  perform restore_reservation_stock(p_reservation_id);
  perform set_config('app.stock_note', '', true);

  update product_reservation
     set status           = 'REJECTED',
         rejection_reason = v_reason,
         rejected_at      = now(),
         rejected_by      = auth.uid()
   where id = p_reservation_id;
end;
$$;

grant execute on function staff_cancel_reservation(uuid, text) to authenticated;
