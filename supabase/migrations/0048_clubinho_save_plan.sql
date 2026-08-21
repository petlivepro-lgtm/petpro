-- =====================================================================
-- Salvar um plano do Clubinho de uma vez (dados + grade de serviços).
--
-- Mesmo motivo de save_payment_fee_rules (0036): a grade é substituída
-- inteira, e fazer isso em duas viagens deixaria a janela em que o plano
-- existe sem nenhum serviço — e um plano sem serviço renova sem crédito
-- nenhum, cobrando a mensalidade e não entregando nada.
-- =====================================================================

create or replace function save_clubinho_plan(p_tenant uuid, p_plan jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid := nullif(p_plan->>'id', '')::uuid;
  v_cycle clubinho_cycle := (p_plan->>'cycle')::clubinho_cycle;
  v_days  integer := nullif(p_plan->>'cycle_days', '')::integer;
  v_name  text := btrim(coalesce(p_plan->>'name', ''));
  v_desc  text := nullif(btrim(coalesce(p_plan->>'description', '')), '');
  v_price integer := coalesce((p_plan->>'price_cents')::integer, 0);
  v_roll  boolean := coalesce((p_plan->>'rollover')::boolean, false);
  v_active boolean := coalesce((p_plan->>'active')::boolean, true);
  v_keep  uuid[];
begin
  if not can_manage_finance(p_tenant) then
    raise exception 'Sem permissão para gerenciar o Clubinho';
  end if;

  if jsonb_array_length(coalesce(p_plan->'items', '[]'::jsonb)) = 0 then
    raise exception 'Escolha ao menos um serviço para o plano';
  end if;

  if v_id is null then
    insert into clubinho_plan (
      tenant_id, name, description, price_cents, cycle, cycle_days,
      rollover, active, position
    )
    values (
      p_tenant, v_name, v_desc, v_price, v_cycle, v_days,
      v_roll, v_active, coalesce((p_plan->>'position')::integer, 0)
    )
    returning id into v_id;
  else
    update clubinho_plan
       set name        = v_name,
           description = v_desc,
           price_cents = v_price,
           cycle       = v_cycle,
           cycle_days  = v_days,
           rollover    = v_roll,
           active      = v_active
     where id = v_id and tenant_id = p_tenant;
    if not found then
      raise exception 'Plano não encontrado';
    end if;
  end if;

  select array_agg((i->>'service_type_id')::uuid)
    into v_keep
  from jsonb_array_elements(p_plan->'items') i;

  delete from clubinho_plan_item
   where plan_id = v_id and not (service_type_id = any(v_keep));

  insert into clubinho_plan_item (tenant_id, plan_id, service_type_id, quantity)
  select p_tenant, v_id, (i->>'service_type_id')::uuid, (i->>'quantity')::integer
  from jsonb_array_elements(p_plan->'items') i
  on conflict (plan_id, service_type_id)
  do update set quantity = excluded.quantity;

  -- Um id de serviço vindo de fora do petshop passaria pelas FKs (elas não
  -- olham tenant) e viraria crédito de um serviço que ninguém aqui executa.
  if exists (
    select 1
    from clubinho_plan_item pi
    join service_type st on st.id = pi.service_type_id
    where pi.plan_id = v_id and st.tenant_id <> p_tenant
  ) then
    raise exception 'Serviço de outro petshop';
  end if;

  return v_id;
end;
$$;
revoke execute on function save_clubinho_plan(uuid, jsonb) from public;
grant execute on function save_clubinho_plan(uuid, jsonb) to authenticated;

comment on function save_clubinho_plan(uuid, jsonb) is
  'Cria ou atualiza um plano do Clubinho com a grade de serviços. Não mexe nos ciclos já abertos: o saldo vendido continua valendo até a próxima renovação.';

notify pgrst, 'reload schema';
