-- =====================================================================
-- O pedido do tutor só entra na rota depois de aceito.
--
-- A 0062 nasceu quando apenas o balcão marcava leva-e-traz, e o balcão cria o
-- agendamento já CONFIRMED — por isso REQUESTED estava na lista de status que
-- viram parada sem que isso fizesse diferença.
--
-- Agora o tutor pede leva-e-traz pelo app, e o pedido dele nasce REQUESTED,
-- esperando o petshop aceitar. Com REQUESTED na lista, o entregador receberia
-- na rota a busca de um pet cujo horário o petshop ainda pode recusar — e
-- sairia de casa para buscar um atendimento que não existe.
--
-- Pedir não é o mesmo que estar combinado. A parada aparece quando o petshop
-- aceita, e some se ele voltar atrás: a limpeza abaixo deixa de listar os
-- status que saem e passa a exigir os que ficam, para um status novo nunca
-- entrar aqui por omissão.
-- =====================================================================

create or replace function build_delivery_route(_collaborator uuid, _date date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_route  uuid;
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

notify pgrst, 'reload schema';
