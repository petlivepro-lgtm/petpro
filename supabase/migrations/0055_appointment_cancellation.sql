-- =====================================================================
-- Cancelar um agendamento já aceito, com motivo — pelo petshop e pelo
-- tutor. Até aqui só existia a recusa de um pedido ainda não aceito
-- (REJECTED, na tela de Solicitações): depois de confirmado, o horário
-- ficava travado na agenda do profissional.
--
-- O resto do caminho já existia: a policy appointment_tutor_cancel
-- (0001) autoriza o tutor a gravar CANCELLED, notify_booking_cancelled
-- (0040) avisa o petshop quando é o tutor quem cancela e
-- notify_collaborator_agenda (0042) avisa o profissional. O slot volta a
-- ficar livre sozinho: check_collaborator_slot (0014) e get_busy_slots
-- ignoram CANCELLED.
-- =====================================================================

-- cancelled_at, cancelled_by e cancellation_reason já existem desde a 0026
-- (nasceram junto com o financeiro e nunca chegaram a ser escritas). Falta
-- só saber de que lado do balcão veio o cancelamento.
alter table appointment
  add column cancelled_by_role text check (cancelled_by_role in ('TUTOR','STAFF'));

-- Cancelamento sem motivo não serve para ninguém: o tutor precisa saber por
-- que o petshop desmarcou, e o petshop precisa saber por que o tutor desistiu.
-- Fecha também o update direto pela API que a policy do tutor permite.
alter table appointment
  add constraint appointment_cancellation_reason_required
  check (status <> 'CANCELLED' or coalesce(btrim(cancellation_reason), '') <> '');

-- ---------------------------------------------------------------------
-- Cancelamento em si. Recebe uma lista porque um pedido pode ter vários
-- serviços irmãos no mesmo horário (request_group_id) e o comum é querer
-- desmarcar todos de uma vez.
--
-- SECURITY DEFINER pelo mesmo motivo de staff_cancel_reservation (0023):
-- a regra de quem pode cancelar o quê mora aqui, num lugar só, valendo
-- igual para o app do petshop e o do tutor. auth.uid() continua sendo o de
-- quem chamou, então os gatilhos de notificação distinguem os dois.
-- ---------------------------------------------------------------------
create or replace function cancel_appointment(
  p_appointment_ids uuid[],
  p_reason text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason  text := btrim(coalesce(p_reason, ''));
  v_total   int  := coalesce(array_length(p_appointment_ids, 1), 0);
  v_tenant  uuid;
  v_tutor   uuid;
  v_groups  int;
  v_role    text;
  v_found   int;
  v_bad     int;
begin
  if v_total = 0 then
    raise exception 'Nenhum atendimento informado';
  end if;
  if length(v_reason) < 3 then
    raise exception 'Escreva o motivo do cancelamento';
  end if;
  if length(v_reason) > 500 then
    raise exception 'Motivo muito longo (máx. 500 caracteres)';
  end if;

  select count(*), count(distinct tenant_id),
         count(distinct coalesce(request_group_id, id))
    into v_found, v_bad, v_groups
    from appointment where id = any(p_appointment_ids);

  if v_found <> v_total then
    raise exception 'Atendimento não encontrado';
  end if;
  if v_bad > 1 then
    raise exception 'Atendimentos de petshops diferentes';
  end if;
  -- Lote só existe para irmãos do mesmo pedido; fora disso, um id por vez.
  if v_total > 1 and v_groups > 1 then
    raise exception 'Os atendimentos não são do mesmo pedido';
  end if;

  select tenant_id into v_tenant from appointment where id = p_appointment_ids[1];
  v_tutor := my_tutor_id(v_tenant);

  if is_staff(v_tenant) then
    v_role := 'STAFF';
  elsif v_tutor is not null and not exists (
    select 1 from appointment a
    where a.id = any(p_appointment_ids) and a.tutor_id is distinct from v_tutor
  ) then
    v_role := 'TUTOR';
  else
    raise exception 'Sem permissão para cancelar este atendimento';
  end if;

  -- Depois de iniciado, o caminho é finalizar: cancelar deixaria fotos,
  -- passos e boletim órfãos. O tutor ainda tem o limite do relógio.
  if v_role = 'STAFF' then
    select count(*) into v_bad from appointment
     where id = any(p_appointment_ids) and status not in ('CONFIRMED','CHECKED_IN');
    if v_bad > 0 then
      raise exception 'Só dá para cancelar um atendimento confirmado que ainda não começou';
    end if;
  else
    select count(*) into v_bad from appointment
     where id = any(p_appointment_ids) and status not in ('REQUESTED','CONFIRMED');
    if v_bad > 0 then
      raise exception 'Este atendimento não pode mais ser cancelado pelo app. Fale com o petshop';
    end if;
    select count(*) into v_bad from appointment
     where id = any(p_appointment_ids)
       and (scheduled_at is null or scheduled_at <= now());
    if v_bad > 0 then
      raise exception 'O horário deste atendimento já chegou. Fale com o petshop';
    end if;
  end if;

  update appointment
     set status              = 'CANCELLED',
         cancellation_reason = v_reason,
         cancelled_at        = now(),
         cancelled_by        = auth.uid(),
         cancelled_by_role   = v_role
   where id = any(p_appointment_ids);

  return v_total;
end;
$$;

revoke execute on function cancel_appointment(uuid[], text) from public;
grant execute on function cancel_appointment(uuid[], text) to authenticated;

-- ---------------------------------------------------------------------
-- O tutor já era avisado de confirmação, recusa e finalização (0044); só
-- faltava o petshop cancelando um agendamento dele. Reusa o kind
-- BOOKING_CANCELLED, que já existe no enum (0040) — lá ele endereça o
-- petshop, aqui o tutor; quem separa é o recipient_profile_id.
-- ---------------------------------------------------------------------
create or replace function notify_tutor_appointment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid;
  v_pet text; v_service text; v_quando text;
  v_kind notification_kind; v_title text; v_body text;
  v_dedup boolean := false;
begin
  if new.status = old.status then
    return new;
  end if;

  v_profile := tutor_profile(new.tutor_id);
  if v_profile is null then
    return new;  -- tutor sem acesso ao app
  end if;

  -- Se quem mexeu foi o próprio tutor, ele já sabe.
  if my_tutor_id(new.tenant_id) = new.tutor_id then
    return new;
  end if;

  if new.status = 'CONFIRMED' and old.status = 'REQUESTED' then
    v_kind := 'BOOKING_CONFIRMED'; v_title := 'Agendamento confirmado'; v_dedup := true;
  elsif new.status = 'REJECTED' then
    v_kind := 'BOOKING_REJECTED'; v_title := 'Pedido não aceito'; v_dedup := true;
  elsif new.status = 'CANCELLED' then
    v_kind := 'BOOKING_CANCELLED'; v_title := 'Agendamento cancelado'; v_dedup := true;
  elsif new.status = 'COMPLETED' then
    v_kind := 'BOOKING_COMPLETED'; v_title := 'Atendimento finalizado';
  else
    return new;
  end if;

  if v_dedup and new.request_group_id is not null and exists (
    select 1 from notification
     where kind = v_kind
       and recipient_profile_id = v_profile
       and meta->>'request_group_id' = new.request_group_id::text
  ) then
    return new;
  end if;

  select name into v_pet from pet where id = new.pet_id;
  select name into v_service from service_type where id = new.service_type_id;
  v_quando := br_datetime(new.scheduled_at);

  -- Os textos começam por um substantivo masculino fixo ("agendamento",
  -- "pedido", "atendimento") de propósito: o nome do serviço é livre e pode
  -- ter qualquer gênero, e "Hidratação está confirmado" sairia errado.
  v_body := case v_kind
    when 'BOOKING_CONFIRMED' then
      'Seu agendamento de ' || coalesce(v_service, 'serviço') || ' para '
        || coalesce(v_pet, 'seu pet')
        || coalesce(' está confirmado para ' || v_quando, ' foi confirmado')
    when 'BOOKING_REJECTED' then
      'Seu pedido de ' || coalesce(v_service, 'serviço') || ' para '
        || coalesce(v_pet, 'seu pet') || ' não pôde ser aceito. Fale com o petshop.'
    when 'BOOKING_CANCELLED' then
      'O petshop cancelou o agendamento de ' || coalesce(v_service, 'serviço')
        || ' para ' || coalesce(v_pet, 'seu pet')
        || coalesce(' de ' || v_quando, '')
        || coalesce('. Motivo: ' || new.cancellation_reason, '')
    else
      'O atendimento de ' || coalesce(v_pet, 'seu pet')
        || coalesce(' (' || v_service || ')', '')
        || ' foi finalizado. Já pode buscar!'
  end;

  perform create_notification(
    new.tenant_id,
    v_kind,
    v_title,
    v_body,
    '/atendimentos',
    jsonb_build_object(
      'appointment_id', new.id,
      'request_group_id', new.request_group_id,
      'pet_id', new.pet_id
    ),
    v_profile
  );
  return new;
end $$;
