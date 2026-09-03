-- =====================================================================
-- Preço por porte do pet, no serviço e no serviço adicional.
--
-- No balcão o mesmo "Banho" custa diferente para um yorkshire e para um
-- são-bernardo. A alternativa seria cadastrar cinco serviços ("Banho ·
-- Pequeno", "Banho · Grande", ...), mas isso multiplica o catálogo por
-- cinco e joga no atendente a responsabilidade de escolher a linha certa
-- em cada agendamento — errar a linha vira erro de cobrança.
--
-- Então o serviço continua único e ganha cinco preços opcionais. Quem
-- resolve qual vale é o sistema, que já sabe o pet do agendamento.
--
-- price_cents segue sendo o PREÇO BASE. Coluna de porte nula = aquele
-- porte não tem preço próprio e usa o base — é o que mantém de pé todo
-- serviço cadastrado antes desta migração, sem migrar dado nenhum.
--
-- Os portes são os cinco de PET_SIZES (packages/types/src/enums.ts):
-- mini, pequeno, medio, grande, gigante. pet.size continua text livre,
-- como em 0001: quem padroniza é o zod dos formulários.
-- =====================================================================

alter table service_type
  add column price_mini_cents    integer check (price_mini_cents    >= 0),
  add column price_pequeno_cents integer check (price_pequeno_cents >= 0),
  add column price_medio_cents   integer check (price_medio_cents   >= 0),
  add column price_grande_cents  integer check (price_grande_cents  >= 0),
  add column price_gigante_cents integer check (price_gigante_cents >= 0);

alter table service_addon
  add column price_mini_cents    integer check (price_mini_cents    >= 0),
  add column price_pequeno_cents integer check (price_pequeno_cents >= 0),
  add column price_medio_cents   integer check (price_medio_cents   >= 0),
  add column price_grande_cents  integer check (price_grande_cents  >= 0),
  add column price_gigante_cents integer check (price_gigante_cents >= 0);

comment on column service_type.price_cents is
  'Preço base: vale para porte sem preço próprio e para pet sem porte preenchido.';
comment on column service_addon.price_cents is
  'Preço base: vale para porte sem preço próprio e para pet sem porte preenchido.';

/**
 * Qual dos preços vale para um pet daquele porte.
 *
 * Gêmea de priceForPetSize() em packages/types/src/enums.ts: a UI mostra o
 * valor com a versão TypeScript e o caixa cobra com esta — as duas precisam
 * concordar sempre. Porte nulo, fora da lista ou sem preço próprio cai no base.
 */
create or replace function price_for_pet_size(
  base int, mini int, pequeno int, medio int, grande int, gigante int,
  p_size text
) returns int
language sql
immutable
as $fn$
  select coalesce(
    case p_size
      when 'mini'    then mini
      when 'pequeno' then pequeno
      when 'medio'   then medio
      when 'grande'  then grande
      when 'gigante' then gigante
    end,
    base
  );
$fn$;

-- ---------------------------------------------------------------------
-- Receita do atendimento: o preço do serviço passa a sair do porte
-- ---------------------------------------------------------------------

/**
 * Mesma função de 0056, com uma diferença: o valor do serviço não é mais
 * st.price_cents cru, e sim o preço do porte do pet. É aqui que o preço por
 * porte vira dinheiro no caixa — o resto do sistema só mostra.
 *
 * O adicional NÃO é resolvido aqui: appointment_addon.price_cents já é o
 * snapshot gravado no agendamento (0056), quando o porte do pet já era
 * conhecido. Reajustar o catálogo depois não pode mexer no que foi cobrado.
 *
 * O snapshot passa a guardar o porte usado, para o fechamento do mês poder
 * explicar por que aquele atendimento saiu por aquele valor.
 */
create or replace function finance_on_appointment_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_price int;
  v_desc text;
  v_snapshot jsonb;
  v_addons jsonb;
  v_addons_cents int;
  v_addons_count int;
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
      coalesce(sum(aa.price_cents), 0),
      count(*),
      coalesce(
        jsonb_agg(
          jsonb_build_object('name', aa.name, 'price_cents', aa.price_cents)
          order by aa.created_at, aa.id
        ),
        '[]'::jsonb
      )
    into v_addons_cents, v_addons_count, v_addons
    from appointment_addon aa
    where aa.appointment_id = new.id;

    select
      price_for_pet_size(
        st.price_cents, st.price_mini_cents, st.price_pequeno_cents,
        st.price_medio_cents, st.price_grande_cents, st.price_gigante_cents,
        p.size
      ) + v_addons_cents,
      'Atendimento: ' || st.name
        || case
             when v_addons_count = 0 then ''
             when v_addons_count = 1 then ' + 1 adicional'
             else ' + ' || v_addons_count || ' adicionais'
           end,
      jsonb_build_object(
        'kind', 'SERVICE',
        'customer', jsonb_build_object(
          'id', t.id,
          'name', t.full_name,
          'cpf', t.cpf,
          'phone', t.phone,
          'email', t.email
        ),
        'pet', jsonb_build_object('id', p.id, 'name', p.name, 'size', p.size),
        'service', jsonb_build_object('id', st.id, 'name', st.name),
        'service_cents', price_for_pet_size(
          st.price_cents, st.price_mini_cents, st.price_pequeno_cents,
          st.price_medio_cents, st.price_grande_cents, st.price_gigante_cents,
          p.size
        ),
        'addons', v_addons,
        'addons_cents', v_addons_cents,
        'collaborator', jsonb_build_object('id', c.id, 'name', c.full_name),
        'scheduled_at', new.scheduled_at,
        'started_at', new.started_at,
        'finished_at', coalesce(new.finished_at, now()),
        'total_cents', price_for_pet_size(
          st.price_cents, st.price_mini_cents, st.price_pequeno_cents,
          st.price_medio_cents, st.price_grande_cents, st.price_gigante_cents,
          p.size
        ) + v_addons_cents
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
$fn$;
