-- =====================================================================
-- Horário fixo do Clubinho: "marley, toda sexta às 11h, banho e tosa".
--
-- Até aqui o Clubinho entregava saldo, não calendário: o plano diz "4
-- banhos por mês" e alguém tinha de ligar toda semana para marcar. Mas o
-- pacote é vendido junto com um combinado de dia e hora, e esse combinado
-- não existia em lugar nenhum do sistema.
--
-- clubinho_schedule guarda o combinado; clubinho_materialize_bookings
-- transforma ele nos agendamentos do ciclo, descontando do saldo que já
-- existe (0047). Quem define é o petshop — o app do tutor só mostra.
--
-- Duas regras decididas com o petshop, e que explicam quase todo o código
-- abaixo:
--
--   * o ciclo pode ter mais ocorrências do que banhos (outubro tem 5
--     sextas, o plano dá 4). A 5ª NÃO é agendada: o plano vendeu 4 e
--     entrega 4. A tela mostra a data como fora do pacote.
--   * o horário fixo pode cair num slot que outro cliente já ocupou.
--     Aquela data é pulada e reportada, para o balcão remarcar na mão —
--     nunca empurrada para outro horário sem combinar com o tutor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- O combinado
-- ---------------------------------------------------------------------
create table clubinho_schedule (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id) on delete cascade,
  subscription_id uuid not null references clubinho_subscription(id) on delete cascade,
  -- 0=domingo .. 6=sábado, mesma convenção de collaborator_schedule (0014)
  -- e de Date.getDay() no JS.
  weekday         smallint not null check (weekday between 0 and 6),
  start_time      time not null,
  service_type_id uuid not null references service_type(id) on delete cascade,
  collaborator_id uuid not null references collaborator(id) on delete cascade,
  active          boolean not null default true,
  created_by      uuid references profile(id) on delete set null,
  created_at      timestamptz not null default now(),
  -- Dois combinados no mesmo dia e hora seriam o mesmo agendamento duas vezes.
  unique (subscription_id, weekday, start_time)
);
create index clubinho_schedule_subscription_idx
  on clubinho_schedule (subscription_id) where active;
create index clubinho_schedule_collaborator_idx on clubinho_schedule (collaborator_id);

comment on table clubinho_schedule is
  'Dia da semana e horário fixos em que o pet recebe um serviço do pacote. Vira agendamento por clubinho_materialize_bookings.';

/**
 * O serviço combinado tem de estar no plano.
 *
 * Sem item no plano não existe clubinho_credit daquele serviço, e o
 * combinado nunca teria como ser cumprido: a rotina o ignoraria em silêncio
 * toda semana. Melhor recusar no cadastro, com o motivo na tela.
 *
 * Também confere o tenant do serviço e do profissional: as FKs sozinhas não
 * olham tenant, e um id vindo de fora viraria agendamento com o profissional
 * de outro petshop.
 */
create or replace function clubinho_schedule_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub clubinho_subscription;
begin
  select * into v_sub from clubinho_subscription where id = new.subscription_id;
  if not found then
    raise exception 'Assinatura não encontrada';
  end if;

  new.tenant_id := v_sub.tenant_id;

  if not exists (
    select 1 from clubinho_plan_item i
    where i.plan_id = v_sub.plan_id and i.service_type_id = new.service_type_id
  ) then
    raise exception 'Este serviço não faz parte do plano assinado';
  end if;

  if not exists (
    select 1 from collaborator c
    where c.id = new.collaborator_id and c.tenant_id = v_sub.tenant_id and c.active
  ) then
    raise exception 'Profissional inválido ou inativo';
  end if;

  return new;
end;
$$;

create trigger clubinho_schedule_check
  before insert or update on clubinho_schedule
  for each row execute function clubinho_schedule_check();

-- ---------------------------------------------------------------------
-- Vínculo com o agendamento gerado
-- ---------------------------------------------------------------------

-- Chave de idempotência da rotina. Vale para QUALQUER status: um
-- agendamento que o balcão cancelou na mão continua ocupando a data, e por
-- isso não é recriado na próxima rodada — cancelar tem de significar algo.
alter table appointment
  add column clubinho_schedule_id uuid references clubinho_schedule(id) on delete set null;

create unique index appointment_clubinho_schedule_slot_uniq
  on appointment (clubinho_schedule_id, scheduled_at)
  where clubinho_schedule_id is not null;

comment on column appointment.clubinho_schedule_id is
  'Combinado do Clubinho que gerou este agendamento. Nulo = agendamento avulso.';

-- ---------------------------------------------------------------------
-- Datas de um combinado dentro do ciclo corrente
-- ---------------------------------------------------------------------

/**
 * As ocorrências do combinado no ciclo, de hoje em diante, em ordem.
 *
 * O recorte é do próximo horário em diante, e não do início do dia: às 18h
 * de uma sexta, o slot das 11h daquela mesma sexta já passou — agendar
 * retroativamente um banho que não aconteceu só sujaria a agenda. O passado
 * do ciclo já está contado no saldo (quantity_used).
 *
 * O horário sai no fuso do petshop, não em UTC — sem o `at time zone`,
 * "11:00" viraria 11h UTC, que é 08h no balcão. Mesma constante que
 * br_datetime (0040) usa para escrever as datas das notificações.
 *
 * O `::date` não é decorativo: generate_series com argumentos `date` e passo
 * `interval` resolve para a versão timestamptz e devolve meia-noite UTC. Sem
 * o cast, o `at time zone` receberia um timestamptz — o que faz a conversão
 * na direção contrária, devolvendo hora local como timestamp — e o valor
 * ainda seria reinterpretado em UTC na volta. Duas trocas de fuso empilhadas
 * transformavam 11:00 em 05:00.
 */
create or replace function clubinho_schedule_occurrences(
  p_schedule_id uuid,
  p_from date,
  p_to   date
)
returns setof timestamptz
language sql
stable
set search_path = public
as $$
  select (g.d::date + s.start_time) at time zone 'America/Sao_Paulo'
  from clubinho_schedule s
  cross join generate_series(
    greatest(p_from, current_date),
    p_to,
    interval '1 day'
  ) as g(d)
  where s.id = p_schedule_id
    and extract(dow from g.d) = s.weekday
    and (g.d::date + s.start_time) at time zone 'America/Sao_Paulo' >= now()
  order by 1;
$$;

-- ---------------------------------------------------------------------
-- Materialização
-- ---------------------------------------------------------------------

/**
 * Transforma os combinados nos agendamentos do ciclo corrente.
 *
 * Sem cron no projeto, roda no carregamento das telas do Clubinho, junto de
 * clubinho_sync_periods (0047) — que precisa vir ANTES, para o ciclo do mês
 * já estar aberto quando esta função procurar o saldo.
 *
 * Orçamento do ciclo, por serviço:
 *
 *     quantity_total − (agendamentos já ligados àquele crédito)
 *
 * A subtração conta tudo que está de pé, do REQUESTED ao COMPLETED. É o que
 * faz o banho avulso do meio do mês (o tutor passou na loja e descontou do
 * pacote) reduzir o que ainda será agendado — senão o pet acabaria com 5
 * banhos num plano de 4.
 *
 * SLOT_TAKEN é capturado por ocorrência e não derruba a rodada: a data fica
 * sem agendamento e clubinho_schedule_preview a devolve como CONFLICT.
 */
create or replace function clubinho_materialize_bookings(p_tenant uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row     record;
  v_when    timestamptz;
  v_budget  integer;
  v_created integer := 0;
begin
  if p_tenant is null then return 0; end if;
  -- Agendar é ato do petshop. O app do tutor lê o combinado, mas quem
  -- materializa é quem tem a agenda na mão.
  if not is_staff(p_tenant) then return 0; end if;

  for v_row in
    select
      sch.id           as schedule_id,
      sch.service_type_id,
      sch.collaborator_id,
      sub.id           as subscription_id,
      sub.pet_id,
      sub.tutor_id,
      per.period_start,
      per.period_end,
      cr.id            as credit_id,
      cr.quantity_total
    from clubinho_schedule sch
    join clubinho_subscription sub on sub.id = sch.subscription_id
    join clubinho_period per
      on per.subscription_id = sub.id
     and current_date between per.period_start and per.period_end
    join clubinho_credit cr
      on cr.period_id = per.id
     and cr.service_type_id = sch.service_type_id
    where sch.tenant_id = p_tenant
      and sch.active
      and sub.status = 'ACTIVE'
    order by sch.weekday, sch.start_time
  loop
    select v_row.quantity_total - count(*)
    into v_budget
    from appointment a
    where a.clubinho_credit_id = v_row.credit_id
      and a.status in ('REQUESTED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED');

    for v_when in
      select * from clubinho_schedule_occurrences(
        v_row.schedule_id, v_row.period_start, v_row.period_end
      )
    loop
      exit when v_budget <= 0;

      -- Já existe (inclusive cancelado na mão): a data está resolvida.
      if exists (
        select 1 from appointment a
        where a.clubinho_schedule_id = v_row.schedule_id and a.scheduled_at = v_when
      ) then
        continue;
      end if;

      begin
        insert into appointment (
          tenant_id, pet_id, tutor_id, service_type_id, collaborator_id,
          origin, status, scheduled_at, clubinho_credit_id, clubinho_schedule_id
        )
        values (
          p_tenant, v_row.pet_id, v_row.tutor_id, v_row.service_type_id,
          v_row.collaborator_id, 'STAFF', 'CONFIRMED', v_when,
          v_row.credit_id, v_row.schedule_id
        );
        v_budget  := v_budget - 1;
        v_created := v_created + 1;
      exception
        when others then
          -- SLOT_TAKEN (0014) e qualquer outro tropeço de UMA data não podem
          -- impedir as demais de serem agendadas. Vira CONFLICT no preview.
          null;
      end;
    end loop;
  end loop;

  return v_created;
end;
$$;
revoke execute on function clubinho_materialize_bookings(uuid) from public;
grant execute on function clubinho_materialize_bookings(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Leitura: o que o ciclo tem pela frente, e por que faltou o que faltou
-- ---------------------------------------------------------------------

/**
 * As ocorrências do ciclo com o estado de cada uma. Existe para a tela não
 * reimplementar a regra de orçamento em TypeScript e sair do sincronismo
 * com a materialização.
 *
 *   BOOKED    agendado, esperando o dia
 *   DONE      atendimento já concluído
 *   CANCELLED o balcão cancelou aquela data na mão
 *   CONFLICT  o profissional já estava ocupado no horário
 *   NO_CREDIT fora do pacote — o saldo do ciclo acabou antes desta data
 */
create or replace function clubinho_schedule_preview(p_subscription uuid)
returns table (
  schedule_id       uuid,
  occurs_at         timestamptz,
  service_name      text,
  collaborator_name text,
  appointment_id    uuid,
  state             text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row    record;
  v_when   timestamptz;
  v_budget integer;
  v_appt   record;
begin
  if not exists (
    select 1 from clubinho_subscription s
    where s.id = p_subscription
      and (is_staff(s.tenant_id) or s.tutor_id = my_tutor_id(s.tenant_id))
  ) then
    return;
  end if;

  for v_row in
    select
      sch.id as schedule_id,
      st.name as service_name,
      c.full_name as collaborator_name,
      per.period_start,
      per.period_end,
      cr.id as credit_id,
      cr.quantity_total
    from clubinho_schedule sch
    join clubinho_subscription sub on sub.id = sch.subscription_id
    join service_type st on st.id = sch.service_type_id
    join collaborator c on c.id = sch.collaborator_id
    join clubinho_period per
      on per.subscription_id = sub.id
     and current_date between per.period_start and per.period_end
    join clubinho_credit cr
      on cr.period_id = per.id
     and cr.service_type_id = sch.service_type_id
    where sch.subscription_id = p_subscription and sch.active
    order by sch.weekday, sch.start_time
  loop
    -- Mesma conta da materialização, menos as datas que este próprio
    -- combinado já ocupou (elas aparecem abaixo com o estado real).
    select v_row.quantity_total - count(*)
    into v_budget
    from appointment a
    where a.clubinho_credit_id = v_row.credit_id
      and a.status in ('REQUESTED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED')
      and a.clubinho_schedule_id is distinct from v_row.schedule_id;

    for v_when in
      select * from clubinho_schedule_occurrences(
        v_row.schedule_id, v_row.period_start, v_row.period_end
      )
    loop
      select a.id, a.status into v_appt
      from appointment a
      where a.clubinho_schedule_id = v_row.schedule_id and a.scheduled_at = v_when;

      schedule_id       := v_row.schedule_id;
      occurs_at         := v_when;
      service_name      := v_row.service_name;
      collaborator_name := v_row.collaborator_name;
      appointment_id    := v_appt.id;

      if v_appt.id is null then
        -- Sem agendamento: ou o saldo tinha acabado, ou o slot estava ocupado.
        if v_budget <= 0 then
          state := 'NO_CREDIT';
        else
          state := 'CONFLICT';
          v_budget := v_budget - 1;
        end if;
      elsif v_appt.status = 'COMPLETED' then
        state := 'DONE';
        v_budget := v_budget - 1;
      elsif v_appt.status in ('REJECTED', 'CANCELLED') then
        state := 'CANCELLED';
      else
        state := 'BOOKED';
        v_budget := v_budget - 1;
      end if;

      return next;
    end loop;
  end loop;
end;
$$;
revoke execute on function clubinho_schedule_preview(uuid) from public;
grant execute on function clubinho_schedule_preview(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table clubinho_schedule enable row level security;

-- Todo o staff lê (o colaborador precisa entender por que o pet aparece na
-- agenda dele toda sexta); só quem administra escreve.
create policy clubinho_schedule_staff_read on clubinho_schedule for select
  using (is_staff(tenant_id));
create policy clubinho_schedule_staff_write on clubinho_schedule for all
  using (can_manage_finance(tenant_id)) with check (can_manage_finance(tenant_id));

-- O tutor vê o combinado do próprio pet, sem poder mexer: quem organiza a
-- agenda dos profissionais é o petshop.
create policy clubinho_schedule_tutor_read on clubinho_schedule for select
  using (exists (
    select 1 from clubinho_subscription s
    where s.id = subscription_id and s.tutor_id = my_tutor_id(s.tenant_id)
  ));

notify pgrst, 'reload schema';
