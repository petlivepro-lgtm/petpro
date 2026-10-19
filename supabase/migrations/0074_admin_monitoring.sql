-- =====================================================================
-- Leituras do admin-web: agregações da plataforma inteira.
--
-- Todas cruzam petshops (ignoram de propósito o recorte por tenant) e por
-- isso só a service_role executa: EXECUTE revogado de public, anon e
-- authenticated. O `revoke ... from public` é o que importa — o Postgres
-- concede EXECUTE a PUBLIC em toda função nova.
--
-- Dados pessoais de tutor e de dono saem MASCARADOS daqui. O valor inteiro
-- só sai por admin_tutor_reveal, que o admin-web chama depois de registrar
-- o motivo na auditoria.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Máscaras
-- ---------------------------------------------------------------------

create or replace function mask_email(_email text)
returns text language sql immutable set search_path = public as $$
  select case
    when _email is null or position('@' in _email) = 0 then null
    else left(split_part(_email, '@', 1), 2) || '***@' || split_part(_email, '@', 2)
  end;
$$;

/** (11) ****-**21 — mantém o DDD e os dois últimos dígitos. */
create or replace function mask_phone(_phone text)
returns text language plpgsql immutable set search_path = public as $$
declare
  d text := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
begin
  if d = '' then
    return null;
  end if;
  -- Com DDI do Brasil (55 + DDD + número), descarta o 55.
  if length(d) in (12, 13) and left(d, 2) = '55' then
    d := substr(d, 3);
  end if;
  if length(d) in (10, 11) then
    return '(' || left(d, 2) || ') ****-**' || right(d, 2);
  end if;
  return '****' || right(d, 2);
end $$;

create or replace function mask_cpf(_cpf text)
returns text language sql immutable set search_path = public as $$
  select case
    when _cpf is null then null
    when length(regexp_replace(_cpf, '\D', '', 'g')) = 11 then
      '***.' || substr(regexp_replace(_cpf, '\D', '', 'g'), 4, 3) || '.***-**'
    else '***'
  end;
$$;

-- ---------------------------------------------------------------------
-- Atividade
-- ---------------------------------------------------------------------

/**
 * Última atividade de cada petshop: o mais recente entre cadastro,
 * atendimento criado e login de alguém da equipe.
 */
create or replace function admin_tenant_activity()
returns table (tenant_id uuid, last_activity timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id,
         greatest(
           t.created_at,
           (select max(a.created_at) from appointment a where a.tenant_id = t.id),
           (select max(u.last_sign_in_at)
              from membership m join auth.users u on u.id = m.profile_id
             where m.tenant_id = t.id)
         )
    from tenant t;
$$;

/**
 * Feed de eventos da plataforma, do mais recente para o mais antigo.
 * Sem dado pessoal: diz o que o petshop fez, não com quem.
 */
create or replace function admin_activity_feed(
  p_limit  integer default 30,
  p_tenant uuid default null,
  p_kind   text default null,
  p_before timestamptz default null
) returns jsonb
language sql stable security definer set search_path = public as $$
  with ev as (
    select 'TENANT_SIGNUP' as kind, t.id as tenant_id, t.created_at as at,
           'se cadastrou na plataforma' as text
      from tenant t
    union all
    select 'APPOINTMENT_COMPLETED', a.tenant_id, a.finished_at,
           'concluiu um atendimento' || case when a.camera_id is not null then ' com câmera ao vivo' else '' end
      from appointment a where a.finished_at is not null and a.status = 'COMPLETED'
    union all
    select 'APPOINTMENT_REQUESTED', a.tenant_id, a.created_at,
           'recebeu um pedido de agendamento pelo app do tutor'
      from appointment a where a.origin = 'TUTOR'
    union all
    select 'APPOINTMENT_CANCELLED', a.tenant_id, a.cancelled_at, 'teve um atendimento cancelado'
      from appointment a where a.cancelled_at is not null
    union all
    select 'RESERVATION', r.tenant_id, r.created_at, 'recebeu uma reserva de produto'
      from product_reservation r
    union all
    select 'DELIVERY', d.tenant_id, d.started_at, 'iniciou uma rota do leva-e-traz'
      from delivery_route d where d.started_at is not null
    union all
    select 'CLUBINHO', c.tenant_id, c.created_at, 'vendeu uma assinatura do Clubinho'
      from clubinho_subscription c
    union all
    select 'TUTOR_JOINED', tu.tenant_id, tu.created_at, 'cadastrou um tutor'
      from tutor tu
    union all
    select 'SUPPORT', s.tenant_id, s.created_at,
           case when s.origin = 'TENANT' then 'abriu um chamado de suporte'
                else 'teve um chamado aberto por um tutor' end
      from support_ticket s
  )
  select coalesce(jsonb_agg(to_jsonb(x) order by x.at desc), '[]'::jsonb)
    from (
      select ev.kind, ev.tenant_id, t.name as tenant_name, ev.at, ev.text
        from ev join tenant t on t.id = ev.tenant_id
       where ev.at is not null
         and ev.at <= now()
         and (p_tenant is null or ev.tenant_id = p_tenant)
         and (p_kind is null or ev.kind = p_kind)
         and (p_before is null or ev.at < p_before)
       order by ev.at desc
       limit greatest(1, least(coalesce(p_limit, 30), 200))
    ) x;
$$;

-- ---------------------------------------------------------------------
-- Visão geral
-- ---------------------------------------------------------------------

create or replace function admin_overview(p_days integer default 30)
returns jsonb
language sql stable security definer set search_path = public as $$
  with params as (
    select greatest(1, least(coalesce(p_days, 30), 365)) as days
  ), win as (
    select now() - make_interval(days => days) as since,
           now() - make_interval(days => days * 2) as prev_since
      from params
  ), act as (
    select * from admin_tenant_activity()
  )
  select jsonb_build_object(
    'days', (select days from params),
    'tenants_total', (select count(*) from tenant),
    'tenants_active', (select count(*) from act where last_activity >= now() - interval '14 days'),
    'tenants_new', (select count(*) from tenant, win where tenant.created_at >= win.since),
    'tutors_total', (select count(distinct coalesce(profile_id::text, id::text)) from tutor),
    'tutors_app', (select count(distinct profile_id) from tutor where profile_id is not null),
    'tutors_new', (select count(*) from tutor, win where tutor.created_at >= win.since),
    'appointments', (
      select count(*) from appointment a, win
       where coalesce(a.scheduled_at, a.created_at) >= win.since
         and coalesce(a.scheduled_at, a.created_at) <= now()
         and a.status not in ('CANCELLED', 'REJECTED')),
    'appointments_prev', (
      select count(*) from appointment a, win
       where coalesce(a.scheduled_at, a.created_at) >= win.prev_since
         and coalesce(a.scheduled_at, a.created_at) < win.since
         and a.status not in ('CANCELLED', 'REJECTED')),
    'income_cents', (
      select coalesce(sum(f.amount_cents), 0) from finance_entry f, win
       where f.type = 'INCOME' and f.occurred_on >= win.since::date),
    'cameras_total', (select count(*) from camera where active),
    'gateways_total', (select count(*) from camera_gateway),
    'gateways_online', (select count(*) from camera_gateway where last_seen_at > now() - interval '3 minutes'),
    'live_now', (
      select count(*) from appointment_camera_session
       where ended_at is null and started_at > now() - interval '6 hours'),
    'mrr_cents', (
      select coalesce(sum(case when cycle = 'YEARLY' then price_cents / 12 else price_cents end), 0)
        from tenant_subscription where status in ('ACTIVE', 'PAST_DUE')),
    'support_open', (select count(*) from support_ticket where status in ('NEW', 'IN_PROGRESS')),
    'weekly_signups', (
      select jsonb_agg(jsonb_build_object(
               'week', to_char(w, 'DD/MM'),
               'count', (select count(*) from tenant
                          where created_at >= w and created_at < w + interval '7 days'))
             order by w)
        from generate_series(date_trunc('week', now()) - interval '11 weeks',
                             date_trunc('week', now()), interval '1 week') as w),
    'funnel', (
      select jsonb_build_object(
        'signed_up', count(*),
        'with_service', count(*) filter (where exists (
          select 1 from service_type s where s.tenant_id = t.id)),
        'with_appointment', count(*) filter (where exists (
          select 1 from appointment a where a.tenant_id = t.id)),
        'with_app_tutor', count(*) filter (where exists (
          select 1 from tutor tu where tu.tenant_id = t.id and tu.profile_id is not null)))
        from tenant t where t.created_at >= now() - interval '90 days'),
    'stalled_total', (select count(*) from act where last_activity < now() - interval '14 days'),
    'stalled', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', s.tenant_id,
               'name', t.name,
               'address', t.settings ->> 'address',
               'last_activity', s.last_activity,
               'appointments_30d', (select count(*) from appointment a
                                     where a.tenant_id = s.tenant_id
                                       and a.created_at >= now() - interval '30 days'))
             order by s.last_activity), '[]'::jsonb)
        from (select * from act where last_activity < now() - interval '14 days'
               order by last_activity limit 8) s
        join tenant t on t.id = s.tenant_id),
    'feed', admin_activity_feed(8, null, null, null)
  );
$$;

-- ---------------------------------------------------------------------
-- Petshops
-- ---------------------------------------------------------------------

/**
 * Lista de petshops. p_filter: 'all' | 'active' | 'stalled' | 'new'.
 * "Novo" = cadastrado há até 30 dias; "parado" = sem atividade há 14+ dias.
 */
create or replace function admin_tenant_list(
  p_search text default null,
  p_filter text default 'all',
  p_limit  integer default 25,
  p_offset integer default 0
) returns jsonb
language sql stable security definer set search_path = public as $$
  with base as (
    select t.id, t.name, t.slug, t.created_at,
           t.settings ->> 'address' as address,
           o.full_name as owner_name,
           ou.email as owner_email_raw,
           act.last_activity,
           (select count(*) from tutor tu where tu.tenant_id = t.id) as tutors,
           (select count(*) from appointment a
             where a.tenant_id = t.id and a.created_at >= now() - interval '30 days'
               and a.status not in ('CANCELLED', 'REJECTED')) as appointments_30d,
           (select count(*) from camera c where c.tenant_id = t.id and c.active) as cameras,
           (select g.last_seen_at from camera_gateway g where g.tenant_id = t.id) as gateway_seen_at,
           exists (select 1 from clubinho_subscription cs where cs.tenant_id = t.id) as uses_clubinho,
           exists (select 1 from delivery_route d where d.tenant_id = t.id) as uses_delivery,
           exists (select 1 from product p where p.tenant_id = t.id) as uses_store,
           (select s.status from tenant_subscription s where s.tenant_id = t.id) as subscription_status
      from tenant t
      join admin_tenant_activity() act on act.tenant_id = t.id
      left join lateral (
        select m.profile_id from membership m
         where m.tenant_id = t.id and m.role = 'OWNER'
         order by m.created_at limit 1
      ) om on true
      left join profile o on o.id = om.profile_id
      left join auth.users ou on ou.id = om.profile_id
  ), classified as (
    select b.*,
           case when b.created_at >= now() - interval '30 days' then 'new'
                when b.last_activity < now() - interval '14 days' then 'stalled'
                else 'active' end as state
      from base b
  ), searched as (
    select * from classified c
     where coalesce(btrim(p_search), '') = ''
        or strpos(lower(c.name), lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(c.owner_name, '')), lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(c.owner_email_raw, '')), lower(btrim(p_search))) > 0
        or strpos(lower(coalesce(c.address, '')), lower(btrim(p_search))) > 0
  ), filtered as (
    select * from searched
     where coalesce(p_filter, 'all') = 'all' or state = p_filter
  )
  select jsonb_build_object(
    'counts', (select jsonb_build_object(
                 'all', count(*),
                 'active', count(*) filter (where state = 'active'),
                 'stalled', count(*) filter (where state = 'stalled'),
                 'new', count(*) filter (where state = 'new'))
               from searched),
    'total', (select count(*) from filtered),
    'rows', (select coalesce(jsonb_agg(
                      (to_jsonb(r) - 'owner_email_raw')
                      || jsonb_build_object('owner_email', mask_email(r.owner_email_raw))
                    order by r.last_activity desc), '[]'::jsonb)
               from (select * from filtered
                      order by last_activity desc
                      limit greatest(1, least(coalesce(p_limit, 25), 100))
                      offset greatest(0, coalesce(p_offset, 0))) r)
  );
$$;

create or replace function admin_tenant_detail(p_tenant uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not exists (select 1 from tenant where id = p_tenant) then null else
  jsonb_build_object(
    'tenant', (select jsonb_build_object(
                 'id', t.id, 'name', t.name, 'slug', t.slug, 'created_at', t.created_at,
                 'address', t.settings ->> 'address', 'phone', t.settings ->> 'phone')
               from tenant t where t.id = p_tenant),
    'last_activity', (select last_activity from admin_tenant_activity() where tenant_id = p_tenant),
    'owner', (select jsonb_build_object(
                'name', p.full_name, 'email', mask_email(u.email),
                'last_sign_in_at', u.last_sign_in_at)
                from membership m
                left join profile p on p.id = m.profile_id
                left join auth.users u on u.id = m.profile_id
               where m.tenant_id = p_tenant and m.role = 'OWNER'
               order by m.created_at limit 1),
    'kpis', jsonb_build_object(
      'tutors', (select count(*) from tutor where tenant_id = p_tenant),
      'tutors_app', (select count(*) from tutor where tenant_id = p_tenant and profile_id is not null),
      'pets', (select count(*) from pet where tenant_id = p_tenant),
      'appointments_30d', (select count(*) from appointment
                            where tenant_id = p_tenant and created_at >= now() - interval '30 days'
                              and status not in ('CANCELLED', 'REJECTED')),
      'income_30d_cents', (select coalesce(sum(amount_cents), 0) from finance_entry
                            where tenant_id = p_tenant and type = 'INCOME'
                              and occurred_on >= current_date - 30),
      'clubinho_active', (select count(*) from clubinho_subscription
                           where tenant_id = p_tenant and status = 'ACTIVE'),
      'services', (select count(*) from service_type where tenant_id = p_tenant and active),
      'cameras', (select count(*) from camera where tenant_id = p_tenant and active)),
    'modules', jsonb_build_object(
      'appointments_30d', (select count(*) from appointment
                            where tenant_id = p_tenant and created_at >= now() - interval '30 days'),
      'camera_sessions_30d', (select count(*) from appointment_camera_session
                               where tenant_id = p_tenant and started_at >= now() - interval '30 days'),
      'clubinho_active', (select count(*) from clubinho_subscription
                           where tenant_id = p_tenant and status = 'ACTIVE'),
      'delivery_routes_30d', (select count(*) from delivery_route
                               where tenant_id = p_tenant and route_date >= current_date - 30),
      'reservations_30d', (select count(*) from product_reservation
                            where tenant_id = p_tenant and created_at >= now() - interval '30 days'),
      'behavior_reports_30d', (select count(*) from pet_behavior_report
                                where tenant_id = p_tenant and created_at >= now() - interval '30 days')),
    'team', (select coalesce(jsonb_agg(jsonb_build_object(
                      'name', p.full_name, 'email', mask_email(u.email), 'role', m.role,
                      'last_sign_in_at', u.last_sign_in_at)
                    order by m.role, p.full_name), '[]'::jsonb)
               from membership m
               left join profile p on p.id = m.profile_id
               left join auth.users u on u.id = m.profile_id
              where m.tenant_id = p_tenant),
    'gateway', (select jsonb_build_object('last_seen_at', g.last_seen_at, 'created_at', g.created_at)
                  from camera_gateway g where g.tenant_id = p_tenant),
    'cameras', (select coalesce(jsonb_agg(jsonb_build_object(
                         'id', c.id, 'room_label', c.room_label, 'active', c.active,
                         'live', exists (select 1 from appointment_camera_session s
                                          where s.camera_id = c.id and s.ended_at is null
                                            and s.started_at > now() - interval '6 hours'),
                         'last_session_at', (select max(s.started_at) from appointment_camera_session s
                                              where s.camera_id = c.id))
                       order by c.room_label), '[]'::jsonb)
                  from camera c where c.tenant_id = p_tenant),
    'subscription', (select jsonb_build_object(
                       'status', s.status, 'price_cents', s.price_cents, 'cycle', s.cycle,
                       'plan', pl.name, 'trial_ends_at', s.trial_ends_at,
                       'current_period_end', s.current_period_end)
                       from tenant_subscription s
                       left join platform_plan pl on pl.id = s.plan_id
                      where s.tenant_id = p_tenant),
    'support_open', (select count(*) from support_ticket
                      where tenant_id = p_tenant and status in ('NEW', 'IN_PROGRESS', 'WAITING_CUSTOMER')),
    'timeline', admin_activity_feed(15, p_tenant, null, null)
  ) end;
$$;

-- ---------------------------------------------------------------------
-- Tutores
-- ---------------------------------------------------------------------

/**
 * Pessoas tutoras da plataforma. Uma pessoa com conta no app (profile_id)
 * aparece uma vez só, com todos os petshops em que tem ficha; fichas sem
 * conta aparecem uma a uma. p_app: 'all' | 'app' | 'never'.
 */
create or replace function admin_tutor_list(
  p_search text default null,
  p_tenant uuid default null,
  p_app    text default 'all',
  p_limit  integer default 25,
  p_offset integer default 0
) returns jsonb
language sql stable security definer set search_path = public as $$
  with rows as (
    select coalesce(tu.profile_id::text, tu.id::text) as person,
           tu.id, tu.full_name, tu.email, tu.phone, tu.phone_digits, tu.cpf,
           tu.created_at, tu.tenant_id, t.name as tenant_name, tu.profile_id,
           (select count(*) from pet p where p.tutor_id = tu.id) as pets
      from tutor tu join tenant t on t.id = tu.tenant_id
  ), people as (
    select r.person,
           (array_agg(r.id order by r.created_at))[1] as tutor_id,
           (array_agg(r.full_name order by r.created_at))[1] as full_name,
           (array_agg(r.email order by r.created_at) filter (where r.email is not null))[1] as email,
           (array_agg(r.phone order by r.created_at) filter (where r.phone is not null))[1] as phone,
           string_agg(coalesce(r.phone_digits, ''), ' ') as phone_digits_all,
           (array_agg(r.cpf order by r.created_at) filter (where r.cpf is not null))[1] as cpf,
           min(r.created_at) as since,
           (array_agg(r.profile_id) filter (where r.profile_id is not null))[1] as profile_id,
           array_agg(distinct r.tenant_name) as shops,
           array_agg(distinct r.tenant_id) as tenant_ids,
           sum(r.pets) as pets
      from rows r group by r.person
  ), enriched as (
    select p.*, coalesce(p.email, u.email) as email_any, u.last_sign_in_at
      from people p left join auth.users u on u.id = p.profile_id
  ), filtered as (
    select * from enriched e
     where (coalesce(btrim(p_search), '') = ''
            or strpos(lower(e.full_name), lower(btrim(p_search))) > 0
            or strpos(lower(coalesce(e.email_any, '')), lower(btrim(p_search))) > 0
            or (length(regexp_replace(p_search, '\D', '', 'g')) >= 4
                and strpos(e.phone_digits_all, regexp_replace(p_search, '\D', '', 'g')) > 0))
       and (p_tenant is null or p_tenant = any (e.tenant_ids))
       and (coalesce(p_app, 'all') = 'all'
            or (p_app = 'app' and e.last_sign_in_at is not null)
            or (p_app = 'never' and e.last_sign_in_at is null))
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
                      'tutor_id', f.tutor_id,
                      'full_name', f.full_name,
                      'email', mask_email(f.email_any),
                      'phone', mask_phone(f.phone),
                      'cpf', mask_cpf(f.cpf),
                      'since', f.since,
                      'shops', to_jsonb(f.shops),
                      'pets', f.pets,
                      'last_sign_in_at', f.last_sign_in_at,
                      'has_account', f.profile_id is not null)
                    order by f.since desc), '[]'::jsonb)
               from (select * from filtered order by since desc
                      limit greatest(1, least(coalesce(p_limit, 25), 100))
                      offset greatest(0, coalesce(p_offset, 0))) f)
  );
$$;

/** Um campo pessoal inteiro de um tutor. O admin-web audita ANTES de chamar. */
create or replace function admin_tutor_reveal(p_tutor uuid, p_field text)
returns text
language sql stable security definer set search_path = public as $$
  select case p_field
           when 'phone' then tu.phone
           when 'cpf'   then tu.cpf
           when 'email' then coalesce(tu.email, u.email)
         end
    from tutor tu left join auth.users u on u.id = tu.profile_id
   where tu.id = p_tutor;
$$;

/** E-mail de conta (do dono ou do tutor) para disparar o link de senha. */
create or replace function admin_account_email(p_tenant uuid, p_tutor uuid)
returns text
language sql stable security definer set search_path = public as $$
  select case
    when p_tutor is not null then (
      select u.email from tutor tu join auth.users u on u.id = tu.profile_id where tu.id = p_tutor)
    else (
      select u.email from membership m join auth.users u on u.id = m.profile_id
       where m.tenant_id = p_tenant and m.role = 'OWNER' order by m.created_at limit 1)
  end;
$$;

-- ---------------------------------------------------------------------
-- Identidade, câmeras, financeiro
-- ---------------------------------------------------------------------

/** "Quem é este e-mail?" — conta, vínculos de staff, fichas de tutor e admin. */
create or replace function admin_identity_lookup(p_email text)
returns jsonb
language sql stable security definer set search_path = public as $$
  with u as (
    select * from auth.users where lower(email) = lower(btrim(p_email)) limit 1
  )
  select jsonb_build_object(
    'email', lower(btrim(p_email)),
    'user', (select jsonb_build_object(
               'created_at', u.created_at,
               'last_sign_in_at', u.last_sign_in_at,
               'confirmed', u.email_confirmed_at is not null,
               'mfa_factors', (select count(*) from auth.mfa_factors f
                                where f.user_id = u.id and f.status = 'verified'))
               from u),
    'memberships', (select coalesce(jsonb_agg(jsonb_build_object(
                             'tenant_id', t.id, 'tenant_name', t.name, 'role', m.role,
                             'since', m.created_at) order by m.created_at), '[]'::jsonb)
                      from u join membership m on m.profile_id = u.id
                      join tenant t on t.id = m.tenant_id),
    'tutor_rows', (select coalesce(jsonb_agg(jsonb_build_object(
                            'tutor_id', tu.id, 'tenant_id', t.id, 'tenant_name', t.name,
                            'linked_account', tu.profile_id is not null,
                            'since', tu.created_at) order by tu.created_at), '[]'::jsonb)
                     from tutor tu join tenant t on t.id = tu.tenant_id
                    where tu.profile_id = (select id from u)
                       or lower(tu.email) = lower(btrim(p_email))),
    'admin', (select jsonb_build_object('role', a.role, 'status', a.status)
                from platform_admin a where a.user_id = (select id from u))
  );
$$;

create or replace function admin_camera_overview()
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.online nulls first, x.name), '[]'::jsonb)
    from (
      select t.id, t.name,
             g.last_seen_at,
             case when g.tenant_id is null then null
                  else g.last_seen_at > now() - interval '3 minutes' end as online,
             (select count(*) from camera c where c.tenant_id = t.id and c.active) as cameras,
             (select count(*) from appointment_camera_session s
               where s.tenant_id = t.id and s.ended_at is null
                 and s.started_at > now() - interval '6 hours') as live_now,
             (select count(*) from appointment_camera_session s
               where s.tenant_id = t.id and s.started_at > now() - interval '7 days') as sessions_7d
        from tenant t
        left join camera_gateway g on g.tenant_id = t.id
       where g.tenant_id is not null
          or exists (select 1 from camera c where c.tenant_id = t.id)
    ) x;
$$;

create or replace function admin_billing_overview()
returns jsonb
language sql stable security definer set search_path = public as $$
  with subs as (
    select s.*, t.name as tenant_name, pl.name as plan_name,
           case when s.cycle = 'YEARLY' then s.price_cents / 12 else s.price_cents end as monthly_cents
      from tenant_subscription s
      join tenant t on t.id = s.tenant_id
      left join platform_plan pl on pl.id = s.plan_id
  )
  select jsonb_build_object(
    'mrr_cents', (select coalesce(sum(monthly_cents), 0) from subs where status in ('ACTIVE', 'PAST_DUE')),
    'active', (select count(*) from subs where status = 'ACTIVE'),
    'trialing', (select count(*) from subs where status = 'TRIALING'),
    'trial_ending_7d', (select count(*) from subs
                         where status = 'TRIALING' and trial_ends_at < now() + interval '7 days'),
    'past_due', (select count(*) from subs where status = 'PAST_DUE'),
    'past_due_cents', (select coalesce(sum(i.amount_cents), 0) from subscription_invoice i
                        where i.status in ('FAILED', 'PENDING') and i.due_date < current_date),
    'cancelled_month', (select count(*) from subs where cancelled_at >= date_trunc('month', now())),
    'total', (select count(*) from subs),
    'by_plan', (select coalesce(jsonb_agg(jsonb_build_object(
                         'plan', coalesce(plan_name, 'Sem plano'), 'count', n, 'mrr_cents', mrr)
                       order by mrr desc), '[]'::jsonb)
                  from (select plan_name, count(*) as n, sum(monthly_cents) as mrr
                          from subs where status in ('ACTIVE', 'PAST_DUE')
                         group by plan_name) p),
    'mrr_series', (select jsonb_agg(jsonb_build_object(
                            'month', to_char(m, 'MM/YY'),
                            'mrr_cents', (select coalesce(sum(s.monthly_cents), 0) from subs s
                                           where s.status <> 'TRIALING'
                                             and s.created_at < m + interval '1 month'
                                             and (s.cancelled_at is null
                                                  or s.cancelled_at >= m + interval '1 month')))
                          order by m)
                     from generate_series(date_trunc('month', now()) - interval '11 months',
                                          date_trunc('month', now()), interval '1 month') m),
    'failed_recent', (select coalesce(jsonb_agg(jsonb_build_object(
                               'tenant_name', t.name, 'amount_cents', i.amount_cents,
                               'due_date', i.due_date, 'reason', i.failure_reason)
                             order by i.due_date desc), '[]'::jsonb)
                        from subscription_invoice i join tenant t on t.id = i.tenant_id
                       where i.status = 'FAILED' and i.created_at > now() - interval '7 days'),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
                      'tenant_id', s.tenant_id, 'tenant_name', s.tenant_name,
                      'plan', s.plan_name, 'price_cents', s.price_cents, 'cycle', s.cycle,
                      'status', s.status, 'trial_ends_at', s.trial_ends_at,
                      'current_period_end', s.current_period_end,
                      'payment_method', s.payment_method, 'card_brand', s.card_brand,
                      'card_last4', s.card_last4, 'created_at', s.created_at)
                    order by s.created_at desc), '[]'::jsonb)
               from subs s)
  );
$$;

-- ---------------------------------------------------------------------
-- Só a service_role executa
-- ---------------------------------------------------------------------

revoke execute on function mask_email(text) from public, anon, authenticated;
revoke execute on function mask_phone(text) from public, anon, authenticated;
revoke execute on function mask_cpf(text) from public, anon, authenticated;
revoke execute on function admin_tenant_activity() from public, anon, authenticated;
revoke execute on function admin_activity_feed(integer, uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function admin_overview(integer) from public, anon, authenticated;
revoke execute on function admin_tenant_list(text, text, integer, integer) from public, anon, authenticated;
revoke execute on function admin_tenant_detail(uuid) from public, anon, authenticated;
revoke execute on function admin_tutor_list(text, uuid, text, integer, integer) from public, anon, authenticated;
revoke execute on function admin_tutor_reveal(uuid, text) from public, anon, authenticated;
revoke execute on function admin_account_email(uuid, uuid) from public, anon, authenticated;
revoke execute on function admin_identity_lookup(text) from public, anon, authenticated;
revoke execute on function admin_camera_overview() from public, anon, authenticated;
revoke execute on function admin_billing_overview() from public, anon, authenticated;

grant execute on function mask_email(text), mask_phone(text), mask_cpf(text),
  admin_tenant_activity(), admin_activity_feed(integer, uuid, text, timestamptz),
  admin_overview(integer), admin_tenant_list(text, text, integer, integer),
  admin_tenant_detail(uuid), admin_tutor_list(text, uuid, text, integer, integer),
  admin_tutor_reveal(uuid, text), admin_account_email(uuid, uuid),
  admin_identity_lookup(text), admin_camera_overview(), admin_billing_overview()
  to service_role;
