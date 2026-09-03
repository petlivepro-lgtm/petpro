-- =====================================================================
-- Clubinho: marcar um serviço como já realizado (baixa manual).
--
-- Até aqui o saldo só descia por um caminho: o atendimento virar
-- COMPLETED com clubinho_credit_id preenchido (clubinho_on_appointment_status,
-- 0047). Isso deixa de fora o caso mais comum de quem está começando a usar
-- o sistema — o pet que JÁ era do Clubinho antes do cadastro. O petshop
-- cria a assinatura hoje, o ciclo abre cheio, e não há como registrar os
-- dois banhos que o tutor já tomou este mês. O saldo mente a favor do
-- cliente e o petshop entrega mais do que vendeu.
--
-- O modelo de 0047 já previa isso sem dizer: clubinho_usage.appointment_id
-- é nullable ("um atendimento gasta no máximo um crédito", não "todo
-- consumo vem de um atendimento"). Faltava quem escrevesse ali.
--
-- O que a baixa manual NÃO faz, de propósito:
--   - não cria atendimento na agenda (não houve profissional nem horário);
--   - não lança nada no financeiro — pela mesma razão que o atendimento
--     coberto não lança: a mensalidade já cobrou o serviço.
--
-- Data: aceita qualquer momento até agora, inclusive anterior ao início do
-- ciclo. É justamente o caso de uso — o serviço foi entregue antes de o
-- sistema existir para aquele pet.
-- =====================================================================

-- O porquê da baixa, em texto livre ("cliente já era do Clubinho"). Fica
-- na mesma linha do consumo para o histórico explicar a si mesmo daqui a
-- seis meses.
alter table clubinho_usage
  add column note text check (note is null or length(note) <= 500);

-- ---------------------------------------------------------------------
-- Registrar
-- ---------------------------------------------------------------------

/**
 * Desconta um serviço do saldo sem atendimento por trás.
 *
 * As validações repetem, uma a uma, as de clubinho_on_appointment_status
 * (0047) — inclusive o `for update` no crédito. Duas baixas simultâneas no
 * último banho do ciclo são serializadas aqui, e a segunda cai no check de
 * saldo em vez de estourar clubinho_credit_not_overdrawn com uma mensagem
 * de banco na cara do balcão.
 */
create or replace function clubinho_register_usage(
  p_credit  uuid,
  p_used_at timestamptz default now(),
  p_note    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credit clubinho_credit;
  v_status clubinho_subscription_status;
  v_id     uuid;
begin
  select * into v_credit
  from clubinho_credit
  where id = p_credit
  for update;

  if not found then
    raise exception 'Crédito do Clubinho não encontrado';
  end if;

  -- Mesma permissão que administra o Clubinho (clubinho_usage_staff_write).
  -- O colaborador consome crédito concluindo atendimento, não na mão.
  if not can_manage_finance(v_credit.tenant_id) then
    raise exception 'Sem permissão para marcar serviços do Clubinho';
  end if;

  select status into v_status
  from clubinho_subscription
  where id = v_credit.subscription_id;

  if v_status not in ('ACTIVE', 'PAUSED') then
    raise exception 'A assinatura não está mais aberta';
  end if;

  -- "Já foi realizado" não combina com data futura. O passado é livre: o
  -- serviço pode ter sido entregue antes de o pet entrar no sistema.
  if p_used_at > now() then
    raise exception 'Não dá para marcar como realizado um serviço com data no futuro';
  end if;

  if v_credit.quantity_used >= v_credit.quantity_total then
    raise exception 'O saldo de % acabou neste ciclo do Clubinho', v_credit.service_name;
  end if;

  update clubinho_credit
     set quantity_used = quantity_used + 1
   where id = v_credit.id;

  insert into clubinho_usage (
    tenant_id, subscription_id, credit_id, appointment_id,
    service_type_id, used_at, created_by, note
  )
  values (
    v_credit.tenant_id, v_credit.subscription_id, v_credit.id, null,
    v_credit.service_type_id, p_used_at, auth.uid(),
    nullif(btrim(coalesce(p_note, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function clubinho_register_usage(uuid, timestamptz, text) from public;
grant execute on function clubinho_register_usage(uuid, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------
-- Desfazer
-- ---------------------------------------------------------------------

/**
 * Devolve o crédito de uma baixa manual.
 *
 * Só as manuais: a entrega que veio de atendimento é desfeita estornando o
 * atendimento, e o trigger de 0047 já devolve o crédito nesse caminho.
 * Apagar a linha aqui deixaria o atendimento concluído apontando para um
 * consumo que não existe mais.
 */
create or replace function clubinho_undo_usage(p_usage uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage clubinho_usage;
begin
  select * into v_usage from clubinho_usage where id = p_usage;
  if not found then
    raise exception 'Registro não encontrado';
  end if;

  if not can_manage_finance(v_usage.tenant_id) then
    raise exception 'Sem permissão para marcar serviços do Clubinho';
  end if;

  if v_usage.appointment_id is not null then
    raise exception 'Este serviço veio de um atendimento — desfaça estornando o atendimento';
  end if;

  -- Trava o crédito antes de mexer, pela mesma razão do registro.
  perform 1 from clubinho_credit where id = v_usage.credit_id for update;

  update clubinho_credit
     set quantity_used = greatest(quantity_used - 1, 0)
   where id = v_usage.credit_id;

  delete from clubinho_usage where id = v_usage.id;
end;
$$;

revoke execute on function clubinho_undo_usage(uuid) from public;
grant execute on function clubinho_undo_usage(uuid) to authenticated;

-- PostgREST guarda o schema em cache; sem isso as funções novas só
-- apareceriam no próximo reload.
notify pgrst, 'reload schema';
