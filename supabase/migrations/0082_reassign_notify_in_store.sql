-- =====================================================================
-- 0082 — aviso de troca de profissional também com o pet na loja
--
-- A agenda passou a trocar o profissional arrastando o card (visão de Dia),
-- e o imprevisto que motiva a troca costuma vir com o pet já no check-in ou
-- no meio do banho. notify_collaborator_agenda (0042) só avisava a troca em
-- REQUESTED/CONFIRMED, então o novo profissional não ficava sabendo
-- justamente no caso mais urgente. Mesma função, só esse ramo ampliado.
-- =====================================================================

create or replace function notify_collaborator_agenda()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid;
  v_pet text; v_service text; v_tutor text;
  v_quando text;
  v_kind notification_kind;
  v_title text; v_body text;
  v_old_collab uuid;
begin
  if new.collaborator_id is null then
    return new;
  end if;

  v_profile := collaborator_profile(new.collaborator_id);
  if v_profile is null then
    return new;  -- profissional sem login: não há para quem avisar
  end if;

  -- Ele mesmo mexendo na própria agenda não precisa se avisar.
  if v_profile = auth.uid() then
    return new;
  end if;

  v_old_collab := case when tg_op = 'UPDATE' then old.collaborator_id else null end;

  if tg_op = 'INSERT' then
    if new.status = 'REQUESTED' then
      v_kind  := 'APPOINTMENT_REQUESTED_FOR_ME';
      v_title := 'Novo pedido escolhendo você';
    elsif new.status = 'CONFIRMED' then
      v_kind  := 'APPOINTMENT_ASSIGNED';
      v_title := 'Novo atendimento na sua agenda';
    else
      return new;
    end if;
  else
    if new.status in ('CANCELLED', 'REJECTED') and old.status not in ('CANCELLED', 'REJECTED') then
      v_kind  := 'APPOINTMENT_CANCELLED_FOR_ME';
      v_title := 'Atendimento cancelado';
    elsif new.status = 'CONFIRMED' and old.status is distinct from 'CONFIRMED' then
      v_kind  := 'APPOINTMENT_ASSIGNED';
      v_title := 'Atendimento confirmado para você';
    elsif new.collaborator_id is distinct from v_old_collab
          and new.status in ('REQUESTED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS') then
      -- Passou a ser dele agora (troca de profissional). Com o pet já na loja
      -- é o caso mais urgente: o título diz que é para agora.
      v_kind  := 'APPOINTMENT_ASSIGNED';
      v_title := case new.status
        when 'CHECKED_IN'  then 'Pet já chegou: atendimento passado para você'
        when 'IN_PROGRESS' then 'Atendimento em andamento passado para você'
        else 'Atendimento passado para você'
      end;
    elsif new.scheduled_at is distinct from old.scheduled_at
          and new.status in ('REQUESTED', 'CONFIRMED', 'CHECKED_IN') then
      v_kind  := 'APPOINTMENT_RESCHEDULED';
      v_title := 'Horário remarcado';
    else
      return new;
    end if;
  end if;

  select name into v_pet from pet where id = new.pet_id;
  select name into v_service from service_type where id = new.service_type_id;
  select full_name into v_tutor from tutor where id = new.tutor_id;
  v_quando := br_datetime(new.scheduled_at);

  v_body := coalesce(v_service, 'Atendimento') || ' de ' || coalesce(v_pet, 'um pet')
    || coalesce(' (' || v_tutor || ')', '')
    || coalesce(
         case when v_kind = 'APPOINTMENT_RESCHEDULED'
              then ' passou para ' else ' em ' end || v_quando,
         '');

  perform create_notification(
    new.tenant_id,
    v_kind,
    v_title,
    v_body,
    '/atendimentos',
    jsonb_build_object(
      'appointment_id', new.id,
      'collaborator_id', new.collaborator_id,
      'pet_id', new.pet_id
    ),
    v_profile
  );
  return new;
end $$;
