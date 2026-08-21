-- =====================================================================
-- Dois acertos no Clubinho, achados exercitando o fluxo de 0047.
--
-- 1. Autoria da renovação. clubinho_open_period gravava
--    coalesce(p_created_by, auth.uid()) no lançamento — e quem dispara a
--    rotina costuma ser o TUTOR abrindo o app, porque é lá que ele
--    confere o saldo. A mensalidade ficava assinada pelo cliente. A
--    renovação automática não tem autor: só a adesão tem.
--
-- 2. Retomar assinatura pausada. A pausa é a suspensão da viagem do
--    tutor; ao voltar, a rotina de renovação encontrava a vigência
--    vencida e abria um ciclo (com mensalidade) para CADA período
--    parado. Retomar passa a abrir um ciclo novo começando hoje —
--    cobra-se de quem voltou, não do mês em que o pet não veio.
-- =====================================================================

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
  v_author   uuid;
begin
  select * into v_sub from clubinho_subscription where id = p_subscription_id;
  if not found then raise exception 'Assinatura não encontrada'; end if;

  select * into v_plan from clubinho_plan where id = v_sub.plan_id;
  if not found then raise exception 'Plano não encontrado'; end if;

  -- Só o staff assina o ciclo. Sem autor informado e sem staff na sessão
  -- (renovação disparada pelo app do tutor), o lançamento fica sem autor —
  -- que é a verdade: ninguém apertou nada.
  v_author := coalesce(
    p_created_by,
    case when is_staff(v_sub.tenant_id) then auth.uid() end
  );

  v_end := (p_period_start
            + clubinho_cycle_interval(v_plan.cycle, v_plan.cycle_days)
            - interval '1 day')::date;

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
    v_sub.payment_method, v_sub.terminal_id, v_sub.installments, v_author
  )
  on conflict (subscription_id, period_start) do nothing
  returning id into v_period_id;

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

  update clubinho_subscription
     set period_start = p_period_start,
         period_end   = v_end,
         status       = 'ACTIVE'
   where id = p_subscription_id;

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
      coalesce(v_snapshot, '{}'::jsonb), v_author,
      v_sub.terminal_id, v_sub.installments
    )
    on conflict (clubinho_period_id) do nothing;
  end if;

  return v_period_id;
end;
$$;
revoke execute on function clubinho_open_period(uuid, date, uuid) from public;

/**
 * Tira a assinatura da pausa.
 *
 * Se a vigência ainda cobre hoje, é só voltar o status: o saldo congelado
 * volta como estava. Se venceu durante a pausa, abre um ciclo NOVO a partir de
 * hoje em vez de deixar a rotina de renovação recuperar mês a mês — o pet não
 * veio no período parado, e cobrar por ele seria vender o que não foi
 * entregue.
 */
create or replace function clubinho_resume_subscription(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub clubinho_subscription;
begin
  select * into v_sub from clubinho_subscription where id = p_id;
  if not found then raise exception 'Assinatura não encontrada'; end if;
  if not can_manage_finance(v_sub.tenant_id) then
    raise exception 'Sem permissão para gerenciar o Clubinho';
  end if;
  if v_sub.status not in ('PAUSED', 'EXPIRED') then
    raise exception 'A assinatura não está pausada';
  end if;

  if v_sub.period_end >= current_date then
    update clubinho_subscription set status = 'ACTIVE' where id = p_id;
  else
    -- open_period já devolve o status para ACTIVE e reajusta a vigência.
    perform clubinho_open_period(p_id, current_date, auth.uid());
  end if;
end;
$$;
revoke execute on function clubinho_resume_subscription(uuid) from public;
grant execute on function clubinho_resume_subscription(uuid) to authenticated;

notify pgrst, 'reload schema';
