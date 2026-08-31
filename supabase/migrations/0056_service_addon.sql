-- =====================================================================
-- Serviços adicionais: extras baratos que acompanham o atendimento
-- (hidratação, perfume, escovação de dentes).
--
-- Por que tabela própria e não uma flag em service_type: o adicional não
-- tem duração (não ocupa slot), não tem cor na agenda, não tem etapas e
-- não pode virar item de plano do Clubinho. Com uma flag, cada uma dessas
-- consultas — agenda, slots, Clubinho, busca global — precisaria lembrar
-- de filtrar, e a que esquecesse quebraria em silêncio.
--
-- Vínculo com o atendimento: um agendamento com dois serviços vira duas
-- linhas irmãs em appointment (request_group_id, 0014), cada uma com seu
-- pagamento e sua receita. O adicional é do agendamento, não do serviço,
-- então é gravado na PRIMEIRA linha do grupo e cobrado uma vez só. Se essa
-- linha for cancelada, appointment_addon_reassign passa os adicionais para
-- uma irmã viva — senão o valor sumiria do caixa junto com o cancelamento.
-- =====================================================================

create table service_addon (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenant(id) on delete cascade,
  name        text not null check (btrim(name) <> '' and length(name) <= 60),
  price_cents integer not null default 0 check (price_cents >= 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index on service_addon (tenant_id);

-- Um nome por petshop, ignorando caixa e espaços (mesmo molde de
-- service_step_template_label_uq, 0035): impede "Hidratação" e "hidratacao "
-- convivendo na mesma lista do agendamento.
create unique index service_addon_name_uq
  on service_addon (tenant_id, lower(btrim(name)));

alter table service_addon enable row level security;

-- Espelha service_staff / service_read (0001): staff administra, tutor lê
-- os ativos para poder escolher na solicitação.
create policy service_addon_staff on service_addon for all
  using (is_staff(tenant_id)) with check (is_staff(tenant_id));
create policy service_addon_read on service_addon for select using (
  is_staff(tenant_id) or (active and my_tutor_id(tenant_id) is not null)
);

-- O colaborador não precisa do catálogo: o que ele vê na ficha do
-- atendimento é o snapshot em appointment_addon.

-- ---------------------------------------------------------------------
-- Adicionais escolhidos no agendamento
-- ---------------------------------------------------------------------

/**
 * name e price_cents são SNAPSHOT, pelo mesmo motivo de appointment_step.label
 * (0001) e do snapshot da reserva (0021): reajustar o preço da hidratação em
 * março não pode mexer no atendimento de janeiro, que já virou receita.
 *
 * service_addon_id fica como referência frouxa (set null) para o histórico
 * sobreviver à exclusão do adicional no catálogo — mesma escolha de
 * 0037_product_delete_keeps_history.
 */
create table appointment_addon (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenant(id) on delete cascade,
  appointment_id   uuid not null references appointment(id) on delete cascade,
  service_addon_id uuid references service_addon(id) on delete set null,
  name             text not null,
  price_cents      integer not null check (price_cents >= 0),
  created_at       timestamptz not null default now()
);

create index on appointment_addon (appointment_id);
create index on appointment_addon (tenant_id);

-- O mesmo adicional duas vezes no mesmo atendimento é sempre engano de
-- clique duplo, nunca "duas hidratações".
create unique index appointment_addon_uq
  on appointment_addon (appointment_id, service_addon_id)
  where service_addon_id is not null;

alter table appointment_addon enable row level security;

create policy appointment_addon_staff on appointment_addon for all
  using (is_staff(tenant_id)) with check (is_staff(tenant_id));

-- Tutor: lê os do próprio atendimento e escolhe os seus ao solicitar
-- (a solicitação nasce REQUESTED, ver appointment_tutor_request em 0001).
create policy appointment_addon_tutor_select on appointment_addon for select using (
  exists (
    select 1 from appointment a
    where a.id = appointment_addon.appointment_id
      and a.tutor_id = my_tutor_id(appointment_addon.tenant_id)
  )
);
create policy appointment_addon_tutor_insert on appointment_addon for insert with check (
  exists (
    select 1 from appointment a
    where a.id = appointment_addon.appointment_id
      and a.tutor_id = my_tutor_id(appointment_addon.tenant_id)
      and a.status = 'REQUESTED'
  )
);

-- Colaborador lê os do atendimento que é dele (molde de step_collab_all, 0031):
-- é o que aparece na ficha, junto do checklist.
create policy appointment_addon_collab_select on appointment_addon for select using (
  exists (
    select 1 from appointment a
    where a.id = appointment_addon.appointment_id
      and a.collaborator_id = my_collaborator_id(appointment_addon.tenant_id)
  )
);

-- ---------------------------------------------------------------------
-- Atendimento concluído não muda mais de valor
-- ---------------------------------------------------------------------

/**
 * A receita de 0026 é congelada na conclusão (finance_entry.snapshot). Mexer
 * nos adicionais depois disso deixaria a ficha dizendo um valor e o caixa
 * outro, sem nada apontar a divergência.
 *
 * CANCELLED continua liberado de propósito: é o próprio reassign abaixo que
 * move os adicionais para fora da linha cancelada.
 */
create or replace function appointment_addon_frozen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status appointment_status;
begin
  select status into v_status
  from appointment
  where id = coalesce(new.appointment_id, old.appointment_id);

  if v_status = 'COMPLETED' then
    raise exception 'Atendimento já concluído: os adicionais não podem mais mudar';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger appointment_addon_frozen
  before insert or update or delete on appointment_addon
  for each row execute function appointment_addon_frozen();

-- ---------------------------------------------------------------------
-- Cancelou o serviço dono: os adicionais mudam de dono
-- ---------------------------------------------------------------------

/**
 * Os adicionais moram na primeira linha do grupo. Cancelar só esse serviço
 * (o "Banho e tosa" de um pedido que também tinha "Corte de unha") não pode
 * levar embora a hidratação que o pet vai receber assim mesmo.
 *
 * Sem irmã viva, não há o que mover: o agendamento inteiro caiu e os
 * adicionais ficam na linha cancelada, fora de qualquer receita.
 */
create or replace function appointment_addon_reassign()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
begin
  if new.status not in ('CANCELLED', 'REJECTED')
     or old.status is not distinct from new.status
     or new.request_group_id is null then
    return new;
  end if;

  if not exists (select 1 from appointment_addon where appointment_id = new.id) then
    return new;
  end if;

  select a.id into v_target
  from appointment a
  where a.request_group_id = new.request_group_id
    and a.id <> new.id
    and a.status not in ('CANCELLED', 'REJECTED', 'COMPLETED')
  order by a.created_at, a.id
  limit 1;

  if v_target is not null then
    update appointment_addon
    set appointment_id = v_target
    where appointment_id = new.id;
  end if;

  return new;
end;
$$;

create trigger appointment_addon_reassign
  after update of status on appointment
  for each row execute function appointment_addon_reassign();

-- ---------------------------------------------------------------------
-- Receita: o adicional entra no mesmo lançamento do serviço
-- ---------------------------------------------------------------------

/**
 * Mesma função de 0047, somando os adicionais ao valor e listando-os no
 * snapshot. Um lançamento só (a unique em finance_entry.appointment_id
 * continua valendo): o balcão cobra serviço e adicional de uma vez, e o
 * relatório de caixa fecha com o que o cliente pagou.
 *
 * O adicional não é lançado sozinho: sem serviço com preço não há receita
 * de atendimento nenhuma — inclusive no Clubinho, onde o retorno acontece
 * antes daqui e nada é cobrado.
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
      st.price_cents + v_addons_cents,
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
        'pet', jsonb_build_object('id', p.id, 'name', p.name),
        'service', jsonb_build_object('id', st.id, 'name', st.name),
        'service_cents', st.price_cents,
        'addons', v_addons,
        'addons_cents', v_addons_cents,
        'collaborator', jsonb_build_object('id', c.id, 'name', c.full_name),
        'scheduled_at', new.scheduled_at,
        'started_at', new.started_at,
        'finished_at', coalesce(new.finished_at, now()),
        'total_cents', st.price_cents + v_addons_cents
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
