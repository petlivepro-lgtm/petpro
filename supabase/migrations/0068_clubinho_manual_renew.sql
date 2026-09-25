-- =====================================================================
-- Renovação manual do Clubinho.
--
-- Até aqui o ciclo só virava pela rotina (clubinho_sync_periods), e só
-- para quem tem auto_renew. Faltavam dois casos do balcão:
--
--   * a assinatura que não renova sozinha venceu e o tutor voltou para
--     pagar — abre-se um ciclo a partir de hoje;
--   * o tutor quer pagar o próximo ciclo adiantado — abre-se o ciclo
--     seguinte (period_end + 1) já agora, com a mensalidade lançada hoje.
--
-- Antecipar expõe um furo do rollover: clubinho_open_period calcula a
-- sobra do ciclo anterior no momento em que abre o novo. Com o ciclo
-- anterior ainda correndo, o banho tomado depois disso já teria sido
-- herdado como sobra. O trigger abaixo repassa ao ciclo seguinte toda
-- mudança de saldo feita depois que ele foi aberto.
-- =====================================================================

/**
 * Renova a assinatura na mão.
 *
 * O ciclo novo começa em max(period_end + 1, hoje): vigente, antecipa o
 * próximo; vencido, recomeça hoje — pelo mesmo motivo do retomar (0050),
 * não se cobra o período em que o pet não veio.
 *
 * Só uma antecipação por vez: com um ciclo futuro já pago, um segundo
 * clique cobraria mais um mês sem ninguém perceber.
 */
create or replace function clubinho_renew_subscription(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub       clubinho_subscription;
  v_start     date;
  v_period_id uuid;
begin
  select * into v_sub from clubinho_subscription where id = p_id for update;
  if not found then raise exception 'Assinatura não encontrada'; end if;
  if not can_manage_finance(v_sub.tenant_id) then
    raise exception 'Sem permissão para gerenciar o Clubinho';
  end if;
  if v_sub.status = 'CANCELLED' then
    raise exception 'Assinatura cancelada não renova — crie uma nova';
  end if;
  if v_sub.status = 'PAUSED' then
    raise exception 'Assinatura pausada — retome antes de renovar';
  end if;
  if v_sub.period_start > current_date then
    raise exception 'O próximo ciclo já foi renovado (começa em %)',
      to_char(v_sub.period_start, 'DD/MM/YYYY');
  end if;

  v_start := greatest(v_sub.period_end + 1, current_date);
  v_period_id := clubinho_open_period(p_id, v_start, auth.uid());

  -- open_period data a mensalidade no início do ciclo. Na renovação manual
  -- o dinheiro entra hoje, no balcão — é aí que ele tem de aparecer no caixa.
  update finance_entry
     set occurred_on = current_date
   where clubinho_period_id = v_period_id;

  return v_period_id;
end;
$$;
revoke execute on function clubinho_renew_subscription(uuid) from public;
grant execute on function clubinho_renew_subscription(uuid) to authenticated;

/**
 * Mantém a sobra herdada em dia quando o ciclo anterior muda depois que o
 * seguinte já foi aberto (antecipação, ou estorno de um uso antigo).
 *
 * Mexe no quantity_total do crédito equivalente do ciclo seguinte, o que
 * dispara o trigger de novo nele — a correção desce pela cadeia sozinha.
 */
create or replace function clubinho_credit_propagate_rollover()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta integer;
  v_next  uuid;
begin
  v_delta := (new.quantity_total - new.quantity_used)
           - (old.quantity_total - old.quantity_used);
  if v_delta = 0 or new.service_type_id is null then return new; end if;

  if not exists (
    select 1
    from clubinho_subscription s
    join clubinho_plan pl on pl.id = s.plan_id
    where s.id = new.subscription_id and pl.rollover
  ) then
    return new;
  end if;

  select nx.id into v_next
  from clubinho_period cur
  join clubinho_period nx
    on nx.subscription_id = cur.subscription_id
   and nx.period_start > cur.period_start
  where cur.id = new.period_id
  order by nx.period_start
  limit 1;
  if v_next is null then return new; end if;

  update clubinho_credit
     set quantity_total = greatest(quantity_total + v_delta, quantity_used, 1)
   where period_id = v_next
     and service_type_id = new.service_type_id;

  return new;
end;
$$;

drop trigger if exists clubinho_credit_propagate_rollover on clubinho_credit;
create trigger clubinho_credit_propagate_rollover
  after update of quantity_total, quantity_used on clubinho_credit
  for each row execute function clubinho_credit_propagate_rollover();

notify pgrst, 'reload schema';
