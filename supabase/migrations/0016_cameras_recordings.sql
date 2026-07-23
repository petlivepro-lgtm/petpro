-- =====================================================================
-- Fase 2: câmeras ao vivo (Tapo C200 via MediaMTX + Cloudflare Tunnel).
--   * camera ganha os dados de conexão RTSP (host local, porta, path,
--     usuário da Conta da Câmera Tapo). A senha NÃO fica aqui: vai cifrada
--     (AES-256-GCM) em camera_credential, tabela sem policies — só o
--     service role lê, então nunca vaza por um select do cliente.
--   * camera_gateway guarda, por tenant, a URL do tunnel do gateway local
--     (MediaMTX) e o hash do token que o uploader usa para pedir signed
--     upload URLs de gravação. Também sem policies (service role only).
--   * recording ganha vínculo com a câmera e metadados do segmento.
--   * Tutor passa a poder CRIAR o próprio consentimento (hoje só update).
-- =====================================================================

-- --- camera: dados de conexão RTSP -----------------------------------
alter table camera add column if not exists host text;
alter table camera add column if not exists port integer not null default 554;
alter table camera add column if not exists stream_path text not null default 'stream1';
alter table camera add column if not exists username text;
alter table camera drop column if exists rtsp_secret;

-- --- camera_credential: senha cifrada, service role only --------------
create table camera_credential (
  camera_id     uuid primary key references camera(id) on delete cascade,
  tenant_id     uuid not null references tenant(id) on delete cascade,
  password_enc  text not null,   -- AES-256-GCM base64 (iv.ciphertext.tag), chave em env
  updated_at    timestamptz not null default now()
);
create index on camera_credential (tenant_id);
-- RLS habilitada SEM policies: nenhum cliente (staff ou tutor) enxerga.
alter table camera_credential enable row level security;

-- --- camera_gateway: 1 gateway MediaMTX por tenant ---------------------
create table camera_gateway (
  tenant_id          uuid primary key references tenant(id) on delete cascade,
  tunnel_url         text not null,       -- ex.: https://cam-<slug>.exemplo.com
  api_tunnel_url     text not null,       -- ex.: https://camapi-<slug>.exemplo.com
  upload_token_hash  text not null,       -- sha256 do token do uploader
  created_at         timestamptz not null default now(),
  last_seen_at       timestamptz          -- último contato do uploader/gateway
);
-- RLS habilitada SEM policies: gerência apenas via service role
-- (o token em claro nunca é armazenado; o staff consulta via server action).
alter table camera_gateway enable row level security;

-- --- recording: vínculo com câmera + metadados do segmento -------------
alter table recording add column if not exists camera_id uuid references camera(id) on delete set null;
alter table recording add column if not exists started_at timestamptz;
alter table recording add column if not exists ended_at timestamptz;
alter table recording add column if not exists size_bytes bigint;
create index if not exists recording_retain_until_idx on recording (retain_until);

-- Lista de gravações do tutor atualiza sozinha quando um segmento sobe.
alter table recording replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recording'
  ) then
    execute 'alter publication supabase_realtime add table recording';
  end if;
end $$;

-- --- consent: tutor pode criar o próprio registro ----------------------
-- (0001 só criou select/update; o consentimento de câmera nasce no 1º acesso
-- do tutor à tela Ao vivo, então ele precisa de insert.)
create policy consent_tutor_insert on consent for insert with check (
  tutor_id = my_tutor_id(tenant_id)
);
