-- =====================================================================
-- Web Push para a equipe do Pet Live Pro (apps/admin-web).
--
-- Separado de push_subscription (0040) de propósito: aquela é por petshop
-- (tenant_id obrigatório) e o admin não pertence a petshop nenhum. Cada
-- aparelho em que um administrador ativa os avisos vira uma linha.
--
-- Quem envia são os servidores dos apps (service role), na hora do evento:
-- chamado novo, resposta de cliente, chamado atribuído, upload bloqueado. Só
-- recebe quem está ativo em platform_admin; suspender um administrador corta
-- os avisos na hora, sem depender de apagar a inscrição.
--
-- Sem acesso nenhum para anon/authenticated: o admin não tem client Supabase
-- no navegador, tudo passa pelas server actions dele.
-- =====================================================================

create table platform_admin_push_subscription (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references platform_admin(user_id) on delete cascade,
  endpoint        text not null unique check (endpoint ~ '^https://'),
  p256dh          text not null,
  auth            text not null,
  user_agent      text check (char_length(user_agent) <= 300),
  created_at      timestamptz not null default now(),
  last_success_at timestamptz
);
create index platform_admin_push_subscription_user on platform_admin_push_subscription (user_id);

alter table platform_admin_push_subscription enable row level security;
revoke all on platform_admin_push_subscription from public, anon, authenticated;
grant select, insert, update, delete on platform_admin_push_subscription to service_role;
