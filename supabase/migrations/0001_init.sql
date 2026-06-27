-- =====================================================================
-- MyLivePet / Pet Live Pro — schema inicial (multi-tenant)
-- Isolamento por tenant_id + Row Level Security.
-- =====================================================================

create extension if not exists "pgcrypto";

-- funções SQL referenciam tabelas criadas mais abaixo; adia a validação do corpo.
set check_function_bodies = off;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type staff_role        as enum ('OWNER', 'MANAGER', 'ATTENDANT', 'VIEWER');
create type appointment_origin as enum ('STAFF', 'TUTOR');
create type appointment_status as enum (
  'REQUESTED',   -- solicitado pelo tutor, aguardando confirmação
  'CONFIRMED',   -- confirmado pelo petshop
  'CHECKED_IN',  -- pet chegou
  'IN_PROGRESS', -- em atendimento
  'COMPLETED',   -- finalizado
  'REJECTED',    -- recusado pelo petshop
  'CANCELLED'    -- cancelado
);
create type feedback_direction as enum ('STAFF_TO_TUTOR', 'TUTOR_TO_PETSHOP');
create type reservation_status as enum (
  'RESERVED',    -- reservado pelo tutor
  'PICKED',      -- separado pelo petshop
  'COMPLETED',   -- retirado/pago na loja
  'EXPIRED',
  'CANCELLED'
);

-- ---------------------------------------------------------------------
-- Núcleo: tenant, profile, membership
-- ---------------------------------------------------------------------
create table tenant (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- profile espelha auth.users (1:1). Tutores e staff têm profile.
create table profile (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- vincula um profile (staff) a um tenant com um papel
create table membership (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant(id) on delete cascade,
  profile_id  uuid not null references profile(id) on delete cascade,
  role        staff_role not null default 'ATTENDANT',
  created_at  timestamptz not null default now(),
  unique (tenant_id, profile_id)
);
create index on membership (profile_id);
create index on membership (tenant_id);

-- ---------------------------------------------------------------------
-- Helpers de RLS (SECURITY DEFINER => ignoram RLS, evitam recursão)
-- ---------------------------------------------------------------------
create or replace function is_staff(_tenant uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membership m
    where m.profile_id = auth.uid() and m.tenant_id = _tenant
  );
$$;

create or replace function has_staff_role(_tenant uuid, _roles staff_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from membership m
    where m.profile_id = auth.uid() and m.tenant_id = _tenant and m.role = any(_roles)
  );
$$;

-- id do tutor (na tabela tutor) correspondente ao usuário logado nesse tenant
create or replace function my_tutor_id(_tenant uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select t.id from tutor t
  where t.profile_id = auth.uid() and t.tenant_id = _tenant
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- CRM: tutor, pet
-- ---------------------------------------------------------------------
create table tutor (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant(id) on delete cascade,
  profile_id  uuid references profile(id) on delete set null, -- preenchido quando o tutor cria login no MyLivePet
  full_name   text not null,
  email       text,
  phone       text,
  notes       text,
  created_at  timestamptz not null default now()
);
create index on tutor (tenant_id);
create index on tutor (profile_id);

create table pet (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant(id) on delete cascade,
  tutor_id    uuid not null references tutor(id) on delete cascade,
  name        text not null,
  species     text,
  breed       text,
  size        text,             -- pequeno/medio/grande
  birth_date  date,
  notes       text,
  photo_path  text,             -- Supabase Storage
  created_at  timestamptz not null default now()
);
create index on pet (tenant_id);
create index on pet (tutor_id);

-- ---------------------------------------------------------------------
-- Serviços, atendimentos, etapas
-- ---------------------------------------------------------------------
create table service_type (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete cascade,
  name          text not null,
  description   text,
  price_cents   integer not null default 0,
  duration_min  integer not null default 60,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on service_type (tenant_id);

create table camera (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete cascade,
  room_label    text not null,
  rtsp_secret   text,           -- credencial cifrada (preenchida na Fase 2)
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on camera (tenant_id);

create table appointment (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete cascade,
  pet_id        uuid not null references pet(id) on delete cascade,
  tutor_id      uuid not null references tutor(id) on delete cascade,
  service_type_id uuid references service_type(id) on delete set null,
  staff_id      uuid references profile(id) on delete set null,  -- profissional responsável
  camera_id     uuid references camera(id) on delete set null,
  origin        appointment_origin not null default 'STAFF',
  status        appointment_status not null default 'REQUESTED',
  scheduled_at  timestamptz,
  started_at    timestamptz,
  finished_at   timestamptz,
  notes         text,
  created_at    timestamptz not null default now()
);
create index on appointment (tenant_id);
create index on appointment (tutor_id);
create index on appointment (pet_id);
create index on appointment (status);

create table appointment_step (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete cascade,
  appointment_id uuid not null references appointment(id) on delete cascade,
  label         text not null,
  position      integer not null default 0,
  done          boolean not null default false,
  done_at       timestamptz
);
create index on appointment_step (appointment_id);

-- ---------------------------------------------------------------------
-- Feedbacks (bidirecional)
-- ---------------------------------------------------------------------
create table feedback (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete cascade,
  appointment_id uuid not null references appointment(id) on delete cascade,
  direction     feedback_direction not null,
  rating        smallint check (rating between 1 and 5),  -- usado em TUTOR_TO_PETSHOP
  comment       text,
  author_id     uuid references profile(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index on feedback (appointment_id);
create index on feedback (tenant_id);

-- ---------------------------------------------------------------------
-- Produtos e reservas (pagamento na loja física, sem checkout online)
-- ---------------------------------------------------------------------
create table product (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete cascade,
  name          text not null,
  description   text,
  price_cents   integer not null default 0,
  stock         integer not null default 0,
  photo_path    text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on product (tenant_id);

create table product_reservation (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete cascade,
  tutor_id      uuid not null references tutor(id) on delete cascade,
  status        reservation_status not null default 'RESERVED',
  note          text,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index on product_reservation (tenant_id);
create index on product_reservation (tutor_id);

create table product_reservation_item (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id) on delete cascade,
  reservation_id  uuid not null references product_reservation(id) on delete cascade,
  product_id      uuid not null references product(id) on delete restrict,
  quantity        integer not null default 1 check (quantity > 0),
  price_cents     integer not null default 0  -- snapshot do preço na reserva
);
create index on product_reservation_item (reservation_id);

-- ---------------------------------------------------------------------
-- Gravações, consentimento (LGPD), auditoria
-- ---------------------------------------------------------------------
create table recording (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete cascade,
  appointment_id uuid not null references appointment(id) on delete cascade,
  storage_path  text not null,
  duration_sec  integer,
  retain_until  timestamptz,
  created_at    timestamptz not null default now()
);
create index on recording (appointment_id);

create table consent (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete cascade,
  tutor_id      uuid not null references tutor(id) on delete cascade,
  purpose       text not null,   -- ex.: "transmissão e gravação do atendimento"
  granted       boolean not null default false,
  granted_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index on consent (tutor_id);

create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete cascade,
  actor_id      uuid references profile(id) on delete set null,
  action        text not null,   -- ex.: "recording.view"
  target        text,            -- ex.: "recording:<uuid>"
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index on audit_log (tenant_id);

-- =====================================================================
-- Row Level Security
-- Padrão por tabela de negócio:
--   * staff do tenant: acesso conforme is_staff()/has_staff_role()
--   * tutor: acesso apenas aos próprios registros (via my_tutor_id())
-- =====================================================================
alter table tenant                   enable row level security;
alter table profile                  enable row level security;
alter table membership               enable row level security;
alter table tutor                    enable row level security;
alter table pet                      enable row level security;
alter table service_type             enable row level security;
alter table camera                   enable row level security;
alter table appointment              enable row level security;
alter table appointment_step         enable row level security;
alter table feedback                 enable row level security;
alter table product                  enable row level security;
alter table product_reservation      enable row level security;
alter table product_reservation_item enable row level security;
alter table recording                enable row level security;
alter table consent                  enable row level security;
alter table audit_log                enable row level security;

-- tenant: membros podem ver; ninguém edita pelo cliente (gerência via service role)
create policy tenant_select on tenant for select using (is_staff(id) or exists (
  select 1 from tutor t where t.tenant_id = tenant.id and t.profile_id = auth.uid()
));

-- profile: cada um vê/edita o próprio
create policy profile_self on profile for select using (id = auth.uid());
create policy profile_update_self on profile for update using (id = auth.uid()) with check (id = auth.uid());
create policy profile_insert_self on profile for insert with check (id = auth.uid());

-- membership: staff do tenant pode ler; OWNER/MANAGER administram
create policy membership_select on membership for select using (is_staff(tenant_id));
create policy membership_admin on membership for all
  using (has_staff_role(tenant_id, array['OWNER','MANAGER']::staff_role[]))
  with check (has_staff_role(tenant_id, array['OWNER','MANAGER']::staff_role[]));

-- tutor: staff total; o próprio tutor lê/atualiza seu registro
create policy tutor_staff on tutor for all using (is_staff(tenant_id)) with check (is_staff(tenant_id));
create policy tutor_self_select on tutor for select using (profile_id = auth.uid());
create policy tutor_self_update on tutor for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- pet: staff total; tutor lê os próprios e pode cadastrar/editar
create policy pet_staff on pet for all using (is_staff(tenant_id)) with check (is_staff(tenant_id));
create policy pet_tutor_select on pet for select using (tutor_id = my_tutor_id(tenant_id));
create policy pet_tutor_write on pet for all
  using (tutor_id = my_tutor_id(tenant_id))
  with check (tutor_id = my_tutor_id(tenant_id));

-- service_type / product: staff administra; tutor (e staff) leem os ativos
create policy service_staff on service_type for all using (is_staff(tenant_id)) with check (is_staff(tenant_id));
create policy service_read on service_type for select using (
  is_staff(tenant_id) or (active and my_tutor_id(tenant_id) is not null)
);
create policy product_staff on product for all using (is_staff(tenant_id)) with check (is_staff(tenant_id));
create policy product_read on product for select using (
  is_staff(tenant_id) or (active and my_tutor_id(tenant_id) is not null)
);

-- camera: somente staff
create policy camera_staff on camera for all using (is_staff(tenant_id)) with check (is_staff(tenant_id));

-- appointment: staff total; tutor lê os seus e pode criar solicitações (REQUESTED)
create policy appointment_staff on appointment for all using (is_staff(tenant_id)) with check (is_staff(tenant_id));
create policy appointment_tutor_select on appointment for select using (tutor_id = my_tutor_id(tenant_id));
create policy appointment_tutor_request on appointment for insert with check (
  tutor_id = my_tutor_id(tenant_id) and origin = 'TUTOR' and status = 'REQUESTED'
);
create policy appointment_tutor_cancel on appointment for update
  using (tutor_id = my_tutor_id(tenant_id))
  with check (tutor_id = my_tutor_id(tenant_id) and status in ('REQUESTED','CANCELLED'));

-- appointment_step: staff total; tutor apenas lê os passos dos seus atendimentos
create policy step_staff on appointment_step for all using (is_staff(tenant_id)) with check (is_staff(tenant_id));
create policy step_tutor_select on appointment_step for select using (
  exists (select 1 from appointment a where a.id = appointment_step.appointment_id and a.tutor_id = my_tutor_id(tenant_id))
);

-- feedback: staff total; tutor lê os feedbacks dos seus atendimentos e cria TUTOR_TO_PETSHOP
create policy feedback_staff on feedback for all using (is_staff(tenant_id)) with check (is_staff(tenant_id));
create policy feedback_tutor_select on feedback for select using (
  exists (select 1 from appointment a where a.id = feedback.appointment_id and a.tutor_id = my_tutor_id(tenant_id))
);
create policy feedback_tutor_insert on feedback for insert with check (
  direction = 'TUTOR_TO_PETSHOP'
  and exists (select 1 from appointment a where a.id = feedback.appointment_id and a.tutor_id = my_tutor_id(tenant_id))
);

-- product_reservation: staff total; tutor cria/lê/cancela as próprias
create policy reservation_staff on product_reservation for all using (is_staff(tenant_id)) with check (is_staff(tenant_id));
create policy reservation_tutor_select on product_reservation for select using (tutor_id = my_tutor_id(tenant_id));
create policy reservation_tutor_insert on product_reservation for insert with check (tutor_id = my_tutor_id(tenant_id));
create policy reservation_tutor_update on product_reservation for update
  using (tutor_id = my_tutor_id(tenant_id))
  with check (tutor_id = my_tutor_id(tenant_id) and status in ('RESERVED','CANCELLED'));

-- itens da reserva: seguem o dono da reserva
create policy reservation_item_staff on product_reservation_item for all using (is_staff(tenant_id)) with check (is_staff(tenant_id));
create policy reservation_item_tutor on product_reservation_item for all
  using (exists (select 1 from product_reservation r where r.id = reservation_id and r.tutor_id = my_tutor_id(tenant_id)))
  with check (exists (select 1 from product_reservation r where r.id = reservation_id and r.tutor_id = my_tutor_id(tenant_id)));

-- recording: staff total; tutor lê as gravações dos seus atendimentos
create policy recording_staff on recording for all using (is_staff(tenant_id)) with check (is_staff(tenant_id));
create policy recording_tutor_select on recording for select using (
  exists (select 1 from appointment a where a.id = recording.appointment_id and a.tutor_id = my_tutor_id(tenant_id))
);

-- consent: staff total; tutor lê e concede os próprios
create policy consent_staff on consent for all using (is_staff(tenant_id)) with check (is_staff(tenant_id));
create policy consent_tutor_select on consent for select using (tutor_id = my_tutor_id(tenant_id));
create policy consent_tutor_update on consent for update
  using (tutor_id = my_tutor_id(tenant_id)) with check (tutor_id = my_tutor_id(tenant_id));

-- audit_log: somente staff lê; escrita via service role (Edge Functions)
create policy audit_staff_select on audit_log for select using (is_staff(tenant_id));
