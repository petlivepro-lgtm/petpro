-- =====================================================================
-- O aviso de recusa na home do tutor precisa lembrar que já foi lido, e
-- lembrar em qualquer aparelho (localStorage não serve).
--
-- A marcação é feita por RPC, não por UPDATE direto: a policy
-- reservation_tutor_update tem `with check (... status in
-- ('RESERVED','CANCELLED'))`, então o tutor não consegue gravar em uma
-- linha REJECTED — e afrouxar essa policy abriria a porta para ele mexer
-- no próprio status da reserva. SECURITY DEFINER com validação de posse
-- é o mesmo padrão de cancel_reservation (0005).
-- =====================================================================

alter table product_reservation add column rejection_seen_at timestamptz;

create or replace function mark_rejection_seen(p_reservation_id uuid)
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
  from product_reservation
  where id = p_reservation_id;

  if v_tenant_id is null then
    raise exception 'Reserva não encontrada';
  end if;

  v_caller_tutor := my_tutor_id(v_tenant_id);
  if v_caller_tutor is null or v_caller_tutor <> v_owner_tutor then
    raise exception 'Sem permissão para marcar este aviso';
  end if;
  if v_status <> 'REJECTED' then
    raise exception 'Esta reserva não foi recusada';
  end if;

  -- Idempotente: preserva o instante da primeira leitura.
  update product_reservation
     set rejection_seen_at = now()
   where id = p_reservation_id
     and rejection_seen_at is null;
end;
$$;

grant execute on function mark_rejection_seen(uuid) to authenticated;
