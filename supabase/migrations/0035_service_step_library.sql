-- =====================================================================
-- Biblioteca de etapas do atendimento, por petshop.
--
-- Antes: cada serviço digitava suas etapas em service_type.default_steps
-- (text[], 0004). Renomear "Banho" exigia editar serviço por serviço, e o
-- mesmo passo acabava escrito de vários jeitos no checklist.
--
-- Agora: o petshop cadastra a biblioteca em Configurações → Etapas e cada
-- serviço REFERENCIA ids dela (service_type.step_ids, ordenado). Renomear na
-- biblioteca reflete em todos os serviços; atendimentos já iniciados não
-- mudam, porque appointment_step.label continua sendo snapshot (0001).
--
-- Por que uuid[] e não tabela de junção: a ordem é a do array (sem coluna
-- position para manter) e a escrita do serviço segue sendo um único update
-- atômico. A integridade que a FK daria vem dos dois triggers abaixo.
-- =====================================================================

create table service_step_template (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenant(id) on delete cascade,
  label      text not null check (btrim(label) <> '' and length(label) <= 60),
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index on service_step_template (tenant_id);

-- Um rótulo por petshop, ignorando caixa e espaços: é o que sustenta a
-- deduplicação do backfill e impede "Banho" + "banho " na mesma lista.
create unique index service_step_template_label_uq
  on service_step_template (tenant_id, lower(btrim(label)));

alter table service_step_template enable row level security;

-- Staff administra (mesmo molde de service_staff, 0001).
create policy service_step_template_staff on service_step_template for all
  using (is_staff(tenant_id)) with check (is_staff(tenant_id));

-- Colaborador só lê: startAppointment resolve id -> label para semear o
-- checklist (espelha service_collab_select, 0031). Sem esta policy o
-- colaborador iniciaria o atendimento com checklist vazio, em silêncio.
create policy service_step_template_collab_select on service_step_template
  for select using (my_collaborator_id(tenant_id) is not null);

-- O tutor não recebe policy: ele só enxerga appointment_step, que é snapshot.

-- ---------------------------------------------------------------------
-- Referência no serviço
-- ---------------------------------------------------------------------
alter table service_type
  add column if not exists step_ids uuid[] not null default '{}';

-- Sustenta "quais serviços usam a etapa X" (aviso de remoção em Configurações).
create index if not exists service_type_step_ids_idx
  on service_type using gin (step_ids);

comment on column service_type.step_ids is
  'Etapas do atendimento, em ordem, referenciando service_step_template(id).';

-- ---------------------------------------------------------------------
-- Triggers: o que a FK faria se isto fosse uma tabela de junção
-- ---------------------------------------------------------------------

-- Remover uma etapa da biblioteca a desvincula de todos os serviços do
-- tenant — equivalente a "on delete cascade", nunca sobra id pendurado. A UI
-- avisa antes quantos serviços serão afetados.
create or replace function service_step_template_detach()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update service_type
     set step_ids = array_remove(step_ids, old.id)
   where tenant_id = old.tenant_id
     and step_ids @> array[old.id];
  return old;
end;
$$;

create trigger service_step_template_detach_bd
before delete on service_step_template
for each row execute function service_step_template_detach();

-- Equivalente à FK + PK da junção: o id tem de existir na biblioteca DO MESMO
-- tenant e não pode repetir dentro do mesmo serviço.
create or replace function service_type_check_step_ids()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  total   int := coalesce(array_length(new.step_ids, 1), 0);
  unicos  int;
  invalid uuid;
begin
  if total = 0 then
    return new;
  end if;

  select count(distinct s) into unicos from unnest(new.step_ids) s;
  if unicos <> total then
    raise exception 'A mesma etapa não pode ser usada duas vezes no serviço'
      using errcode = '23514';
  end if;

  select s into invalid
    from unnest(new.step_ids) s
   where not exists (
     select 1 from service_step_template t
      where t.id = s and t.tenant_id = new.tenant_id
   )
   limit 1;

  if invalid is not null then
    raise exception 'Etapa % não pertence à biblioteca deste petshop', invalid
      using errcode = '23503';
  end if;

  return new;
end;
$$;

create trigger service_type_step_ids_ck
before insert or update of step_ids on service_type
for each row execute function service_type_check_step_ids();

-- ---------------------------------------------------------------------
-- Backfill: default_steps existentes viram biblioteca e cada serviço é
-- religado por id. Deduplicação por tenant, ignorando caixa e espaços; vence
-- o rótulo da primeira ocorrência (serviço mais antigo, ordem do array).
-- Idempotente: on conflict do nothing + só religa quem está com step_ids vazio.
-- ---------------------------------------------------------------------
do $$
declare
  religados int;
begin
  drop table if exists _step_backfill;

  create temporary table _step_backfill as
  select
    s.tenant_id,
    s.id                     as service_id,
    s.created_at             as service_created_at,
    s.name                   as service_name,
    btrim(step.label)        as label,
    lower(btrim(step.label)) as norm,
    step.ord                 as ord
  from service_type s
  cross join lateral unnest(s.default_steps) with ordinality as step(label, ord)
  where coalesce(btrim(step.label), '') <> '';

  -- 1) biblioteca: uma linha por (tenant, rótulo normalizado)
  insert into service_step_template (tenant_id, label, position)
  select
    f.tenant_id,
    f.label,
    (row_number() over (
       partition by f.tenant_id
       order by f.service_created_at, f.service_name, f.ord, f.norm
     ) - 1)::int
  from (
    select distinct on (b.tenant_id, b.norm)
           b.tenant_id, b.norm, b.label,
           b.service_created_at, b.service_name, b.ord
      from _step_backfill b
     order by b.tenant_id, b.norm, b.service_created_at, b.service_name, b.ord
  ) f
  on conflict do nothing;

  -- 2) religação: cada serviço aponta para os ids, na ordem original. O
  --    distinct on (service_id, norm) colapsa duplicatas DENTRO do mesmo
  --    serviço ("Banho" + "banho "), que o trigger rejeitaria.
  update service_type s
     set step_ids = m.ids
    from (
      select d.service_id, array_agg(t.id order by d.ord) as ids
        from (
          select distinct on (b.service_id, b.norm)
                 b.service_id, b.tenant_id, b.norm, b.ord
            from _step_backfill b
           order by b.service_id, b.norm, b.ord
        ) d
        join service_step_template t
          on t.tenant_id = d.tenant_id
         and lower(btrim(t.label)) = d.norm
       group by d.service_id
    ) m
   where s.id = m.service_id
     and s.step_ids = '{}';

  get diagnostics religados = row_count;
  raise notice '0035: % servicos religados a biblioteca de etapas', religados;

  drop table _step_backfill;
end $$;

-- default_steps fica como está: migrations rodam antes do código novo subir, e
-- dropar agora quebraria a tela de Serviços e a semeadura do checklist na
-- janela de deploy. Também é a prova auditável do backfill acima. Remover em
-- migração posterior, depois que a release estabilizar.
comment on column service_type.default_steps is
  'DEPRECADO (0035): substituído por step_ids + service_step_template. '
  'Mantido como backup do backfill; remover em migração futura.';
