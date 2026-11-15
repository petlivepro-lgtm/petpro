-- =====================================================================
-- 0083 — tutor avisado quando o petshop muda o horário
--
-- O painel ganhou "Editar agendamento" (horário, profissional, serviço...).
-- O profissional já era avisado da remarcação (0042), mas o tutor não:
-- notify_tutor_appointment (0044/0055) só olhava mudança de status, e o pet
-- chegaria no horário antigo. Reusa o kind APPOINTMENT_RESCHEDULED (0041) —
-- quem separa tutor de profissional é o recipient_profile_id, como em 0055.
-- O gatilho já é "after update on appointment" sem lista de colunas, então
-- basta trocar a função.
-- =====================================================================

create or replace function notify_tutor_appointment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid;
  v_pet text; v_service text; v_quando text;
  v_kind notification_kind; v_title text; v_body text;
  v_dedup boolean := false;
begin
  -- Mudou o status, ou só o horário de um atendimento que ainda vai acontecer.
  if new.status = old.status and not (
    new.scheduled_at is distinct from old.scheduled_at
    and new.status in ('REQUESTED', 'CONFIRMED', 'CHECKED_IN')
  ) then
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

  if new.status = old.status then
    -- Remarcação pelo petshop (editar agendamento). Irmãos do mesmo pedido
    -- mudam juntos num UPDATE só: o dedup abaixo, pelo horário novo, deixa
    -- um aviso por pedido e ainda avisa de novo numa segunda remarcação.
    v_kind := 'APPOINTMENT_RESCHEDULED'; v_title := 'Horário alterado';
  elsif new.status = 'CONFIRMED' and old.status = 'REQUESTED' then
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

  if v_kind = 'APPOINTMENT_RESCHEDULED' and new.request_group_id is not null and exists (
    select 1 from notification
     where kind = v_kind
       and recipient_profile_id = v_profile
       and meta->>'request_group_id' = new.request_group_id::text
       and (meta->>'scheduled_at')::timestamptz = new.scheduled_at
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
    when 'APPOINTMENT_RESCHEDULED' then
      'O petshop alterou o agendamento de ' || coalesce(v_service, 'serviço')
        || ' para ' || coalesce(v_pet, 'seu pet')
        || coalesce('. Novo horário: ' || v_quando, '')
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
      'pet_id', new.pet_id,
      'scheduled_at', new.scheduled_at
    ),
    v_profile
  );
  return new;
end $$;
