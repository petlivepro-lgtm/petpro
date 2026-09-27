-- =====================================================================
-- O horário das paradas deixa de ser inventado.
--
-- Até a 0065 a busca levava o horário do atendimento menos uma hora, e a
-- devolução o fim do atendimento — ou, sem ele, o agendamento mais duas horas.
-- O entregador via um "buscar às 10:30" e uma "previsão ~13:30" que ninguém
-- combinou com o tutor.
--
-- Agora vale só o que é fato: a busca é no horário agendado, e a devolução
-- ganha horário quando o petshop finaliza o atendimento (finished_at). O
-- gatilho sync_delivery_route já recalcula a rota na mudança de status, então
-- o horário da devolução aparece no instante em que o serviço termina.
-- =====================================================================

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
      -- Horário da parada, sem estimativa nenhuma (0069): a busca é no
      -- horário agendado; a devolução só tem horário quando o petshop
      -- finaliza o atendimento — até lá fica NULL, e vai para o fim da ordem.
      case when k.kind = 'PICKUP'
           then a.scheduled_at
           else a.finished_at
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

-- As rotas de hoje em diante são remontadas para corrigir o eta_at e a ordem
-- das paradas que já existem. As de dias passados ficam como estão.
do $$
declare
  r record;
begin
  for r in
    select tenant_id, collaborator_id, route_date
      from delivery_route
     where route_date >= (now() at time zone 'America/Sao_Paulo')::date
  loop
    perform build_delivery_route_internal(r.tenant_id, r.collaborator_id, r.route_date);
  end loop;
end;
$$;
