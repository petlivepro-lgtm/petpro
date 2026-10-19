-- =====================================================================
-- Administração da plataforma (apps/admin-web).
--
-- Quem administra o Pet Live Pro não é staff de petshop nem tutor: é uma
-- terceira identidade, guardada aqui e ligada ao auth.users por user_id.
--
-- Nada destas tabelas é alcançável pelo PostgREST com a chave anon ou com o
-- JWT de um usuário comum: RLS ligada e forçada, nenhuma policy e todos os
-- grants revogados. Só a service_role (usada exclusivamente no servidor do
-- admin-web, depois de requireAdmin) lê e escreve. Assim um JWT de admin
-- roubado e usado direto contra a API não enxerga nada a mais do que o de
-- qualquer pessoa — o poder administrativo mora no servidor, não no token.
--
-- As travas que importam (auditoria imutável, último superadmin) são
-- triggers: valem até para a service_role, que ignora RLS mas não trigger.
-- =====================================================================

create table platform_admin (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  email             text not null unique check (email = lower(btrim(email))),
  display_name      text check (display_name is null or char_length(btrim(display_name)) between 1 and 120),
  role              text not null check (role in ('superadmin', 'admin', 'suporte')),
  status            text not null default 'invited' check (status in ('invited', 'active', 'suspended')),
  invited_by        uuid references auth.users(id) on delete set null,
  -- Ativação do convite: a senha nova é obrigatória antes do MFA. Enquanto
  -- isto for null, o login por senha não é aceito (a senha ainda é a de quem
  -- quer que tenha criado a conta antes do convite).
  password_set_at   timestamptz,
  activated_at      timestamptz,
  suspended_at      timestamptz,
  suspension_reason text check (suspension_reason is null or char_length(btrim(suspension_reason)) between 10 and 1000),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

/**
 * Convites. O token vai por e-mail e só o hash (sha256, hex) fica aqui: quem
 * lê o banco não consegue usar um convite pendente.
 */
create table platform_admin_invite (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (email = lower(btrim(email))),
  role        text not null check (role in ('superadmin', 'admin', 'suporte')),
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- null = criado pelo script de bootstrap, direto no servidor.
  invited_by  uuid references auth.users(id) on delete set null,
  reason      text check (reason is null or char_length(btrim(reason)) between 3 and 500),
  expires_at  timestamptz not null,
  claimed_by  uuid references auth.users(id) on delete set null,
  claimed_at  timestamptz,
  used_at     timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
-- Um convite em aberto por e-mail: convidar de novo revoga o anterior antes.
create unique index platform_admin_invite_open_email
  on platform_admin_invite (email) where used_at is null and revoked_at is null;

/**
 * Sessões do admin. O session_id é o claim do JWT do Supabase; o admin-web
 * confere a linha a cada request para impor ociosidade (30 min) e idade
 * máxima (12 h) e para poder revogar uma sessão pelo painel na hora.
 */
create table platform_admin_session (
  session_id     uuid primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  -- Última reconfirmação do código TOTP (ações de governança exigem < 10 min).
  step_up_at     timestamptz,
  revoked_at     timestamptz,
  revoked_reason text,
  ip_hash        text,
  user_agent     text check (user_agent is null or char_length(user_agent) <= 300)
);
create index platform_admin_session_user on platform_admin_session (user_id, created_at desc);

/** Tentativas de login e de código MFA, para bloqueio por força bruta. */
create table platform_admin_login_attempt (
  id          bigint generated always as identity primary key,
  kind        text not null default 'password' check (kind in ('password', 'mfa')),
  email_hash  text,
  ip_hash     text,
  success     boolean not null,
  created_at  timestamptz not null default now()
);
create index platform_admin_login_attempt_email on platform_admin_login_attempt (email_hash, created_at desc);
create index platform_admin_login_attempt_ip on platform_admin_login_attempt (ip_hash, created_at desc);

/**
 * Trilha de auditoria. Append-only: o trigger abaixo recusa UPDATE/DELETE.
 *
 * Sem chaves estrangeiras de propósito: um `on delete set null` viraria
 * UPDATE nesta tabela ao apagar um usuário ou um petshop, e a trava de
 * imutabilidade abortaria a exclusão. A trilha guarda os ids e o e-mail do
 * autor como fotografia do momento.
 */
create table platform_admin_audit (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid,
  actor_email   text,
  action        text not null check (char_length(action) between 3 and 120),
  resource_type text not null check (char_length(resource_type) between 2 and 80),
  resource_id   text,
  tenant_id     uuid,
  reason        text check (reason is null or char_length(btrim(reason)) between 3 and 2000),
  before_data   jsonb,
  after_data    jsonb,
  ip_hash       text,
  created_at    timestamptz not null default now()
);
create index platform_admin_audit_created on platform_admin_audit (created_at desc);
create index platform_admin_audit_actor on platform_admin_audit (actor_id, created_at desc);
create index platform_admin_audit_tenant on platform_admin_audit (tenant_id, created_at desc);

/** Notas internas da equipe sobre um petshop ou uma ficha de tutor. */
create table platform_admin_note (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid references tenant(id) on delete cascade,
  tutor_id   uuid references tutor(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  author_name text,
  body       text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  check (tenant_id is not null or tutor_id is not null)
);
create index platform_admin_note_tenant on platform_admin_note (tenant_id, created_at desc);

-- ---------------------------------------------------------------------
-- Travas
-- ---------------------------------------------------------------------

create or replace function platform_admin_audit_immutable()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'A auditoria administrativa não pode ser alterada nem apagada.'
    using errcode = 'P0001';
end $$;

create trigger platform_admin_audit_no_update
  before update or delete on platform_admin_audit
  for each row execute function platform_admin_audit_immutable();
create trigger platform_admin_audit_no_truncate
  before truncate on platform_admin_audit
  for each statement execute function platform_admin_audit_immutable();

/**
 * A plataforma nunca fica sem um superadmin ativo: rebaixar, suspender ou
 * apagar o último é recusado. Sem isto, um erro de clique trancaria todos
 * para fora e a única saída seria SQL direto no banco.
 */
create or replace function platform_admin_keep_superadmin()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.role = 'superadmin' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'superadmin' or new.status <> 'active')
     and not exists (
       select 1 from platform_admin
        where role = 'superadmin' and status = 'active' and user_id <> old.user_id
     ) then
    raise exception 'Não é possível remover o último superadmin ativo.'
      using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger platform_admin_guard
  before update or delete on platform_admin
  for each row execute function platform_admin_keep_superadmin();

-- ---------------------------------------------------------------------
-- Acesso: só service_role
-- ---------------------------------------------------------------------

alter table platform_admin               enable row level security;
alter table platform_admin               force row level security;
alter table platform_admin_invite        enable row level security;
alter table platform_admin_invite        force row level security;
alter table platform_admin_session       enable row level security;
alter table platform_admin_session       force row level security;
alter table platform_admin_login_attempt enable row level security;
alter table platform_admin_login_attempt force row level security;
alter table platform_admin_audit         enable row level security;
alter table platform_admin_audit         force row level security;
alter table platform_admin_note          enable row level security;
alter table platform_admin_note          force row level security;

revoke all on platform_admin, platform_admin_invite, platform_admin_session,
  platform_admin_login_attempt, platform_admin_audit, platform_admin_note
  from public, anon, authenticated;

grant select, insert, update, delete on platform_admin, platform_admin_invite,
  platform_admin_session, platform_admin_login_attempt, platform_admin_note
  to service_role;
-- A auditoria só recebe linhas novas; o trigger cobre o resto.
grant select, insert on platform_admin_audit to service_role;

revoke execute on function platform_admin_audit_immutable() from public, anon, authenticated;
revoke execute on function platform_admin_keep_superadmin() from public, anon, authenticated;
