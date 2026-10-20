-- =====================================================================
-- Segurança de upload.
--
-- Todo arquivo enviado passa por @mylivepet/uploads no servidor do app:
-- tipo pelos bytes, imagem regravada em WEBP, PDF lido atrás de conteúdo
-- ativo. O que só um atacante mandaria (programa disfarçado de foto, código
-- escondido, PDF com script, imagem-bomba) é recusado e registrado aqui para
-- a equipe ver em admin → Segurança. O arquivo em si nunca é guardado: só o
-- nome, o tipo real e o hash.
--
-- Os buckets públicos de imagem passam a aceitar só imagem e no máximo 5 MB
-- (o app já entrega WEBP; JPG e PNG ficam pelas fotos antigas). Antes eram
-- criados pelo código, sob demanda, sem limite nenhum.
-- =====================================================================

create table upload_incident (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  app           text not null check (app in ('painel', 'tutor')),
  -- Onde o envio aconteceu (foto do pet, produto, logo, anexo do suporte...).
  surface       text not null check (char_length(surface) between 1 and 40),
  tenant_id     uuid references tenant(id) on delete set null,
  profile_id    uuid references auth.users(id) on delete set null,
  actor_name    text,
  actor_email   text,
  file_name     text not null check (char_length(file_name) <= 160),
  declared_type text not null check (char_length(declared_type) <= 100),
  size_bytes    bigint not null,
  reason        text not null check (reason in ('DISGUISED', 'HIDDEN_CODE', 'PDF_ACTIVE_CONTENT', 'IMAGE_BOMB')),
  detected      text not null check (char_length(detected) <= 300),
  sha256        text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  reviewed_at   timestamptz,
  reviewed_by   uuid references auth.users(id) on delete set null,
  review_note   text check (char_length(review_note) <= 500)
);
create index upload_incident_recent on upload_incident (created_at desc);
create index upload_incident_open on upload_incident (created_at desc) where reviewed_at is null;
create index upload_incident_actor on upload_incident (profile_id, created_at desc);

-- Só o servidor (service role) grava e lê: nem o próprio autor vê o registro.
alter table upload_incident enable row level security;
revoke all on upload_incident from public, anon, authenticated;
grant select, insert, update, delete on upload_incident to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select b, b, true, 5242880, array['image/webp', 'image/jpeg', 'image/png']
  from unnest(array['pet-photos', 'product-photos', 'appointment-photos', 'tenant-logos']) as b
on conflict (id) do update
   set public = true,
       file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;
