-- =====================================================================
-- Clubinho: planos personalizados, assinatura por pet e saldo de serviços.
--
-- O que existia (0038) era um booleano em `tutor`: respondia "tem ou não
-- tem" e nada mais. Quem atende no balcão precisa da pergunta seguinte —
-- "quantos banhos ainda sobraram deste mês?" — e o dono precisa vender
-- mais de um pacote, com o preço e a quantidade que ele escolher.
--
-- Modelo:
--   clubinho_plan          pacote que o petshop monta (nome, preço, ciclo)
--   clubinho_plan_item     quantos de cada serviço o pacote dá por ciclo
--   clubinho_subscription  assinatura de UM pet (não do tutor)
--   clubinho_period        cada ciclo faturado da assinatura
--   clubinho_credit        saldo por serviço dentro do ciclo
--   clubinho_usage         qual atendimento gastou qual crédito
--
-- A assinatura é do pet, e não do tutor, porque o saldo é consumido por
-- pet: tutor com dois cães costuma pôr só um no Clubinho, e um saldo
-- compartilhado tornaria "4 banhos" ambíguo entre 4 por pet e 4 no total.
-- `tutor.clubinho` sobrevive como cache derivado (ver o fim do arquivo).
--
-- Financeiro: a receita entra na mensalidade, uma vez por ciclo. O
-- atendimento coberto consome crédito e NÃO gera receita — senão o mesmo
-- banho entraria duas vezes no caixa.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Duração de um ciclo
-- ---------------------------------------------------------------------

/**
 * Intervalo de renovação do plano. Meses são interval '1 month' e não 30
 * dias de propósito: quem assina 31 de janeiro renova 28 de fevereiro, e
 * não 2 de março.
 */
create or replace function clubinho_cycle_interval(
  p_cycle clubinho_cycle,
  p_days integer
)
returns interval
language sql
immutable
as $$
  select case p_cycle
    when 'WEEKLY'     then interval '7 days'
    when 'BIWEEKLY'   then interval '15 days'
    when 'MONTHLY'    then interval '1 month'
    when 'BIMONTHLY'  then interval '2 months'
    when 'QUARTERLY'  then interval '3 months'
    when 'SEMIANNUAL' then interval '6 months'
    when 'ANNUAL'     then interval '1 year'
    when 'CUSTOM'     then make_interval(days => greatest(coalesce(p_days, 30), 1))
  end;
$$;

-- ---------------------------------------------------------------------
-- Planos
-- ---------------------------------------------------------------------
create table clubinho_plan (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenant(id) on delete cascade,
  name         text not null check (length(btrim(name)) between 2 and 80),
  description  text check (description is null or length(description) <= 500),
  price_cents  integer not null default 0 check (price_cents >= 0),
  cycle        clubinho_cycle not null default 'MONTHLY',
  -- Só faz sentido em CUSTOM; nos demais o intervalo é fixo.
  cycle_days   integer check (cycle_days is null or cycle_days between 1 and 365),
  -- Saldo não usado entra no ciclo seguinte. Fora do padrão do mercado
  -- (banho não gasto costuma vencer), por isso nasce desligado.
  rollover     boolean not null default false,
  active       boolean not null default true,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  constraint clubinho_plan_custom_days check (cycle <> 'CUSTOM' or cycle_days is not null)
);
create index clubinho_plan_tenant_idx on clubinho_plan (tenant_id, position, name);
-- Dois "Clubinho Mensal" no mesmo petshop só confundem quem vende.
create unique index clubinho_plan_tenant_name_uniq
  on clubinho_plan (tenant_id, lower(btrim(name)));

comment on table clubinho_plan is
  'Pacote de serviços recorrente que o petshop monta. O ciclo é o intervalo de renovação/cobrança, não a frequência das idas ao banho.';

create table clubinho_plan_item (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id) on delete cascade,
  plan_id         uuid not null references clubinho_plan(id) on delete cascade,
  -- Excluir o serviço tira o item do plano: um pacote que dá "4x" de um
  -- serviço que não existe mais não tem o que entregar.
  service_type_id uuid not null references service_type(id) on delete cascade,
  quantity        integer not null check (quantity between 1 and 99),
  unique (plan_id, service_type_id)
);
create index clubinho_plan_item_service_idx on clubinho_plan_item (service_type_id);

comment on column clubinho_plan_item.quantity is
  'Quantos atendimentos deste serviço o plano dá por ciclo. Mensal com 4 banhos = 4.';

-- ---------------------------------------------------------------------
-- Assinaturas (uma por pet)
-- ---------------------------------------------------------------------
create table clubinho_subscription (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenant(id) on delete cascade,
  pet_id              uuid not null references pet(id) on delete cascade,
  -- Denormalizado do pet por trigger: a listagem de tutores e a RLS do app
  -- do tutor filtram por ele sem precisar de join.
  tutor_id            uuid not null references tutor(id) on delete cascade,
  -- restrict: um plano com assinante não some do cadastro por acidente.
  plan_id             uuid not null references clubinho_plan(id) on delete restrict,
  status              clubinho_subscription_status not null default 'ACTIVE',
  -- Preço contratado, copiado do plano na adesão. Reajustar o plano não
  -- mexe em quem já assinou — o petshop decide quando repassar.
  price_cents         integer not null check (price_cents >= 0),
  started_on          date not null default current_date,
  period_start        date not null,
  period_end          date not null check (period_end >= period_start),
  auto_renew          boolean not null default true,
  -- Forma de pagamento da recorrência: é ela que a renovação usa para
  -- lançar a receita sem passar pelo balcão.
  payment_method      payment_method,
  terminal_id         uuid references payment_terminal(id) on delete set null,
  installments        smallint not null default 1 check (installments between 1 and 24),
  notes               text check (notes is null or length(notes) <= 500),
  cancelled_at        timestamptz,
  cancelled_by        uuid references profile(id) on delete set null,
  cancellation_reason text check (cancellation_reason is null or length(cancellation_reason) <= 500),
  created_by          uuid references profile(id) on delete set null,
  created_at          timestamptz not null default now(),
  constraint clubinho_subscription_installments_credit_only
    check (installments = 1 or payment_method = 'CREDIT_CARD')
);
create index clubinho_subscription_tenant_idx on clubinho_subscription (tenant_id, status);
create index clubinho_subscription_tutor_idx  on clubinho_subscription (tutor_id);
create index clubinho_subscription_plan_idx   on clubinho_subscription (plan_id);
create index clubinho_subscription_renew_idx  on clubinho_subscription (period_end)
  where status = 'ACTIVE';

-- Um pet não assina dois pacotes ao mesmo tempo: com dois saldos abertos
-- ninguém saberia de qual descontar o banho. Encerradas não contam, então
-- o histórico de quem já assinou continua inteiro.
create unique index clubinho_subscription_open_pet_uniq
  on clubinho_subscription (pet_id)
  where status in ('ACTIVE', 'PAUSED');

-- ---------------------------------------------------------------------
-- Ciclos faturados e saldo
-- ---------------------------------------------------------------------
create table clubinho_period (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id) on delete cascade,
  subscription_id uuid not null references clubinho_subscription(id) on delete cascade,
  period_start    date not null,
  period_end      date not null check (period_end >= period_start),
  price_cents     integer not null check (price_cents >= 0),
  payment_method  payment_method,
  terminal_id     uuid references payment_terminal(id) on delete set null,
  installments    smallint not null default 1 check (installments between 1 and 24),
  created_by      uuid references profile(id) on delete set null,
  created_at      timestamptz not null default now(),
  -- Chave de idempotência da renovação: rodar a rotina duas vezes no mesmo
  -- dia não abre o ciclo (nem lança a mensalidade) duas vezes.
  unique (subscription_id, period_start)
);
create index clubinho_period_subscription_idx
  on clubinho_period (subscription_id, period_start desc);

create table clubinho_credit (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id) on delete cascade,
  subscription_id uuid not null references clubinho_subscription(id) on delete cascade,
  period_id       uuid not null references clubinho_period(id) on delete cascade,
  service_type_id uuid references service_type(id) on delete set null,
  -- Snapshot: o saldo continua legível depois que o serviço é renomeado
  -- ou sai do catálogo.
  service_name    text not null,
  quantity_total  integer not null check (quantity_total > 0),
  quantity_used   integer not null default 0 check (quantity_used >= 0),
  constraint clubinho_credit_not_overdrawn check (quantity_used <= quantity_total),
  unique (period_id, service_type_id)
);
create index clubinho_credit_subscription_idx on clubinho_credit (subscription_id);
create index clubinho_credit_service_idx on clubinho_credit (service_type_id);

create table clubinho_usage (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id) on delete cascade,
  subscription_id uuid not null references clubinho_subscription(id) on delete cascade,
  credit_id       uuid not null references clubinho_credit(id) on delete cascade,
  -- unique: um atendimento gasta no máximo um crédito, sempre.
  appointment_id  uuid unique references appointment(id) on delete cascade,
  service_type_id uuid references service_type(id) on delete set null,
  used_at         timestamptz not null default now(),
  created_by      uuid references profile(id) on delete set null
);
create index clubinho_usage_credit_idx on clubinho_usage (credit_id, used_at);
create index clubinho_usage_tenant_idx on clubinho_usage (tenant_id, used_at desc);

-- ---------------------------------------------------------------------
-- Ligações com o que já existia
-- ---------------------------------------------------------------------

-- Receita da mensalidade. unique em coluna nullable: uma receita automática
-- por ciclo, sem atrapalhar os lançamentos que não são do Clubinho.
alter table finance_entry
  add column clubinho_period_id uuid unique references clubinho_period(id) on delete set null;

-- Crédito que este atendimento consome. Nulo = atendimento cobrado normal.
-- É escolha do operador ao finalizar, não automática: o tutor pode preferir
-- pagar avulso e guardar o banho do pacote para o fim do mês.
alter table appointment
  add column clubinho_credit_id uuid references clubinho_credit(id) on delete set null;
create index appointment_clubinho_credit_idx on appointment (clubinho_credit_id)
  where clubinho_credit_id is not null;

-- ---------------------------------------------------------------------
-- Coerência: tenant e tutor da assinatura saem do pet
-- ---------------------------------------------------------------------

/**
 * O formulário manda só pet_id e plan_id. tenant_id e tutor_id vêm daqui —
 * assim não existe assinatura apontando para o pet de um petshop e o plano
 * de outro, nem para um tutor que não é o dono do pet.
 */
create or replace function clubinho_subscription_fill()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet_tenant uuid;
  v_pet_tutor  uuid;
  v_plan_tenant uuid;
  v_plan_active boolean;
begin
  select p.tenant_id, p.tutor_id into v_pet_tenant, v_pet_tutor
  from pet p where p.id = new.pet_id;
  if v_pet_tenant is null then
    raise exception 'Pet não encontrado';
  end if;

  select pl.tenant_id, pl.active into v_plan_tenant, v_plan_active
  from clubinho_plan pl where pl.id = new.plan_id;
  if v_plan_tenant is null then
    raise exception 'Plano não encontrado';
  end if;
  if v_plan_tenant <> v_pet_tenant then
    raise exception 'O plano é de outro petshop';
  end if;
  -- Plano inativo só barra adesão nova; quem já assinou continua com o dele
  -- até cancelar, senão desativar um plano derrubaria a base inteira.
  if tg_op = 'INSERT' and not v_plan_active then
    raise exception 'Este plano está inativo';
  end if;

  new.tenant_id := v_pet_tenant;
  new.tutor_id  := v_pet_tutor;
  return new;
end;
$$;

create trigger clubinho_subscription_fill
  before insert or update of pet_id, plan_id on clubinho_subscription
  for each row execute function clubinho_subscription_fill();

-- ---------------------------------------------------------------------
-- Abrir um ciclo: cria o período, os créditos e a receita da mensalidade
-- ---------------------------------------------------------------------

/**
 * Idempotente por (subscription_id, period_start): chamar duas vezes para o
 * mesmo início de ciclo devolve o período que já existe, sem recriar saldo
 * nem duplicar a receita. É o que permite a rotina de renovação rodar em
 * todo carregamento de página sem medo.
 *
 * Quando o plano tem rollover, o que sobrou do ciclo anterior soma ao total
 * do novo — a sobra é adicionada em cima da quantidade do plano, e não a
 * substitui.
 */
create or replace function clubinho_open_period(
  p_subscription_id uuid,
  p_period_start    date,
  p_created_by      uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub      clubinho_subscription;
  v_plan     clubinho_plan;
  v_period_id uuid;
  v_prev_id  uuid;
  v_end      date;
  v_desc     text;
  v_snapshot jsonb;
begin
  select * into v_sub from clubinho_subscription where id = p_subscription_id;
  if not found then raise exception 'Assinatura não encontrada'; end if;

  select * into v_plan from clubinho_plan where id = v_sub.plan_id;
  if not found then raise exception 'Plano não encontrado'; end if;

  v_end := (p_period_start
            + clubinho_cycle_interval(v_plan.cycle, v_plan.cycle_days)
            - interval '1 day')::date;

  -- Último ciclo antes deste, para o rollover.
  select id into v_prev_id
  from clubinho_period
  where subscription_id = p_subscription_id and period_start < p_period_start
  order by period_start desc
  limit 1;

  insert into clubinho_period (
    tenant_id, subscription_id, period_start, period_end, price_cents,
    payment_method, terminal_id, installments, created_by
  )
  values (
    v_sub.tenant_id, p_subscription_id, p_period_start, v_end, v_sub.price_cents,
    v_sub.payment_method, v_sub.terminal_id, v_sub.installments,
    coalesce(p_created_by, auth.uid())
  )
  on conflict (subscription_id, period_start) do nothing
  returning id into v_period_id;

  -- Já existia: outra aba (ou outra requisição) abriu o mesmo ciclo antes.
  if v_period_id is null then
    select id into v_period_id
    from clubinho_period
    where subscription_id = p_subscription_id and period_start = p_period_start;
    return v_period_id;
  end if;

  insert into clubinho_credit (
    tenant_id, subscription_id, period_id, service_type_id, service_name,
    quantity_total, quantity_used
  )
  select
    v_sub.tenant_id,
    p_subscription_id,
    v_period_id,
    i.service_type_id,
    st.name,
    i.quantity + case
      when v_plan.rollover and v_prev_id is not null then coalesce((
        select c.quantity_total - c.quantity_used
        from clubinho_credit c
        where c.period_id = v_prev_id and c.service_type_id = i.service_type_id
      ), 0)
      else 0
    end,
    0
  from clubinho_plan_item i
  join service_type st on st.id = i.service_type_id
  where i.plan_id = v_plan.id;

  -- A vigência da assinatura acompanha o ciclo aberto.
  update clubinho_subscription
     set period_start = p_period_start,
         period_end   = v_end,
         status       = 'ACTIVE'
   where id = p_subscription_id;

  -- Receita da mensalidade. Sem forma de pagamento cadastrada não há
  -- lançamento: finance_entry recusa receita sem forma (0026), e adivinhar
  -- "dinheiro" sujaria o caixa. A tela avisa quando isso acontece.
  if v_sub.price_cents > 0 and v_sub.payment_method is not null then
    select
      'Clubinho: ' || v_plan.name || ' — ' || p.name,
      jsonb_build_object(
        'kind', 'CLUBINHO',
        'customer', jsonb_build_object(
          'id', t.id, 'name', t.full_name, 'cpf', t.cpf,
          'phone', t.phone, 'email', t.email
        ),
        'pet', jsonb_build_object('id', p.id, 'name', p.name),
        'plan', jsonb_build_object(
          'id', v_plan.id, 'name', v_plan.name, 'cycle', v_plan.cycle
        ),
        'period_start', p_period_start,
        'period_end', v_end,
        'total_cents', v_sub.price_cents
      )
    into v_desc, v_snapshot
    from pet p
    join tutor t on t.id = v_sub.tutor_id
    where p.id = v_sub.pet_id;

    insert into finance_entry (
      tenant_id, type, source, description, category, amount_cents,
      occurred_on, clubinho_period_id, payment_method, snapshot, created_by,
      terminal_id, installments
    )
    values (
      v_sub.tenant_id, 'INCOME', 'CLUBINHO', v_desc, 'clubinho', v_sub.price_cents,
      p_period_start, v_period_id, v_sub.payment_method,
      coalesce(v_snapshot, '{}'::jsonb), coalesce(p_created_by, auth.uid()),
      v_sub.terminal_id, v_sub.installments
    )
    on conflict (clubinho_period_id) do nothing;
  end if;

  return v_period_id;
end;
$$;
revoke execute on function clubinho_open_period(uuid, date, uuid) from public;

/**
 * Abre o primeiro ciclo assim que a assinatura nasce. Fica em trigger, e não
 * na server action, para que qualquer caminho de criação (importação, seed,
 * outra tela) já saia com saldo — assinatura sem crédito é a mesma coisa que
 * o booleano antigo.
 */
create or replace function clubinho_subscription_bootstrap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'ACTIVE' then
    perform clubinho_open_period(new.id, new.period_start, new.created_by);
  end if;
  return new;
end;
$$;

create trigger clubinho_subscription_bootstrap
  after insert on clubinho_subscription
  for each row execute function clubinho_subscription_bootstrap();

-- ---------------------------------------------------------------------
-- Renovação
-- ---------------------------------------------------------------------

/**
 * Fecha o que venceu e abre o ciclo seguinte de quem renova sozinho.
 *
 * Sem cron no projeto, a rotina é chamada por RPC no carregamento das telas
 * que dependem do saldo. É barata (o índice parcial só enxerga assinaturas
 * ativas vencidas) e idempotente, então rodar demais não custa nada.
 *
 * O laço trata a assinatura esquecida por vários ciclos, mas para em 24
 * voltas: se um período de 1 dia ficou dois anos parado, é bug — melhor
 * o saldo ficar atrasado do que a função varrer o banco.
 */
create or replace function clubinho_sync_periods(p_tenant uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub    record;
  v_next   date;
  v_end    date;
  v_guard  integer;
  v_opened integer := 0;
begin
  if p_tenant is null then return 0; end if;
  -- Staff do petshop ou tutor dele. Sem isso qualquer autenticado
  -- disparia a rotina (e a receita) de um tenant alheio.
  if not is_staff(p_tenant) and my_tutor_id(p_tenant) is null then
    return 0;
  end if;

  for v_sub in
    select s.id, s.period_end, s.auto_renew, s.plan_id
    from clubinho_subscription s
    where s.tenant_id = p_tenant
      and s.status = 'ACTIVE'
      and s.period_end < current_date
    order by s.period_end
  loop
    if not v_sub.auto_renew then
      update clubinho_subscription set status = 'EXPIRED' where id = v_sub.id;
      continue;
    end if;

    v_next := v_sub.period_end + 1;
    v_guard := 0;
    while v_next <= current_date and v_guard < 24 loop
      perform clubinho_open_period(v_sub.id, v_next);
      select period_end into v_end from clubinho_subscription where id = v_sub.id;
      exit when v_end is null or v_end < v_next;  -- ciclo degenerado: não avança
      v_opened := v_opened + 1;
      v_next := v_end + 1;
      v_guard := v_guard + 1;
    end loop;
  end loop;

  return v_opened;
end;
$$;
revoke execute on function clubinho_sync_periods(uuid) from public;
grant execute on function clubinho_sync_periods(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Consumo do crédito pelo atendimento
-- ---------------------------------------------------------------------

/**
 * Debita (ou devolve) o crédito quando o atendimento entra ou sai de
 * COMPLETED.
 *
 * O débito acontece aqui, e não na server action, porque é a única forma de
 * o saldo e o status ficarem na mesma transação: se a conclusão der rollback
 * por qualquer outro motivo, o banho não fica gasto.
 *
 * Estornar um atendimento devolve o crédito — o tutor não perde o banho que
 * o petshop desfez.
 */
create or replace function clubinho_on_appointment_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credit clubinho_credit;
begin
  -- Devolve o crédito de quem deixou de estar concluído.
  if old.status = 'COMPLETED' and new.status is distinct from 'COMPLETED' then
    if old.clubinho_credit_id is not null then
      update clubinho_credit
         set quantity_used = greatest(quantity_used - 1, 0)
       where id = old.clubinho_credit_id;
      delete from clubinho_usage where appointment_id = new.id;
    end if;
    return new;
  end if;

  if new.status <> 'COMPLETED' or old.status is not distinct from new.status then
    return new;
  end if;
  if new.clubinho_credit_id is null then
    return new;
  end if;

  -- for update: dois atendimentos finalizados ao mesmo tempo no último banho
  -- do mês são serializados aqui, e o segundo cai no check de saldo abaixo.
  select * into v_credit
  from clubinho_credit
  where id = new.clubinho_credit_id
  for update;

  if not found then
    raise exception 'Crédito do Clubinho não encontrado';
  end if;
  if v_credit.tenant_id <> new.tenant_id then
    raise exception 'Crédito do Clubinho de outro petshop';
  end if;
  if v_credit.quantity_used >= v_credit.quantity_total then
    raise exception 'O saldo de % acabou neste ciclo do Clubinho', v_credit.service_name;
  end if;
  -- O crédito é do pet: sem isso o banho de um pet gastaria o pacote do outro.
  if not exists (
    select 1 from clubinho_subscription s
    where s.id = v_credit.subscription_id and s.pet_id = new.pet_id
  ) then
    raise exception 'Este crédito do Clubinho é de outro pet';
  end if;
  if new.service_type_id is distinct from v_credit.service_type_id then
    raise exception 'O crédito do Clubinho é de % — escolha o crédito do serviço agendado',
      v_credit.service_name;
  end if;

  update clubinho_credit
     set quantity_used = quantity_used + 1
   where id = v_credit.id;

  insert into clubinho_usage (
    tenant_id, subscription_id, credit_id, appointment_id, service_type_id, created_by
  )
  values (
    new.tenant_id, v_credit.subscription_id, v_credit.id, new.id,
    new.service_type_id, new.completed_by
  )
  on conflict (appointment_id) do nothing;

  return new;
end;
$$;

-- Nome escolhido para ordenar antes de appointment_finance: os dois são
-- AFTER UPDATE OF status e o Postgres dispara em ordem alfabética. Assim,
-- se o saldo estourar, a receita nem chega a ser avaliada.
create trigger appointment_clubinho
  after update of status on appointment
  for each row execute function clubinho_on_appointment_status();

-- ---------------------------------------------------------------------
-- Atendimento coberto não vira receita
-- ---------------------------------------------------------------------

/**
 * Mesma função de 0036, com duas ressalvas para o Clubinho:
 *
 *  - forma de pagamento deixa de ser obrigatória: o banho do pacote já foi
 *    pago na mensalidade, não há o que cobrar no balcão;
 *  - nenhuma receita é lançada, pelo mesmo motivo. O consumo do crédito
 *    fica registrado em clubinho_usage, que é o relatório de entrega.
 */
create or replace function finance_on_appointment_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price int;
  v_desc text;
  v_snapshot jsonb;
begin
  if new.status = 'COMPLETED' and old.status is distinct from new.status then
    if not can_complete_appointment(new.tenant_id, new.collaborator_id) then
      raise exception 'Sem permissão para concluir atendimentos';
    end if;

    -- Coberto pelo Clubinho: o caixa já recebeu na mensalidade.
    if new.clubinho_credit_id is not null then
      return new;
    end if;

    if new.payment_method is null then
      raise exception 'Informe a forma de pagamento';
    end if;

    select
      st.price_cents,
      'Atendimento: ' || st.name,
      jsonb_build_object(
        'kind', 'SERVICE',
        'customer', jsonb_build_object(
          'id', t.id,
          'name', t.full_name,
          'cpf', t.cpf,
          'phone', t.phone,
          'email', t.email
        ),
        'pet', jsonb_build_object('id', p.id, 'name', p.name),
        'service', jsonb_build_object('id', st.id, 'name', st.name),
        'collaborator', jsonb_build_object('id', c.id, 'name', c.full_name),
        'scheduled_at', new.scheduled_at,
        'started_at', new.started_at,
        'finished_at', coalesce(new.finished_at, now()),
        'total_cents', st.price_cents
      )
    into v_price, v_desc, v_snapshot
    from tutor t
    join pet p on p.id = new.pet_id
    left join service_type st on st.id = new.service_type_id
    left join collaborator c on c.id = new.collaborator_id
    where t.id = new.tutor_id;

    if coalesce(v_price, 0) > 0 then
      insert into finance_entry (
        tenant_id, type, source, description, category, amount_cents,
        occurred_on, appointment_id, payment_method, snapshot, created_by,
        terminal_id, installments
      )
      values (
        new.tenant_id, 'INCOME', 'APPOINTMENT', v_desc, 'servico', v_price,
        coalesce(new.finished_at, now())::date, new.id, new.payment_method,
        coalesce(v_snapshot, '{}'::jsonb), new.completed_by,
        new.terminal_id, coalesce(new.installments, 1)
      )
      on conflict (appointment_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- `tutor.clubinho` vira cache derivado das assinaturas dos pets
-- ---------------------------------------------------------------------

/**
 * O selo do tutor passa a significar "tem pelo menos um pet no Clubinho".
 * Manter a coluna (em vez de trocá-la por um join) é o que deixa o app do
 * tutor e a listagem de tutores funcionando sem reescrita, já que ambos a
 * selecionam direto no PostgREST.
 *
 * O set_config local é a senha que o trigger tutor_clubinho_staff_only
 * reconhece. Ela é desligada logo depois do update: como set_config local
 * vale até o fim da transação, deixá-la ligada abriria o flag para
 * qualquer outro update que viesse na mesma transação.
 */
create or replace function clubinho_sync_tutor_flag(p_tutor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has boolean;
begin
  if p_tutor is null then return; end if;

  select exists (
    select 1 from clubinho_subscription s
    where s.tutor_id = p_tutor and s.status in ('ACTIVE', 'PAUSED')
  ) into v_has;

  perform set_config('mylivepet.clubinho_sync', 'on', true);
  update tutor set clubinho = v_has
   where id = p_tutor and clubinho is distinct from v_has;
  perform set_config('mylivepet.clubinho_sync', 'off', true);
end;
$$;
revoke execute on function clubinho_sync_tutor_flag(uuid) from public;

create or replace function clubinho_subscription_touch_tutor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    perform clubinho_sync_tutor_flag(old.tutor_id);
  end if;
  if tg_op <> 'DELETE' then
    perform clubinho_sync_tutor_flag(new.tutor_id);
  end if;
  return null;
end;
$$;

create trigger clubinho_subscription_touch_tutor
  after insert or update or delete on clubinho_subscription
  for each row execute function clubinho_subscription_touch_tutor();

/**
 * Substitui a regra de 0039. Antes o flag era comercial e o petshop o ligava
 * na mão; agora ele é consequência da assinatura, então nem o petshop o
 * edita — quem edita é clubinho_sync_tutor_flag.
 *
 * Os tutores que já estavam marcados no modelo antigo não são desmarcados
 * aqui: sem plano cadastrado não há como adivinhar o que eles assinaram. O
 * flag deles só se acerta quando o petshop criar a assinatura de algum pet;
 * a tela do Clubinho lista quem está nessa situação.
 */
create or replace function tutor_clubinho_staff_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.clubinho is distinct from old.clubinho
     and coalesce(current_setting('mylivepet.clubinho_sync', true), '') <> 'on' then
    raise exception 'O Clubinho do tutor vem das assinaturas dos pets';
  end if;
  return new;
end;
$$;

comment on column tutor.clubinho is
  'Derivado: verdadeiro quando algum pet do tutor tem assinatura ACTIVE ou PAUSED. Mantido por clubinho_sync_tutor_flag — não editar direto.';

-- ---------------------------------------------------------------------
-- Leitura: assinatura + saldo do ciclo corrente numa linha
-- ---------------------------------------------------------------------
create view clubinho_subscription_view
with (security_invoker = true)
as
select
  s.id,
  s.tenant_id,
  s.pet_id,
  s.tutor_id,
  s.plan_id,
  s.status,
  s.price_cents,
  s.started_on,
  s.period_start,
  s.period_end,
  s.auto_renew,
  s.payment_method,
  s.terminal_id,
  s.installments,
  s.notes,
  s.cancelled_at,
  s.cancellation_reason,
  s.created_at,
  pl.name        as plan_name,
  pl.cycle       as plan_cycle,
  pl.cycle_days  as plan_cycle_days,
  pl.rollover    as plan_rollover,
  pl.price_cents as plan_price_cents,
  pl.active      as plan_active,
  pe.name        as pet_name,
  pe.photo_path  as pet_photo_path,
  pe.species     as pet_species,
  t.full_name    as tutor_name,
  t.phone        as tutor_phone,
  cur.id         as period_id,
  cur.period_start as current_period_start,
  cur.period_end   as current_period_end,
  coalesce(bal.credits, '[]'::jsonb) as credits,
  coalesce(bal.total, 0)             as credits_total,
  coalesce(bal.used, 0)              as credits_used,
  coalesce(bal.total, 0) - coalesce(bal.used, 0) as credits_left
from clubinho_subscription s
join clubinho_plan pl on pl.id = s.plan_id
join pet pe on pe.id = s.pet_id
join tutor t on t.id = s.tutor_id
-- Ciclo que cobre hoje. Assinatura vencida e ainda não renovada fica sem
-- período corrente — e, corretamente, com saldo zero até a renovação.
left join lateral (
  select p.id, p.period_start, p.period_end
  from clubinho_period p
  where p.subscription_id = s.id
    and current_date between p.period_start and p.period_end
  order by p.period_start desc
  limit 1
) cur on true
left join lateral (
  select
    jsonb_agg(
      jsonb_build_object(
        'credit_id', c.id,
        'service_type_id', c.service_type_id,
        'service_name', c.service_name,
        'quantity_total', c.quantity_total,
        'quantity_used', c.quantity_used,
        'quantity_left', c.quantity_total - c.quantity_used
      ) order by c.service_name
    ) as credits,
    sum(c.quantity_total) as total,
    sum(c.quantity_used)  as used
  from clubinho_credit c
  where c.period_id = cur.id
) bal on true;

grant select on clubinho_subscription_view to authenticated;

-- A mensalidade entra no relatório como origem própria: sem isso ela cairia
-- em "Manual" e o dono não conseguiria separar o recorrente do avulso.
create or replace view finance_movement_view
with (security_invoker = true)
as
select
  fe.id,
  fe.tenant_id,
  fe.type,
  fe.source,
  fe.description,
  fe.category,
  fe.amount_cents,
  fe.occurred_on,
  fe.payment_method,
  fe.snapshot,
  fe.appointment_id,
  fe.reservation_id,
  fe.refund_id,
  fe.created_at,
  case
    when fe.source = 'REFUND' then 'REFUND'
    else fe.type::text
  end as movement_kind,
  case
    when fe.source = 'APPOINTMENT' then 'SERVICE'
    when fe.source = 'RESERVATION' then 'PRODUCT'
    when fe.source = 'CLUBINHO' then 'CLUBINHO'
    when fe.source = 'REFUND' and fe.category = 'servico' then 'SERVICE'
    when fe.source = 'REFUND' and fe.category = 'produto' then 'PRODUCT'
    else 'MANUAL'
  end as movement_origin,
  pr.status::text as reservation_status,
  (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', fr.id,
        'kind', fr.kind,
        'amount_cents', fr.amount_cents,
        'reason', fr.reason,
        'payment_method', fr.payment_method,
        'created_at', fr.created_at,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'reservation_item_id', fri.reservation_item_id,
            'quantity', fri.quantity,
            'unit_price_cents', fri.unit_price_cents,
            'product', fri.product_snapshot
          ))
          from finance_refund_item fri
          where fri.refund_id = fr.id
        ), '[]'::jsonb)
      )
      order by fr.created_at
    ), '[]'::jsonb)
    from finance_refund fr
    where fr.original_entry_id = fe.id
  ) as refunds,
  fe.terminal_id,
  fe.terminal_name,
  fe.installments,
  fe.fee_percent,
  fe.fee_fixed_cents,
  fe.fee_cents,
  fe.net_amount_cents,
  fe.settlement_date,
  -- No fim da lista de propósito: `create or replace view` não deixa
  -- inserir coluna no meio, só acrescentar depois da última.
  fe.clubinho_period_id
from finance_entry fe
left join product_reservation pr on pr.id = fe.reservation_id;

grant select on finance_movement_view to authenticated;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table clubinho_plan enable row level security;
alter table clubinho_plan_item enable row level security;
alter table clubinho_subscription enable row level security;
alter table clubinho_period enable row level security;
alter table clubinho_credit enable row level security;
alter table clubinho_usage enable row level security;

-- Leitura para todo o staff (o colaborador precisa ver o saldo na hora de
-- finalizar); escrita só para quem administra o petshop.
create policy clubinho_plan_staff_read on clubinho_plan for select
  using (is_staff(tenant_id));
create policy clubinho_plan_staff_write on clubinho_plan for all
  using (can_manage_finance(tenant_id)) with check (can_manage_finance(tenant_id));
-- Tutor vê a vitrine: o que o petshop oferece hoje.
create policy clubinho_plan_tutor_read on clubinho_plan for select
  using (active and my_tutor_id(tenant_id) is not null);

create policy clubinho_plan_item_staff_read on clubinho_plan_item for select
  using (is_staff(tenant_id));
create policy clubinho_plan_item_staff_write on clubinho_plan_item for all
  using (can_manage_finance(tenant_id)) with check (can_manage_finance(tenant_id));
create policy clubinho_plan_item_tutor_read on clubinho_plan_item for select
  using (my_tutor_id(tenant_id) is not null);

create policy clubinho_subscription_staff_read on clubinho_subscription for select
  using (is_staff(tenant_id));
create policy clubinho_subscription_staff_write on clubinho_subscription for all
  using (can_manage_finance(tenant_id)) with check (can_manage_finance(tenant_id));
create policy clubinho_subscription_tutor_read on clubinho_subscription for select
  using (tutor_id = my_tutor_id(tenant_id));

create policy clubinho_period_staff_read on clubinho_period for select
  using (is_staff(tenant_id));
create policy clubinho_period_staff_write on clubinho_period for all
  using (can_manage_finance(tenant_id)) with check (can_manage_finance(tenant_id));
create policy clubinho_period_tutor_read on clubinho_period for select
  using (exists (
    select 1 from clubinho_subscription s
    where s.id = subscription_id and s.tutor_id = my_tutor_id(s.tenant_id)
  ));

create policy clubinho_credit_staff_read on clubinho_credit for select
  using (is_staff(tenant_id));
create policy clubinho_credit_staff_write on clubinho_credit for all
  using (can_manage_finance(tenant_id)) with check (can_manage_finance(tenant_id));
create policy clubinho_credit_tutor_read on clubinho_credit for select
  using (exists (
    select 1 from clubinho_subscription s
    where s.id = subscription_id and s.tutor_id = my_tutor_id(s.tenant_id)
  ));

create policy clubinho_usage_staff_read on clubinho_usage for select
  using (is_staff(tenant_id));
create policy clubinho_usage_staff_write on clubinho_usage for all
  using (can_manage_finance(tenant_id)) with check (can_manage_finance(tenant_id));
create policy clubinho_usage_tutor_read on clubinho_usage for select
  using (exists (
    select 1 from clubinho_subscription s
    where s.id = subscription_id and s.tutor_id = my_tutor_id(s.tenant_id)
  ));

-- PostgREST guarda o schema em cache; sem isso as tabelas novas só
-- apareceriam no próximo reload.
notify pgrst, 'reload schema';
