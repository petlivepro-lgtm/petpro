-- =====================================================================
-- Notificações para o colaborador.
--
-- A 0040 tratava notificação como coisa do petshop inteiro: qualquer papel de
-- gestão via tudo. O colaborador tem outra necessidade — ele não confirma
-- pedido nenhum, ele executa — então precisa de aviso DIRECIONADO: o horário
-- que entrou na agenda dele, o que saiu e o que mudou de hora.
--
-- Daí a coluna recipient_profile_id:
--   null      = mural da gestão (tudo que a 0040 já criava)
--   preenchido = privado daquela pessoa, e a gestão não vê
--
-- Também corrige um engano da 0040: os gatilhos usavam `not is_staff(...)`
-- como sinônimo de "foi o tutor". Não é — a 0031 tirou o colaborador de
-- is_staff, então uma ação dele seria anunciada como se fosse do tutor. Agora
-- a checagem é direta: quem mexeu é o tutor dono do agendamento?
-- =====================================================================

alter table notification
  add column if not exists recipient_profile_id uuid references profile(id) on delete cascade;

create index if not exists notification_recipient_idx
  on notification (recipient_profile_id, created_at desc)
  where recipient_profile_id is not null;

-- ---------------------------------------------------------------------
-- create_notification ganha destinatário
-- ---------------------------------------------------------------------

drop function if exists create_notification(uuid, notification_kind, text, text, text, jsonb);

create or replace function create_notification(
  _tenant    uuid,
  _kind      notification_kind,
  _title     text,
  _body      text,
  _href      text,
  _meta      jsonb,
  _recipient uuid default null
) returns void language sql security definer set search_path = public as $$
  insert into notification (tenant_id, kind, title, body, href, meta, recipient_profile_id)
  values (_tenant, _kind, _title, _body, _href, coalesce(_meta, '{}'::jsonb), _recipient);
$$;
revoke execute on function
  create_notification(uuid, notification_kind, text, text, text, jsonb, uuid) from public;

-- Quem é o dono do login deste colaborador? null = colaborador sem acesso ao
-- painel (0031 permite cadastrar profissional sem convite) — nesse caso não há
-- para quem notificar.
create or replace function collaborator_profile(_collaborator uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select profile_id from collaborator where id = _collaborator and active;
$$;

-- ---------------------------------------------------------------------
-- RLS: destinatário vê o que é dele; gestão vê o mural
-- ---------------------------------------------------------------------

drop policy if exists notification_management_select on notification;

create policy notification_management_select on notification
  for select using (recipient_profile_id is null and is_management(tenant_id));

create policy notification_recipient_select on notification
  for select using (recipient_profile_id = auth.uid());

-- notification_read precisa aceitar as duas origens, senão o colaborador não
-- consegue marcar como lida a própria notificação.
drop policy if exists notification_read_own on notification_read;

create policy notification_read_own on notification_read
  for all
  using (
    profile_id = auth.uid()
    and exists (
      select 1 from notification n
       where n.id = notification_id
         and (n.recipient_profile_id = auth.uid()
              or (n.recipient_profile_id is null and is_management(n.tenant_id)))
    )
  )
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from notification n
       where n.id = notification_id
         and (n.recipient_profile_id = auth.uid()
              or (n.recipient_profile_id is null and is_management(n.tenant_id)))
    )
  );

-- O colaborador também precisa inscrever o navegador dele no push.
drop policy if exists push_subscription_own on push_subscription;

create policy push_subscription_own on push_subscription
  for all
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and (is_management(tenant_id) or my_collaborator_id(tenant_id) is not null)
  );

-- ---------------------------------------------------------------------
-- Leitura: uma consulta só, agora com as duas caixas
-- ---------------------------------------------------------------------

create or replace function list_notifications(p_limit int default 30)
returns table (
  id uuid,
  kind notification_kind,
  title text,
  body text,
  href text,
  created_at timestamptz,
  read boolean
) language sql stable security definer set search_path = public as $$
  select n.id, n.kind, n.title, n.body, n.href, n.created_at,
         (r.notification_id is not null) as read
    from notification n
    left join notification_read r
      on r.notification_id = n.id and r.profile_id = auth.uid()
   where auth.uid() is not null
     and (
       n.recipient_profile_id = auth.uid()
       or (n.recipient_profile_id is null and is_management(n.tenant_id))
     )
   order by n.created_at desc
   limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;
grant execute on function list_notifications(int) to authenticated;

create or replace function mark_notifications_read(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if auth.uid() is null then
    return 0;
  end if;
  insert into notification_read (notification_id, profile_id)
  select n.id, auth.uid()
    from notification n
   where (
       n.recipient_profile_id = auth.uid()
       or (n.recipient_profile_id is null and is_management(n.tenant_id))
     )
     and (p_ids is null or n.id = any(p_ids))
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
grant execute on function mark_notifications_read(uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- Correção da 0040: "foi o tutor" tem que ser afirmativo
-- ---------------------------------------------------------------------

create or replace function notify_booking_cancelled()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tutor text; v_pet text; v_service text;
begin
  -- Só quando quem cancelou é o próprio tutor dono. Antes isto era
  -- `not is_staff(...)`, que também dava verdadeiro para o colaborador.
  if new.status <> 'CANCELLED' or old.status = 'CANCELLED'
     or my_tutor_id(new.tenant_id) is distinct from new.tutor_id then
    return new;
  end if;

  select full_name into v_tutor from tutor where id = new.tutor_id;
  select name into v_pet from pet where id = new.pet_id;
  select name into v_service from service_type where id = new.service_type_id;

  perform create_notification(
    new.tenant_id,
    'BOOKING_CANCELLED',
    'Agendamento cancelado pelo tutor',
    coalesce(v_tutor, 'Um tutor') || ' cancelou ' || coalesce(v_service, 'o serviço')
      || ' de ' || coalesce(v_pet, 'seu pet')
      || coalesce(' de ' || br_datetime(new.scheduled_at), ''),
    '/atendimentos',
    jsonb_build_object('appointment_id', new.id, 'tutor_id', new.tutor_id)
  );
  return new;
end $$;

create or replace function notify_reservation_cancelled()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tutor text;
begin
  if new.status <> 'CANCELLED' or old.status = 'CANCELLED'
     or new.tutor_id is null
     or my_tutor_id(new.tenant_id) is distinct from new.tutor_id then
    return new;
  end if;

  select full_name into v_tutor from tutor where id = new.tutor_id;

  perform create_notification(
    new.tenant_id,
    'RESERVATION_CANCELLED',
    'Reserva cancelada pelo tutor',
    coalesce(v_tutor, 'Um tutor') || ' cancelou a reserva de produtos. O estoque já voltou.',
    '/solicitacoes',
    jsonb_build_object('reservation_id', new.id, 'tutor_id', new.tutor_id)
  );
  return new;
end $$;

create or replace function notify_reservation_item_cancelled()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tutor text; v_status reservation_status; v_tutor_id uuid;
begin
  select status, tutor_id into v_status, v_tutor_id
    from product_reservation where id = old.reservation_id;

  if v_status is distinct from 'RESERVED'
     or my_tutor_id(old.tenant_id) is distinct from v_tutor_id then
    return old;
  end if;

  select full_name into v_tutor from tutor where id = v_tutor_id;

  perform create_notification(
    old.tenant_id,
    'RESERVATION_ITEM_CANCELLED',
    'Item removido de uma reserva',
    coalesce(v_tutor, 'Um tutor') || ' cancelou ' || old.quantity || ' un. de '
      || coalesce(old.product_name, 'um produto') || ' na reserva.',
    '/solicitacoes',
    jsonb_build_object('reservation_id', old.reservation_id, 'tutor_id', v_tutor_id)
  );
  return old;
end $$;

-- ---------------------------------------------------------------------
-- Gatilho do colaborador
--
-- Um UPDATE pode mudar status e horário de uma vez; por isso é UM gatilho que
-- escolhe o aviso mais importante, e não três concorrendo para avisar a mesma
-- coisa três vezes. Ordem: cancelamento > confirmação > remarcação.
-- ---------------------------------------------------------------------

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
          and new.status in ('REQUESTED', 'CONFIRMED') then
      -- Passou a ser dele agora (troca de profissional).
      v_kind  := 'APPOINTMENT_ASSIGNED';
      v_title := 'Atendimento passado para você';
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

create trigger notify_collaborator_agenda
  after insert or update on appointment
  for each row execute function notify_collaborator_agenda();

notify pgrst, 'reload schema';
