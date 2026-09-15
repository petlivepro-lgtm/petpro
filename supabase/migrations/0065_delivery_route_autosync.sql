-- =====================================================================
-- A rota se monta sozinha quando o petshop aceita.
--
-- Até aqui a rota só era montada quando ALGUÉM ABRIA UMA TELA: o entregador o
-- painel dele, ou a gestão a agenda. Com o entregador parado na tela
-- esperando, o aceite de um pedido não produzia nada — a parada só apareceria
-- no recarregar seguinte, e ninguém recarrega uma tela que já está aberta.
--
-- Agora é o banco que remonta a rota, por gatilho, no instante em que o
-- atendimento muda. Como delivery_stop está na publicação de realtime (0062),
-- a parada nova chega ao painel aberto sem que ele peça nada.
--
-- Gatilho é a mesma escolha da 0040 para notificações, pelo mesmo motivo:
-- aceitar um pedido acontece por vários caminhos de código (o botão da fila, a
-- ação em lote, a tela do atendimento), e amarrar isto a um deles deixaria os
-- outros sem efeito no dia em que alguém criar o quarto caminho.
--
-- DUAS FUNÇÕES: a pública continua exigindo permissão, porque é chamada pelas
-- telas. A interna não checa nada — e é obrigatório que seja assim: o gatilho
-- também roda quando QUEM MEXE É O TUTOR (cancelando um agendamento pelo app),
-- e a checagem falharia ali, derrubando o cancelamento dele com um erro que
-- não tem nada a ver com o que ele pediu.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. O miolo, sem checagem de permissão. Nunca conceder a authenticated.
-- ---------------------------------------------------------------------
create or replace function build_delivery_route_internal(
  _tenant uuid,
  _collaborator uuid,
  _date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := _tenant;
  v_route  uuid;
begin
  insert into delivery_route (tenant_id, collaborator_id, route_date)
  values (v_tenant, _collaborator, _date)
  on conflict (tenant_id, collaborator_id, route_date) do update
    set collaborator_id = excluded.collaborator_id
  returning id into v_route;

  -- Atendimentos do dia que pedem ida e/ou volta. O dia é o do fuso do
  -- petshop: scheduled_at é timestamptz, e comparar em UTC jogaria o
  -- atendimento das 21h para o dia seguinte.
  with alvo as (
    select
      a.id,
      a.pet_id,
      k.kind,
      -- Horário-alvo da parada: buscar uma hora antes do atendimento,
      -- devolver quando ele terminar (ou duas horas depois, se ainda não
      -- terminou). É só para ordenar — o entregador reordena se quiser.
      case when k.kind = 'PICKUP'
           then a.scheduled_at - interval '1 hour'
           else coalesce(a.finished_at, a.scheduled_at + interval '2 hours')
      end as alvo_at
      from appointment a
      cross join lateral (
        select 'PICKUP'::delivery_stop_kind as kind where a.pickup
        union all
        select 'DROPOFF'::delivery_stop_kind where a.dropoff
      ) k
     where a.tenant_id = v_tenant
       and a.scheduled_at is not null
       and (a.scheduled_at at time zone 'America/Sao_Paulo')::date = _date
       -- REQUESTED fica FORA (0064): pedido do tutor ainda não aceito não
       -- é compromisso do petshop.
       and a.status in ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED')
  )
  insert into delivery_stop (
    tenant_id, route_id, appointment_id, kind, eta_at,
    cep, street, street_number, complement, district, city, state, lat, lng
  )
  select
    v_tenant, v_route, alvo.id, alvo.kind, alvo.alvo_at,
    e.cep, e.street, e.street_number, e.complement, e.district, e.city, e.state,
    e.lat, e.lng
    from alvo
    -- LEFT: pet sem endereço nenhum ainda assim vira parada, com os campos
    -- vazios e um aviso na tela. Sumir da rota seria pior — o entregador
    -- descobriria a falta no fim do dia, não agora.
    left join lateral pet_effective_address(alvo.pet_id) e on true
  -- A parada já existente não muda de rota: quem montou primeiro fica com
  -- ela (é o que o unique garante). Aqui só o plano é refrescado.
  on conflict (appointment_id, kind) do update
    set eta_at = excluded.eta_at,
        -- Parada PENDENTE segue o atendimento, inclusive de rota: remarcado
        -- para outro dia, ela muda de route_id aqui. Sem isto o unique de
        -- (appointment_id, kind) fazia a parada ficar presa ao dia antigo e
        -- ser apagada como órfã — sumia em vez de migrar.
        -- Concluída não migra: o que já aconteceu pertence ao dia em que
        -- aconteceu.
        route_id = case when delivery_stop.status = 'PENDING'
                        then excluded.route_id else delivery_stop.route_id end,
        -- Endereço e coordenada só são refrescados enquanto a parada não
        -- aconteceu; depois disso o snapshot é histórico.
        cep           = case when delivery_stop.status = 'PENDING' then excluded.cep           else delivery_stop.cep end,
        street        = case when delivery_stop.status = 'PENDING' then excluded.street        else delivery_stop.street end,
        street_number = case when delivery_stop.status = 'PENDING' then excluded.street_number else delivery_stop.street_number end,
        complement    = case when delivery_stop.status = 'PENDING' then excluded.complement    else delivery_stop.complement end,
        district      = case when delivery_stop.status = 'PENDING' then excluded.district      else delivery_stop.district end,
        city          = case when delivery_stop.status = 'PENDING' then excluded.city          else delivery_stop.city end,
        state         = case when delivery_stop.status = 'PENDING' then excluded.state         else delivery_stop.state end,
        lat           = case when delivery_stop.status = 'PENDING' then excluded.lat           else delivery_stop.lat end,
        lng           = case when delivery_stop.status = 'PENDING' then excluded.lng           else delivery_stop.lng end;

  -- Saiu do plano: atendimento cancelado, ou a marcação de leva-e-traz foi
  -- desligada. Só as pendentes somem.
  delete from delivery_stop s
   using appointment a
   where s.route_id = v_route
     and s.status = 'PENDING'
     and a.id = s.appointment_id
     and (
       a.status not in ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED')
       or (s.kind = 'PICKUP'  and not a.pickup)
       or (s.kind = 'DROPOFF' and not a.dropoff)
       -- Remarcado para outro dia: a parada não é mais desta rota. Faltava
       -- desde a 0062, e só apareceu quando o gatilho passou a recalcular
       -- também o dia antigo — antes, a parada órfã simplesmente ficava lá.
       or (a.scheduled_at at time zone 'America/Sao_Paulo')::date
          is distinct from _date
     );

  -- Ordem do dia. As concluídas ficam com a posição que tiveram; as pendentes
  -- se reorganizam por horário-alvo.
  with ordenado as (
    select s.id, row_number() over (order by s.eta_at nulls last, s.id) as pos
      from delivery_stop s
     where s.route_id = v_route
  )
  update delivery_stop s
     set position = o.pos
    from ordenado o
   where o.id = s.id
     and s.position is distinct from o.pos;

  return v_route;
end;
$$;

revoke all on function build_delivery_route_internal(uuid, uuid, date)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. A função pública: resolve o tenant, confere a permissão e delega.
-- ---------------------------------------------------------------------
create or replace function build_delivery_route(_collaborator uuid, _date date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  select c.tenant_id into v_tenant
    from collaborator c
   where c.id = _collaborator
     and c.active
     and c.access_role = 'DELIVERY';

  if v_tenant is null then
    raise exception 'DELIVERY_COLLABORATOR_NOT_FOUND';
  end if;

  -- Monta a gestão, ou o próprio entregador para si.
  --
  -- O coalesce não é decoração: my_collaborator_id devolve NULL para quem não
  -- é colaborador, `false or null` é null, e `if not null then` NÃO dispara.
  -- Sem ele, esta função SECURITY DEFINER — que escreve sem passar por RLS —
  -- deixaria passar exatamente quem não deveria.
  if not coalesce(
       is_staff(v_tenant) or my_collaborator_id(v_tenant) = _collaborator,
       false
     ) then
    raise exception 'NOT_ALLOWED';
  end if;

  return build_delivery_route_internal(v_tenant, _collaborator, _date);
end;
$$;

grant execute on function build_delivery_route(uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- 3. O gatilho
--
-- Escolhe o entregador quando há UM só ativo — o caso da quase totalidade dos
-- petshops. Com dois ou mais não há como adivinhar de quem é a viagem, e
-- continua valendo o que já valia: cada um monta a sua ao abrir o painel.
-- Melhor não montar do que atribuir à pessoa errada.
--
-- Dispara em mais do que o aceite: desligar a marcação de leva-e-traz,
-- remarcar o horário e cancelar também precisam chegar ao painel aberto. Quem
-- decide o que entra e o que sai da rota é a função de montagem — aqui só se
-- decide QUANDO recalcular.
-- ---------------------------------------------------------------------
create or replace function sync_delivery_route()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collab uuid;
  v_quantos int;
  v_dia_novo date;
  v_dia_velho date;
begin
  -- Atendimento que nunca teve leva-e-traz não mexe em rota nenhuma. O `old`
  -- entra na conta para a parada sumir quando a marcação é DESLIGADA.
  if not coalesce(new.pickup or new.dropoff, false)
     and not (tg_op = 'UPDATE' and coalesce(old.pickup or old.dropoff, false)) then
    return new;
  end if;

  -- Duas consultas, e não um count+min: uuid não tem min() no Postgres, e
  -- contar antes deixa explícito que só o caso "exatamente um" segue adiante.
  select count(*) into v_quantos
    from collaborator c
   where c.tenant_id = new.tenant_id
     and c.active
     and c.access_role = 'DELIVERY';

  if v_quantos <> 1 then
    return new;
  end if;

  select c.id into v_collab
    from collaborator c
   where c.tenant_id = new.tenant_id
     and c.active
     and c.access_role = 'DELIVERY'
   limit 1;

  v_dia_novo  := (new.scheduled_at at time zone 'America/Sao_Paulo')::date;
  v_dia_velho := case when tg_op = 'UPDATE'
                      then (old.scheduled_at at time zone 'America/Sao_Paulo')::date end;

  if v_dia_novo is not null then
    perform build_delivery_route_internal(new.tenant_id, v_collab, v_dia_novo);
  end if;

  -- Remarcação para outro dia: o dia antigo precisa perder a parada que ficou
  -- órfã lá, e só a montagem daquele dia sabe removê-la.
  if v_dia_velho is not null and v_dia_velho is distinct from v_dia_novo then
    perform build_delivery_route_internal(new.tenant_id, v_collab, v_dia_velho);
  end if;

  return new;
end;
$$;

drop trigger if exists sync_delivery_route on appointment;
create trigger sync_delivery_route
  after insert or update of status, pickup, dropoff, scheduled_at on appointment
  for each row execute function sync_delivery_route();

notify pgrst, 'reload schema';
