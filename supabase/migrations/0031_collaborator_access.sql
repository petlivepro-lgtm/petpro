-- =====================================================================
-- Acesso do colaborador ao painel: vínculo com a conta de login e a RLS
-- que restringe o que ele enxerga.
--
-- Escopo do colaborador:
--   * só os atendimentos atribuídos a ele (appointment.collaborator_id);
--   * a ficha dos pets que ele atende;
--   * executar o atendimento (checklist, boletim, finalizar).
-- Fora do escopo: financeiro, produtos, estoque, reservas, configurações,
-- solicitações, outros colaboradores e o contato do tutor.
--
-- A restrição vale no banco, não só na UI: a chave anon do Supabase é
-- pública, então esconder itens de menu não protegeria nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Vínculo colaborador <-> conta de login
-- ---------------------------------------------------------------------
alter table collaborator
  add column if not exists profile_id   uuid references profile(id) on delete set null,
  add column if not exists access_email text;

comment on column collaborator.access_email is
  'E-mail com que o colaborador entra no painel. Definido pelo admin; a conta '
  'de auth só nasce no primeiro acesso, quando ele escolhe a senha.';

create unique index if not exists collaborator_profile_uq
  on collaborator (tenant_id, profile_id) where profile_id is not null;

-- Índice global (não por tenant): auth.users.email é único no projeto todo,
-- então dois petshops não podem reivindicar o mesmo e-mail de acesso.
create unique index if not exists collaborator_access_email_uq
  on collaborator (lower(access_email)) where access_email is not null;

-- Sustenta collab_sees_pet(), avaliada linha a linha na policy de pet.
create index if not exists appointment_collab_pet_idx
  on appointment (collaborator_id, pet_id);

-- ---------------------------------------------------------------------
-- Helpers (mesmo molde de my_tutor_id: SECURITY DEFINER para não recursar
-- na própria RLS da tabela consultada)
-- ---------------------------------------------------------------------
create or replace function my_collaborator_id(_tenant uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
    from collaborator c
   where c.profile_id = auth.uid()
     and c.tenant_id = _tenant
     and c.active
   limit 1;
$$;

-- O colaborador vê um pet se tiver qualquer atendimento dele para esse pet,
-- em qualquer status — é a leitura consistente com "só a própria agenda".
create or replace function collab_sees_pet(_tenant uuid, _pet uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from appointment a
     where a.tenant_id = _tenant
       and a.pet_id = _pet
       and a.collaborator_id = my_collaborator_id(_tenant)
  );
$$;

-- ---------------------------------------------------------------------
-- is_staff passa a significar "membro com acesso de painel", excluindo o
-- colaborador. É o que faz as ~40 policies já existentes o excluírem sem
-- precisarem ser reescritas — tudo abaixo é aditivo.
-- ---------------------------------------------------------------------
create or replace function is_staff(_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from membership m
     where m.profile_id = auth.uid()
       and m.tenant_id = _tenant
       and m.role <> 'COLLABORATOR'
  );
$$;

-- Efeito colateral do acima: get_busy_slots (0014) liberava a consulta por
-- is_staff ou my_tutor_id. O colaborador também precisa enxergar a própria
-- ocupação, então entra como terceira alternativa.
create or replace function get_busy_slots(
  p_tenant_id uuid,
  p_collaborator_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns setof timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select distinct a.scheduled_at
  from appointment a
  where a.tenant_id = p_tenant_id
    and a.collaborator_id = p_collaborator_id
    and a.scheduled_at >= p_from and a.scheduled_at < p_to
    and a.status in ('REQUESTED','CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED')
    and (
      is_staff(p_tenant_id)
      or my_tutor_id(p_tenant_id) is not null
      or my_collaborator_id(p_tenant_id) is not null
    );
$$;

-- ---------------------------------------------------------------------
-- Policies do colaborador
-- ---------------------------------------------------------------------

-- membership: sem isto getActiveTenant() não enxerga a própria linha (a
-- policy membership_select exige is_staff, que agora o exclui).
create policy membership_self_select on membership for select
  using (profile_id = auth.uid());

-- tenant: nome, logo e as categorias do boletim (tenant.settings.behavior).
create policy tenant_collab_select on tenant for select using (
  my_collaborator_id(tenant.id) is not null
);

-- appointment: lê e atualiza apenas os seus. O with check repete a condição
-- para ele não conseguir repassar o atendimento a outro profissional.
create policy appointment_collab_select on appointment for select using (
  collaborator_id = my_collaborator_id(tenant_id)
);
create policy appointment_collab_update on appointment for update
  using (collaborator_id = my_collaborator_id(tenant_id))
  with check (collaborator_id = my_collaborator_id(tenant_id));

-- checklist do atendimento: startAppointment semeia as etapas a partir de
-- service_type.default_steps e toggleStep marca cada uma.
create policy step_collab_all on appointment_step for all
  using (exists (
    select 1 from appointment a
     where a.id = appointment_step.appointment_id
       and a.collaborator_id = my_collaborator_id(appointment_step.tenant_id)
  ))
  with check (exists (
    select 1 from appointment a
     where a.id = appointment_step.appointment_id
       and a.collaborator_id = my_collaborator_id(appointment_step.tenant_id)
  ));

-- boletim de comportamento: ele preenche ao finalizar (upsert por appointment).
create policy behavior_collab_all on pet_behavior_report for all
  using (exists (
    select 1 from appointment a
     where a.id = pet_behavior_report.appointment_id
       and a.collaborator_id = my_collaborator_id(pet_behavior_report.tenant_id)
  ))
  with check (exists (
    select 1 from appointment a
     where a.id = pet_behavior_report.appointment_id
       and a.collaborator_id = my_collaborator_id(pet_behavior_report.tenant_id)
  ));

-- feedback e gravações dos atendimentos dele: leitura, para a tela do
-- atendimento e o histórico do pet.
create policy feedback_collab_select on feedback for select using (
  exists (
    select 1 from appointment a
     where a.id = feedback.appointment_id
       and a.collaborator_id = my_collaborator_id(feedback.tenant_id)
  )
);
create policy recording_collab_select on recording for select using (
  exists (
    select 1 from appointment a
     where a.id = recording.appointment_id
       and a.collaborator_id = my_collaborator_id(recording.tenant_id)
  )
);

-- pet: só os que ele atende.
create policy pet_collab_select on pet for select using (
  collab_sees_pet(tenant_id, id)
);

-- service_type: nome e default_steps do serviço que ele executa.
create policy service_collab_select on service_type for select using (
  my_collaborator_id(tenant_id) is not null
);

-- camera: startAppointment grava appointment.camera_id e liga o stream.
create policy camera_collab_select on camera for select using (
  my_collaborator_id(tenant_id) is not null
);

-- collaborator/collaborator_schedule: só o próprio cadastro. Ele não vê os
-- colegas nem os horários deles.
create policy collaborator_self_select on collaborator for select using (
  profile_id = auth.uid()
);
create policy collaborator_schedule_self_select on collaborator_schedule for select using (
  exists (
    select 1 from collaborator c
     where c.id = collaborator_schedule.collaborator_id
       and c.profile_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------
-- Ficha do pet para o colaborador, com o nome do tutor e nada mais.
--
-- RLS é por linha, não por coluna: dar select em `tutor` entregaria também
-- telefone e e-mail. Por isso o colaborador não recebe policy nenhuma
-- naquela tabela — é esta view (SECURITY DEFINER, filtrada por
-- collab_sees_pet) que expõe o nome, e só o nome.
--
-- Segura para conceder a `authenticated` em geral: para quem não é
-- colaborador do tenant, collab_sees_pet devolve false e a view vem vazia.
-- ---------------------------------------------------------------------
create view collaborator_pet
with (security_invoker = false)
as
select
  p.id,
  p.tenant_id,
  p.tutor_id,
  p.name,
  p.species,
  p.breed,
  p.size,
  p.birth_date,
  p.photo_path,
  p.notes,
  p.created_at,
  t.full_name as tutor_name
from pet p
join tutor t on t.id = p.tutor_id
where collab_sees_pet(p.tenant_id, p.id);

grant select on collaborator_pet to authenticated;
