-- =====================================================================
-- Troca de sala durante o atendimento.
--
-- O pet circula entre as salas do petshop (banho → tosa), então a câmera
-- deixa de ser uma escolha única do início. `appointment.camera_id` segue
-- existindo como "sala atual" — é dele que o tutor deriva o path do stream
-- (`cam-<camera_id>`) — e esta tabela guarda o histórico: por qual câmera o
-- atendimento passou e quando.
--
-- Sem esse histórico a troca perderia gravação: o uploader do gateway só
-- conhece a câmera (o diretório é `cam-<id>`) e a rota /api/gateway/
-- recordings/sign resolvia o atendimento por "quem está IN_PROGRESS nesta
-- câmera". Depois da troca, os segmentos da sala de banho — que sobem até
-- ~10 min atrasados — não achariam mais o atendimento. Com a sessão, cada
-- segmento cai no atendimento que estava naquela câmera na hora.
-- =====================================================================

create table appointment_camera_session (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id) on delete cascade,
  appointment_id  uuid not null references appointment(id) on delete cascade,
  camera_id       uuid not null references camera(id) on delete cascade,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz          -- null = transmitindo agora
);

-- Caminho quente da rota de gravações: "qual atendimento está nesta câmera".
create index on appointment_camera_session (camera_id, started_at desc);
-- Timeline do atendimento (as salas por onde o pet passou, em ordem).
create index on appointment_camera_session (appointment_id, started_at);

-- Índice que já faltava: sign/route.ts e ao-vivo/actions.ts filtram por aqui.
create index if not exists appointment_camera_idx on appointment (camera_id);

alter table appointment_camera_session enable row level security;

create policy session_staff on appointment_camera_session for all
  using (is_staff(tenant_id))
  with check (is_staff(tenant_id));

-- Tutor: leitura das sessões dos próprios atendimentos (mesma forma da
-- policy step_tutor_select em 0001).
create policy session_tutor_select on appointment_camera_session for select using (
  exists (
    select 1 from appointment a
     where a.id = appointment_camera_session.appointment_id
       and a.tutor_id = my_tutor_id(appointment_camera_session.tenant_id)
  )
);

-- Colaborador (0031): ele é quem leva o pet para a outra sala, então precisa
-- de escrita — switchAppointmentCamera abre e fecha sessão em nome dele.
create policy session_collab_all on appointment_camera_session for all
  using (exists (
    select 1 from appointment a
     where a.id = appointment_camera_session.appointment_id
       and a.collaborator_id = my_collaborator_id(appointment_camera_session.tenant_id)
  ))
  with check (exists (
    select 1 from appointment a
     where a.id = appointment_camera_session.appointment_id
       and a.collaborator_id = my_collaborator_id(appointment_camera_session.tenant_id)
  ));

-- Backfill: os atendimentos que já escolheram câmera viram uma sessão única,
-- para as gravações que ainda estão subindo continuarem resolvendo.
insert into appointment_camera_session (tenant_id, appointment_id, camera_id, started_at, ended_at)
select tenant_id, id, camera_id, coalesce(started_at, scheduled_at, created_at), finished_at
  from appointment
 where camera_id is not null;
