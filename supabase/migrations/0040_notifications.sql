-- =====================================================================
-- Notificações do petshop.
--
-- O painel (pro-web) não tinha como avisar a gestão de que um tutor pediu
-- alguma coisa: quem não estivesse com a tela de Solicitações aberta só
-- descobria no próximo login. Esta migration cria o registro persistente
-- (o "sino") e a base do push do navegador.
--
-- Quem gera a notificação é o BANCO, por trigger, e não a server action:
-- o tutor cancela reserva por RPC, agenda por insert direto e avalia por
-- outro insert — centralizar no trigger garante que nenhum caminho fique
-- sem aviso, hoje ou quando surgir uma tela nova.
--
-- Destinatário é o tenant, não a pessoa: quem enxerga é qualquer papel de
-- gestão (MANAGEMENT_ROLES). O lido é individual, em notification_read,
-- porque duas pessoas do mesmo petshop leem em ritmos diferentes.
-- =====================================================================

create type notification_kind as enum (
  'BOOKING_REQUESTED',
  'BOOKING_CANCELLED',
  'RESERVATION_CREATED',
  'RESERVATION_CANCELLED',
  'RESERVATION_ITEM_CANCELLED',
  'FEEDBACK_RECEIVED'
);

create table notification (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant(id) on delete cascade,
  kind        notification_kind not null,
  -- Texto já resolvido: o nome do tutor/pet precisa sobreviver à exclusão do
  -- cadastro, e o push server-side não deveria refazer os joins.
  title       text not null,
  body        text not null,
  href        text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  -- null = ainda não saiu como push do navegador (ver dispatchPendingPush).
  pushed_at   timestamptz
);
create index on notification (tenant_id, created_at desc);
create index notification_pending_push_idx on notification (tenant_id) where pushed_at is null;

create table notification_read (
  notification_id uuid not null references notification(id) on delete cascade,
  profile_id      uuid not null references profile(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (notification_id, profile_id)
);
create index on notification_read (profile_id);

-- Uma linha por navegador/aparelho inscrito no Web Push. endpoint é a
-- identidade que o próprio serviço de push (FCM/Mozilla/WNS) devolve.
create table push_subscription (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id) on delete cascade,
  profile_id      uuid not null references profile(id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);
create index on push_subscription (tenant_id);
create index on push_subscription (profile_id);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

-- "Enxerga o painel de gestão" = MANAGEMENT_ROLES de packages/types/src/enums.ts.
-- COLLABORATOR fica de fora: ele não tem a tela de Solicitações.
create or replace function is_management(_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select has_staff_role(_tenant, array['OWNER','MANAGER','ATTENDANT','VIEWER']::staff_role[]);
$$;

create or replace function create_notification(
  _tenant uuid,
  _kind   notification_kind,
  _title  text,
  _body   text,
  _href   text,
  _meta   jsonb
) returns void language sql security definer set search_path = public as $$
  insert into notification (tenant_id, kind, title, body, href, meta)
  values (_tenant, _kind, _title, _body, _href, coalesce(_meta, '{}'::jsonb));
$$;
revoke execute on function create_notification(uuid, notification_kind, text, text, text, jsonb) from public;

-- Datas nos textos saem no fuso do petshop, não em UTC.
create or replace function br_datetime(_ts timestamptz)
returns text language sql stable set search_path = public as $$
  select to_char(_ts at time zone 'America/Sao_Paulo', 'DD/MM às HH24:MI');
$$;

-- ---------------------------------------------------------------------
-- Gatilhos: solicitação de serviço
-- ---------------------------------------------------------------------

create or replace function notify_booking_requested()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tutor text; v_pet text; v_service text;
begin
  if new.origin <> 'TUTOR' or new.status <> 'REQUESTED' then
    return new;
  end if;

  -- Um pedido com N serviços vira N appointments no mesmo request_group_id
  -- (0008). Só o primeiro da leva vira notificação — os seguintes já
  -- enxergam a linha inserida acima, por estarem na mesma transação.
  if new.request_group_id is not null and exists (
    select 1 from notification
     where kind = 'BOOKING_REQUESTED'
       and meta->>'request_group_id' = new.request_group_id::text
  ) then
    return new;
  end if;

  select full_name into v_tutor from tutor where id = new.tutor_id;
  select name into v_pet from pet where id = new.pet_id;
  select name into v_service from service_type where id = new.service_type_id;

  perform create_notification(
    new.tenant_id,
    'BOOKING_REQUESTED',
    'Nova solicitação de serviço',
    coalesce(v_tutor, 'Um tutor') || ' pediu ' || coalesce(v_service, 'um serviço')
      || ' para ' || coalesce(v_pet, 'o pet')
      || coalesce(' em ' || br_datetime(new.scheduled_at), ''),
    '/solicitacoes',
    jsonb_build_object(
      'appointment_id', new.id,
      'request_group_id', new.request_group_id,
      'tutor_id', new.tutor_id
    )
  );
  return new;
end $$;

create trigger notify_booking_requested
  after insert on appointment
  for each row execute function notify_booking_requested();

create or replace function notify_booking_cancelled()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tutor text; v_pet text; v_service text;
begin
  -- Só interessa o cancelamento feito PELO TUTOR: quando é o próprio petshop
  -- recusando, ele já sabe. auth.uid() null = rotina do servidor (cron).
  if new.status <> 'CANCELLED' or old.status = 'CANCELLED'
     or auth.uid() is null or is_staff(new.tenant_id) then
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

create trigger notify_booking_cancelled
  after update on appointment
  for each row execute function notify_booking_cancelled();

-- ---------------------------------------------------------------------
-- Gatilhos: reservas de produto
-- ---------------------------------------------------------------------

-- CONSTRAINT TRIGGER DEFERRED: reserve_products (0021) insere a reserva antes
-- dos itens. Um AFTER INSERT comum rodaria com a reserva ainda vazia e o
-- texto sairia sem a contagem de produtos; adiando para o commit, os itens
-- já estão lá.
create or replace function notify_reservation_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tutor text; v_items int; v_total int; v_first text;
begin
  if new.origin <> 'TUTOR' or new.tutor_id is null then
    return new;
  end if;

  select full_name into v_tutor from tutor where id = new.tutor_id;
  select count(*), coalesce(sum(quantity), 0)
    into v_items, v_total
    from product_reservation_item where reservation_id = new.id;
  select coalesce(p.name, ri.product_name) into v_first
    from product_reservation_item ri
    left join product p on p.id = ri.product_id
   where ri.reservation_id = new.id
   order by ri.id limit 1;

  perform create_notification(
    new.tenant_id,
    'RESERVATION_CREATED',
    'Nova reserva de produto',
    coalesce(v_tutor, 'Um tutor') || ' reservou ' || coalesce(v_first, 'produtos')
      || case when v_items > 1 then ' e mais ' || (v_items - 1) || ' item(ns)' else '' end
      || ' (' || v_total || ' un.)',
    '/solicitacoes',
    jsonb_build_object('reservation_id', new.id, 'tutor_id', new.tutor_id, 'item_count', v_items)
  );
  return new;
end $$;

create constraint trigger notify_reservation_created
  after insert on product_reservation
  deferrable initially deferred
  for each row execute function notify_reservation_created();

create or replace function notify_reservation_cancelled()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tutor text;
begin
  if new.status <> 'CANCELLED' or old.status = 'CANCELLED'
     or new.tutor_id is null
     or auth.uid() is null or is_staff(new.tenant_id) then
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

create trigger notify_reservation_cancelled
  after update on product_reservation
  for each row execute function notify_reservation_cancelled();

-- Item solto removido de uma reserva que continua ativa: o petshop precisa
-- saber para não separar a mercadoria (cancel_reservation_item, 0021, apaga
-- a linha; quando era o último item a reserva vira CANCELLED e o gatilho
-- acima é quem avisa).
create or replace function notify_reservation_item_cancelled()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tutor text; v_status reservation_status; v_tutor_id uuid;
begin
  if auth.uid() is null or is_staff(old.tenant_id) then
    return old;
  end if;

  select status, tutor_id into v_status, v_tutor_id
    from product_reservation where id = old.reservation_id;
  if v_status is distinct from 'RESERVED' then
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

create trigger notify_reservation_item_cancelled
  after delete on product_reservation_item
  for each row execute function notify_reservation_item_cancelled();

-- ---------------------------------------------------------------------
-- Gatilho: avaliação do tutor
-- ---------------------------------------------------------------------

create or replace function notify_feedback_received()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tutor text; v_pet text;
begin
  if new.direction <> 'TUTOR_TO_PETSHOP' then
    return new;
  end if;

  select t.full_name, p.name into v_tutor, v_pet
    from appointment a
    join tutor t on t.id = a.tutor_id
    join pet p on p.id = a.pet_id
   where a.id = new.appointment_id;

  perform create_notification(
    new.tenant_id,
    'FEEDBACK_RECEIVED',
    'Nova avaliação recebida',
    coalesce(v_tutor, 'Um tutor') || ' avaliou o atendimento'
      || coalesce(' de ' || v_pet, '')
      || coalesce(': ' || new.rating || ' de 5 estrelas', '.'),
    '/atendimentos/' || new.appointment_id,
    jsonb_build_object('appointment_id', new.appointment_id, 'rating', new.rating)
  );
  return new;
end $$;

create trigger notify_feedback_received
  after insert on feedback
  for each row execute function notify_feedback_received();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table notification enable row level security;
alter table notification_read enable row level security;
alter table push_subscription enable row level security;

-- Ninguém escreve à mão: quem cria é trigger (security definer) e quem marca
-- como enviada é o service_role.
create policy notification_management_select on notification
  for select using (is_management(tenant_id));

create policy notification_read_own on notification_read
  for all
  using (
    profile_id = auth.uid()
    and exists (select 1 from notification n where n.id = notification_id and is_management(n.tenant_id))
  )
  with check (
    profile_id = auth.uid()
    and exists (select 1 from notification n where n.id = notification_id and is_management(n.tenant_id))
  );

create policy push_subscription_own on push_subscription
  for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and is_management(tenant_id));

-- ---------------------------------------------------------------------
-- Leitura pelo painel
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
   where auth.uid() is not null and is_management(n.tenant_id)
   order by n.created_at desc
   limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;
grant execute on function list_notifications(int) to authenticated;

-- p_ids null = marca tudo como lido.
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
   where is_management(n.tenant_id)
     and (p_ids is null or n.id = any(p_ids))
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
grant execute on function mark_notifications_read(uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- Realtime: o sino atualiza sozinho, sem o gestor recarregar a página.
-- ---------------------------------------------------------------------

alter table notification replica identity full;
alter table notification_read replica identity full;

do $$
declare
  t text;
begin
  foreach t in array array['notification', 'notification_read']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
