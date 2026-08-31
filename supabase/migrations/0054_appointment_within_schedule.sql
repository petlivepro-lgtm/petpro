-- =====================================================================
-- O agendamento do tutor tem que caber no expediente do profissional.
--
-- A policy appointment_tutor_request (0001) deixa o tutor inserir direto
-- pela API do Supabase, então validar só na server action não basta: uma
-- requisição forjada marcaria a Ana num domingo às 3h. Este trigger fecha
-- a porta no banco, no mesmo espírito do appointment_slot_guard (0014).
--
-- O balcão continua livre: origin = 'STAFF' é o encaixe, que existe
-- justamente para furar a grade (caixa "Encaixe" no diálogo de
-- agendamento). Colaborador sem nenhuma janela cadastrada também passa —
-- significa que o petshop ainda não definiu o expediente dele, e barrá-lo
-- deixaria o profissional inagendável.
-- =====================================================================

create or replace function check_appointment_within_schedule()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  local_at timestamp;
begin
  if new.collaborator_id is null or new.scheduled_at is null
     or new.origin <> 'TUTOR'
     or new.status in ('REJECTED','CANCELLED') then
    return new;
  end if;

  -- O expediente é sempre horário do petshop; scheduled_at é timestamptz.
  local_at := new.scheduled_at at time zone 'America/Sao_Paulo';

  if exists (
    select 1 from collaborator_schedule s
    where s.collaborator_id = new.collaborator_id
  ) and not exists (
    select 1 from collaborator_schedule s
    where s.collaborator_id = new.collaborator_id
      and s.weekday = extract(dow from local_at)::smallint
      and local_at::time >= s.start_time
      and local_at::time < s.end_time
  ) then
    raise exception 'OFF_SCHEDULE' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger appointment_schedule_guard
  before insert or update of collaborator_id, scheduled_at, status, origin
  on appointment
  for each row execute function check_appointment_within_schedule();
