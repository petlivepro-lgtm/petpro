-- =====================================================================
-- Boletim de comportamento do pet ("boletim escolar" mensal).
--
-- A equipe dá notas por categoria ao finalizar cada atendimento; as notas
-- acumulam por pet e geram um selo de bom comportamento (a bonificação),
-- exibido no card do pet nos dois apps.
--
-- Por que uma tabela própria em vez de reusar `feedback`:
--   * `feedback` não guarda pet_id — a média por pet, exibida em listagens de
--     pets, exigiria join com appointment em toda query;
--   * `feedback.rating` é smallint 1..5 e a nota do boletim é a média das
--     categorias (decimal, ex.: 4,33);
--   * `feedback` aceita insert do tutor (avaliação do petshop); quem avalia o
--     comportamento é sempre o petshop.
--
-- O relato de comportamento que hoje é gravado como feedback STAFF_TO_TUTOR
-- (só `comment`) passa a ser `note` aqui; o histórico já existente é copiado
-- no backfill ao final. Nada é removido de `feedback`.
-- =====================================================================

create table pet_behavior_report (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id) on delete cascade,
  pet_id         uuid not null references pet(id) on delete cascade,
  appointment_id uuid not null references appointment(id) on delete cascade,
  -- Média 1..5 das categorias já normalizadas: categoria invertida
  -- (ex.: "Ansiedade", nota alta = ruim) entra como 6 - nota. Nula quando o
  -- petshop só escreveu a observação, sem dar notas.
  overall_score  numeric(3,2) check (overall_score between 1 and 5),
  -- [{category_id, label, inverted, value}] — snapshot de rótulo e inversão,
  -- para o boletim antigo continuar legível se o petshop editar as categorias
  -- (mesmo padrão de feedback.responses, 0011_feedback_responses.sql).
  responses      jsonb not null default '[]'::jsonb,
  note           text,
  author_id      uuid references profile(id) on delete set null,
  created_at     timestamptz not null default now(),
  -- Um boletim por atendimento: refinalizar o atendimento atualiza, não duplica.
  unique (appointment_id)
);

create index on pet_behavior_report (tenant_id);
create index pet_behavior_report_pet_idx on pet_behavior_report (pet_id, created_at desc);

-- ---------------------------------------------------------------------
-- RLS: staff do tenant gerencia tudo; tutor só lê os boletins dos seus pets
-- ---------------------------------------------------------------------
alter table pet_behavior_report enable row level security;

create policy pet_behavior_report_staff on pet_behavior_report for all
  using (is_staff(tenant_id)) with check (is_staff(tenant_id));

-- Tutor só lê — quem avalia o comportamento é o petshop.
create policy pet_behavior_report_tutor_select on pet_behavior_report for select using (
  exists (
    select 1 from pet p
    where p.id = pet_behavior_report.pet_id
      and p.tutor_id = my_tutor_id(pet_behavior_report.tenant_id)
  )
);

-- ---------------------------------------------------------------------
-- Média + nº de avaliações por pet: alimenta o card do pet nos dois apps sem
-- N+1 (uma query com `in (pet_ids)` resolve a lista inteira).
-- security_invoker = a RLS acima vale para quem consulta.
-- ---------------------------------------------------------------------
create view pet_behavior_summary
with (security_invoker = true)
as
select
  r.tenant_id,
  r.pet_id,
  count(*) filter (where r.overall_score is not null)::int as report_count,
  round(avg(r.overall_score), 2)                           as average_score,
  max(r.created_at)                                        as last_report_at
from pet_behavior_report r
group by r.tenant_id, r.pet_id;

grant select on pet_behavior_summary to authenticated;

-- ---------------------------------------------------------------------
-- Backfill: relatos já gravados como feedback STAFF_TO_TUTOR viram boletins
-- sem nota (só observação), preservando o histórico visível ao tutor.
-- distinct on = se houver mais de um relato no mesmo atendimento, vence o
-- mais recente. Idempotente via on conflict.
-- ---------------------------------------------------------------------
insert into pet_behavior_report (
  tenant_id, pet_id, appointment_id, overall_score, responses,
  note, author_id, created_at
)
select distinct on (f.appointment_id)
  f.tenant_id, a.pet_id, f.appointment_id, null, '[]'::jsonb,
  f.comment, f.author_id, f.created_at
from feedback f
join appointment a on a.id = f.appointment_id
where f.direction = 'STAFF_TO_TUTOR'
  and coalesce(btrim(f.comment), '') <> ''
order by f.appointment_id, f.created_at desc
on conflict (appointment_id) do nothing;
