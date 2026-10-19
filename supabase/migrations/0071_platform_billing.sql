-- =====================================================================
-- Assinatura do petshop na plataforma (o que o petshop paga ao Pet Live
-- Pro). Não confundir com o Clubinho, que é o que o tutor paga ao petshop.
--
-- Ainda não há gateway de pagamento: estas tabelas existem para a área
-- Financeiro do admin ter onde ler, e serão alimentadas pelo webhook do
-- gateway escolhido (validação de assinatura + idempotência pelo id
-- externo). Do cartão guardamos só bandeira e últimos 4 dígitos.
-- =====================================================================

create table platform_plan (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[a-z0-9_-]{2,40}$'),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  price_cents integer not null check (price_cents >= 0),
  cycle       text not null default 'MONTHLY' check (cycle in ('MONTHLY', 'YEARLY')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table tenant_subscription (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null unique references tenant(id) on delete cascade,
  plan_id                 uuid references platform_plan(id) on delete set null,
  status                  text not null check (status in ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED')),
  price_cents             integer not null check (price_cents >= 0),
  cycle                   text not null default 'MONTHLY' check (cycle in ('MONTHLY', 'YEARLY')),
  trial_ends_at           timestamptz,
  current_period_end      timestamptz,
  cancel_requested_at     timestamptz,
  cancel_reason           text check (cancel_reason is null or char_length(cancel_reason) <= 500),
  cancelled_at            timestamptz,
  payment_method          text check (payment_method is null or payment_method in ('CARD', 'PIX', 'BOLETO')),
  card_brand              text check (card_brand is null or char_length(card_brand) <= 20),
  card_last4              text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  gateway                 text,
  gateway_customer_id     text,
  gateway_subscription_id text unique,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table subscription_invoice (
  id                 uuid primary key default gen_random_uuid(),
  subscription_id    uuid not null references tenant_subscription(id) on delete cascade,
  tenant_id          uuid not null references tenant(id) on delete cascade,
  amount_cents       integer not null check (amount_cents >= 0),
  status             text not null check (status in ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED')),
  due_date           date not null,
  paid_at            timestamptz,
  failure_reason     text check (failure_reason is null or char_length(failure_reason) <= 300),
  gateway_invoice_id text unique,
  created_at         timestamptz not null default now()
);
create index subscription_invoice_tenant on subscription_invoice (tenant_id, due_date desc);
create index subscription_invoice_status on subscription_invoice (status, due_date);

alter table platform_plan        enable row level security;
alter table tenant_subscription  enable row level security;
alter table subscription_invoice enable row level security;

-- O dono e a gestão do petshop podem ver a própria assinatura e faturas
-- (para uma futura tela no painel). Escrita só pelo servidor (webhook).
create policy tenant_subscription_select on tenant_subscription
  for select using (is_management(tenant_id));
create policy subscription_invoice_select on subscription_invoice
  for select using (is_management(tenant_id));
create policy platform_plan_select on platform_plan
  for select using (auth.uid() is not null and active);

revoke all on platform_plan, tenant_subscription, subscription_invoice from public, anon, authenticated;
grant select on platform_plan, tenant_subscription, subscription_invoice to authenticated;
grant select, insert, update, delete on platform_plan, tenant_subscription, subscription_invoice to service_role;
