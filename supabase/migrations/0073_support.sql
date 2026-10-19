-- =====================================================================
-- Suporte da plataforma: chamados de petshops e tutores para a equipe do
-- Pet Live Pro (atendidos no apps/admin-web).
--
-- Quem resolve o quê:
--   * o PETSHOP (dono e gerente) abre chamado sobre a plataforma: câmeras,
--     erro, assinatura, dúvida de uso, sugestão, dados;
--   * o TUTOR só abre chamado sobre o app (acesso, câmera ao vivo,
--     notificações, erro, dados) ou para denunciar um problema grave com o
--     petshop. Assuntos do petshop (agenda, valores, cuidado com o pet) são
--     desviados no app para o WhatsApp do próprio petshop, sem chamado;
--   * a denúncia (PETSHOP_REPORT) nasce oculta do petshop.
--
-- Leitura do cliente por RLS (só os próprios chamados, nunca nota interna);
-- escrita só pelas RPCs abaixo. O admin lê e escreve com service_role.
-- =====================================================================

create sequence support_ticket_number_seq start 1001;

create table support_ticket (
  id                       uuid primary key default gen_random_uuid(),
  -- Só rótulo para conversa humana (#1042). O acesso é sempre pelo uuid.
  number                   integer not null unique default nextval('support_ticket_number_seq'),
  origin                   text not null check (origin in ('TENANT', 'TUTOR')),
  tenant_id                uuid not null references tenant(id) on delete cascade,
  opened_by                uuid references auth.users(id) on delete set null,
  -- Fotografia de quem abriu: o admin não precisa ler auth.users para saber.
  opened_by_name           text,
  opened_by_email          text,
  category                 text not null check (category in (
                             'CAMERAS', 'BUG', 'BILLING', 'HOW_TO', 'SUGGESTION', 'PRIVACY',
                             'ACCESS', 'LIVE_CAMERA', 'NOTIFICATIONS', 'PETSHOP_REPORT', 'OTHER')),
  subject                  text not null check (char_length(btrim(subject)) between 3 and 140),
  status                   text not null default 'NEW' check (status in (
                             'NEW', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED')),
  priority                 text not null default 'NORMAL' check (priority in ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  hidden_from_tenant       boolean not null default false,
  assigned_admin           uuid references auth.users(id) on delete set null,
  first_response_due_at    timestamptz not null,
  first_response_at        timestamptz,
  last_customer_message_at timestamptz not null default now(),
  resolved_at              timestamptz,
  context                  jsonb not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index support_ticket_queue on support_ticket (status, created_at desc);
create index support_ticket_tenant on support_ticket (tenant_id, created_at desc);
create index support_ticket_opener on support_ticket (opened_by, created_at desc);

create table support_message (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references support_ticket(id) on delete cascade,
  author_kind text not null check (author_kind in ('CUSTOMER', 'ADMIN', 'SYSTEM')),
  author_id   uuid references auth.users(id) on delete set null,
  author_name text,
  -- Texto puro. Nenhuma tela renderiza isto como HTML.
  body        text not null check (char_length(btrim(body)) between 1 and 5000),
  -- Nota interna da equipe: nunca chega ao cliente (a policy filtra).
  internal    boolean not null default false,
  created_at  timestamptz not null default now(),
  check (not internal or author_kind = 'ADMIN')
);
create index support_message_ticket on support_message (ticket_id, created_at);

create table support_attachment (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid not null references support_ticket(id) on delete cascade,
  storage_path text not null unique,
  file_name    text not null check (char_length(file_name) between 1 and 160),
  mime_type    text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf')),
  size_bytes   integer not null check (size_bytes between 1 and 5242880),
  uploaded_by  uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index support_attachment_ticket on support_attachment (ticket_id);

/** Desvios da triagem do tutor para o petshop — só contagem, sem quem. */
create table support_deflection (
  id         bigint generated always as identity primary key,
  tenant_id  uuid not null references tenant(id) on delete cascade,
  topic      text not null check (topic in ('SCHEDULE', 'CARE', 'PRICES', 'PRODUCTS', 'DELIVERY', 'CLUBINHO')),
  created_at timestamptz not null default now()
);

-- Anexos: bucket privado, sem policy em storage.objects. Upload e leitura
-- passam pelo servidor (service_role), que confere o dono do chamado, o tipo
-- real do arquivo e entrega URL assinada de curta duração.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('support', 'support', false, 5242880,
        array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Visibilidade
-- ---------------------------------------------------------------------

/**
 * O usuário logado pode ver este chamado? Tutor: só os que ele abriu.
 * Petshop: os abertos pelo petshop (origem TENANT), para dono e gerente.
 * Chamado de tutor nunca aparece para o petshop — nem a denúncia.
 */
create or replace function can_see_support_ticket(_ticket uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from support_ticket t
     where t.id = _ticket
       and (
         (t.origin = 'TUTOR' and t.opened_by = auth.uid())
         or (t.origin = 'TENANT' and not t.hidden_from_tenant
             and has_staff_role(t.tenant_id, array['OWNER', 'MANAGER']::staff_role[]))
       )
  );
$$;

alter table support_ticket     enable row level security;
alter table support_message    enable row level security;
alter table support_attachment enable row level security;
alter table support_deflection enable row level security;

create policy support_ticket_select on support_ticket
  for select using (can_see_support_ticket(id));
create policy support_message_select on support_message
  for select using (not internal and can_see_support_ticket(ticket_id));

revoke all on support_ticket, support_message, support_attachment, support_deflection
  from public, anon, authenticated;
-- Colunas que o cliente enxerga. Responsável, contexto e e-mails ficam fora.
grant select (id, number, origin, tenant_id, category, subject, status, priority,
              first_response_at, resolved_at, created_at, updated_at)
  on support_ticket to authenticated;
grant select (id, ticket_id, author_kind, author_name, body, internal, created_at)
  on support_message to authenticated;
grant select, insert, update, delete on support_ticket, support_message,
  support_attachment, support_deflection to service_role;
grant usage on sequence support_ticket_number_seq to service_role;

-- ---------------------------------------------------------------------
-- Escrita do cliente
-- ---------------------------------------------------------------------

/**
 * Abre um chamado. p_origin diz em nome de quem: 'TENANT' (dono/gerente do
 * petshop p_tenant) ou 'TUTOR' (tutor com ficha em p_tenant). Prioridade,
 * prazo e sigilo saem da categoria — o cliente não escolhe.
 */
create or replace function open_support_ticket(
  p_origin   text,
  p_tenant   uuid,
  p_category text,
  p_subject  text,
  p_body     text,
  p_context  jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_name    text;
  v_subject text := btrim(coalesce(p_subject, ''));
  v_body    text := btrim(coalesce(p_body, ''));
  v_pri     text;
  v_due     interval;
  v_id      uuid;
  v_num     integer;
  v_gw      timestamptz;
  v_cams    integer;
begin
  if v_uid is null then
    raise exception 'Entre na sua conta para abrir um chamado.' using errcode = '42501';
  end if;
  if char_length(v_subject) not between 3 and 140 then
    raise exception 'O assunto precisa ter entre 3 e 140 caracteres.' using errcode = 'P0001';
  end if;
  if char_length(v_body) not between 10 and 5000 then
    raise exception 'Conte o que aconteceu em pelo menos 10 caracteres.' using errcode = 'P0001';
  end if;

  if p_origin = 'TENANT' then
    if not has_staff_role(p_tenant, array['OWNER', 'MANAGER']::staff_role[]) then
      raise exception 'Só o dono ou o gerente do petshop abre chamados.' using errcode = '42501';
    end if;
    if p_category not in ('CAMERAS', 'BUG', 'BILLING', 'HOW_TO', 'SUGGESTION', 'PRIVACY') then
      raise exception 'Categoria inválida.' using errcode = 'P0001';
    end if;
    select full_name into v_name from profile where id = v_uid;
  elsif p_origin = 'TUTOR' then
    select full_name into v_name from tutor
     where profile_id = v_uid and tenant_id = p_tenant limit 1;
    if not found then
      raise exception 'Chamado não permitido.' using errcode = '42501';
    end if;
    if p_category not in ('ACCESS', 'LIVE_CAMERA', 'NOTIFICATIONS', 'BUG', 'PRIVACY', 'PETSHOP_REPORT', 'OTHER') then
      raise exception 'Categoria inválida.' using errcode = 'P0001';
    end if;
  else
    raise exception 'Origem inválida.' using errcode = 'P0001';
  end if;

  if (select count(*) from support_ticket
       where opened_by = v_uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Você já abriu 5 chamados hoje. Responda num chamado aberto ou tente amanhã.'
      using errcode = 'P0001';
  end if;

  v_pri := case p_category
             when 'PETSHOP_REPORT' then 'HIGH'
             when 'CAMERAS'        then 'HIGH'
             when 'LIVE_CAMERA'    then 'HIGH'
             when 'ACCESS'         then 'HIGH'
             when 'BILLING'        then 'HIGH'
             when 'SUGGESTION'     then 'LOW'
             else 'NORMAL'
           end;
  v_due := case v_pri
             when 'URGENT' then interval '2 hours'
             when 'HIGH'   then interval '8 hours'
             when 'NORMAL' then interval '24 hours'
             else interval '72 hours'
           end;

  insert into support_ticket (
    origin, tenant_id, opened_by, opened_by_name, opened_by_email, category,
    subject, priority, hidden_from_tenant, first_response_due_at, context
  ) values (
    p_origin, p_tenant, v_uid, v_name, lower(auth.jwt() ->> 'email'), p_category,
    v_subject, v_pri, p_category = 'PETSHOP_REPORT', now() + v_due,
    -- Só chaves conhecidas, cortadas: o contexto vem do navegador.
    jsonb_strip_nulls(jsonb_build_object(
      'page',       left(p_context ->> 'page', 200),
      'user_agent', left(p_context ->> 'user_agent', 300),
      'app',        left(p_context ->> 'app', 40)
    ))
  ) returning id, number into v_id, v_num;

  insert into support_message (ticket_id, author_kind, author_id, author_name, body)
  values (v_id, 'CUSTOMER', v_uid, v_name, v_body);

  -- Câmera: anexa o estado do gateway do petshop no momento da abertura.
  if p_category in ('CAMERAS', 'LIVE_CAMERA') then
    select last_seen_at into v_gw from camera_gateway where tenant_id = p_tenant;
    select count(*) into v_cams from camera where tenant_id = p_tenant and active;
    insert into support_message (ticket_id, author_kind, body)
    values (v_id, 'SYSTEM', format(
      'Contexto automático: %s câmera(s) ativa(s); gateway %s.',
      v_cams,
      case when v_gw is null then 'não configurado'
           else 'visto pela última vez em ' || br_datetime(v_gw) end
    ));
  end if;

  return jsonb_build_object('id', v_id, 'number', v_num);
end $$;

/** Resposta do cliente num chamado que ele enxerga. Reabre se estava resolvido. */
create or replace function reply_support_ticket(p_ticket uuid, p_body text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_body   text := btrim(coalesce(p_body, ''));
  v_ticket support_ticket;
  v_name   text;
begin
  if v_uid is null or not can_see_support_ticket(p_ticket) then
    raise exception 'Chamado não encontrado.' using errcode = '42501';
  end if;
  if char_length(v_body) not between 1 and 5000 then
    raise exception 'A mensagem precisa ter até 5.000 caracteres.' using errcode = 'P0001';
  end if;
  if (select count(*) from support_message
       where author_id = v_uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Muitas mensagens em pouco tempo. Aguarde um pouco.' using errcode = 'P0001';
  end if;

  select * into v_ticket from support_ticket where id = p_ticket for update;
  if v_ticket.status = 'CLOSED' then
    raise exception 'Este chamado foi encerrado. Abra um novo, se precisar.' using errcode = 'P0001';
  end if;

  if v_ticket.origin = 'TUTOR' then
    select full_name into v_name from tutor
     where profile_id = v_uid and tenant_id = v_ticket.tenant_id limit 1;
  else
    select full_name into v_name from profile where id = v_uid;
  end if;

  insert into support_message (ticket_id, author_kind, author_id, author_name, body)
  values (p_ticket, 'CUSTOMER', v_uid, v_name, v_body);

  update support_ticket
     set status = case when status in ('WAITING_CUSTOMER', 'RESOLVED') then 'IN_PROGRESS' else status end,
         resolved_at = case when status = 'RESOLVED' then null else resolved_at end,
         last_customer_message_at = now(),
         updated_at = now()
   where id = p_ticket;
end $$;

/** Conta um desvio da triagem do tutor para o petshop (métrica, sem autor). */
create or replace function log_support_deflection(p_tenant uuid, p_topic text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists (
    select 1 from tutor where profile_id = auth.uid() and tenant_id = p_tenant
  ) then
    return;
  end if;
  insert into support_deflection (tenant_id, topic) values (p_tenant, p_topic);
end $$;

revoke execute on function can_see_support_ticket(uuid) from public, anon;
revoke execute on function open_support_ticket(text, uuid, text, text, text, jsonb) from public, anon;
revoke execute on function reply_support_ticket(uuid, text) from public, anon;
revoke execute on function log_support_deflection(uuid, text) from public, anon;
grant execute on function can_see_support_ticket(uuid) to authenticated;
grant execute on function open_support_ticket(text, uuid, text, text, text, jsonb) to authenticated;
grant execute on function reply_support_ticket(uuid, text) to authenticated;
grant execute on function log_support_deflection(uuid, text) to authenticated;
