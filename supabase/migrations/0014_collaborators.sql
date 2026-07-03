-- =====================================================================
-- Colaboradores do petshop (profissionais que atendem, sem login) e seus
-- horários semanais de trabalho. O tutor escolhe o colaborador ao agendar
-- e enxerga a agenda dele em slots; um slot ocupado (REQUESTED em diante)
-- fica bloqueado para os demais tutores. REJECTED/CANCELLED liberam o slot.
-- =====================================================================

create table collaborator (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant(id) on delete cascade,
  full_name   text not null,
  role_title  text,                          -- cargo (ex.: "Banhista")
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index on collaborator (tenant_id);

-- weekday: 0=domingo .. 6=sábado (mesma convenção de Date.getDay() no JS)
create table collaborator_schedule (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id) on delete cascade,
  collaborator_id uuid not null references collaborator(id) on delete cascade,
  weekday         smallint not null check (weekday between 0 and 6),
  start_time      time not null,
  end_time        time not null,
  check (start_time < end_time)
);
create index on collaborator_schedule (collaborator_id);
create index on collaborator_schedule (tenant_id);

-- Profissional responsável pelo agendamento. Não reutiliza appointment.staff_id
-- porque aquele referencia profile(id) (usuário com login), e colaborador não tem.
alter table appointment add column collaborator_id uuid references collaborator(id) on delete set null;
create index on appointment (collaborator_id, scheduled_at);

-- ---------------------------------------------------------------------
-- RLS: staff do tenant gerencia tudo; tutor só lê colaboradores ativos
-- (e os horários deles) do próprio tenant, para montar a agenda.
-- ---------------------------------------------------------------------
alter table collaborator enable row level security;
alter table collaborator_schedule enable row level security;

create policy collaborator_staff on collaborator for all
  using (is_staff(tenant_id)) with check (is_staff(tenant_id));
create policy collaborator_tutor_read on collaborator for select using (
  active and my_tutor_id(tenant_id) is not null
);

create policy collaborator_schedule_staff on collaborator_schedule for all
  using (is_staff(tenant_id)) with check (is_staff(tenant_id));
create policy collaborator_schedule_tutor_read on collaborator_schedule for select using (
  my_tutor_id(tenant_id) is not null
  and exists (select 1 from collaborator c where c.id = collaborator_id and c.active)
);

-- ---------------------------------------------------------------------
-- Slots ocupados de um colaborador num intervalo. SECURITY DEFINER para o
-- tutor descobrir a ocupação sem enxergar appointments de outros tutores
-- (a RLS de appointment só mostra os dele) — devolve apenas os instantes.
-- ---------------------------------------------------------------------
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
    and (is_staff(p_tenant_id) or my_tutor_id(p_tenant_id) is not null);
$$;

-- ---------------------------------------------------------------------
-- Guarda contra corrida: impede dois agendamentos ativos no mesmo
-- colaborador + horário. Não dá para usar índice único porque uma
-- solicitação multi-serviço cria N linhas irmãs com o mesmo scheduled_at
-- (mesmo request_group_id) — essas podem coexistir. O advisory lock
-- serializa transações concorrentes no mesmo colaborador+horário; a
-- segunda só prossegue após o commit da primeira e aí o exists a barra.
-- ---------------------------------------------------------------------
create or replace function check_collaborator_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.collaborator_id is null or new.scheduled_at is null
     or new.status in ('REJECTED','CANCELLED') then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtext(new.collaborator_id::text || new.scheduled_at::text)
  );

  if exists (
    select 1 from appointment a
    where a.collaborator_id = new.collaborator_id
      and a.scheduled_at = new.scheduled_at
      and a.status in ('REQUESTED','CONFIRMED','CHECKED_IN','IN_PROGRESS','COMPLETED')
      and a.id <> new.id
      and (new.request_group_id is null or a.request_group_id is distinct from new.request_group_id)
  ) then
    raise exception 'SLOT_TAKEN' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger appointment_slot_guard
  before insert or update of collaborator_id, scheduled_at, status
  on appointment
  for each row execute function check_collaborator_slot();
