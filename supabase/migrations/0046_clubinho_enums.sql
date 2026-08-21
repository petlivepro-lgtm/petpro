-- =====================================================================
-- Enums do Clubinho — migração separada de propósito.
--
-- `alter type ... add value` não pode ser usado na mesma transação em que
-- foi criado, e o schema do Clubinho (0047) referencia `finance_source`
-- com o valor novo já dentro do corpo de funções. Mesmo motivo que levou
-- 0025 a existir antes de 0026.
-- =====================================================================

-- Ciclo de renovação do plano. É o intervalo em que os créditos voltam a
-- encher e a mensalidade é cobrada de novo — não a frequência com que o
-- pet vai ao banho. O plano "quinzenal" que todo petshop vende (banho a
-- cada 15 dias) é, nestes termos, um plano MENSAL com 2 banhos: quem
-- cobra por mês renova por mês.
create type clubinho_cycle as enum (
  'WEEKLY',      -- 7 dias
  'BIWEEKLY',    -- 15 dias
  'MONTHLY',     -- 1 mês
  'BIMONTHLY',   -- 2 meses
  'QUARTERLY',   -- 3 meses
  'SEMIANNUAL',  -- 6 meses
  'ANNUAL',      -- 1 ano
  'CUSTOM'       -- intervalo livre em dias (clubinho_plan.cycle_days)
);

-- PAUSED existe para a suspensão temporária que o balcão faz na viagem do
-- tutor: o saldo do ciclo fica congelado e a renovação não dispara, mas a
-- assinatura continua ocupando a vaga única do pet.
create type clubinho_subscription_status as enum (
  'ACTIVE',
  'PAUSED',
  'CANCELLED',
  'EXPIRED'
);

-- Receita da mensalidade. Sem origem própria ela cairia em MANUAL e o
-- relatório não conseguiria separar quanto do faturamento é recorrente.
alter type finance_source add value if not exists 'CLUBINHO';
