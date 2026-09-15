-- =====================================================================
-- Leva-e-traz: rota do dia do entregador.
--
-- O endereço estruturado nasceu na 0059 prevendo exatamente isto. Aqui ele
-- vira operação: o atendimento marca que o pet precisa ser buscado em casa
-- (e/ou devolvido), uma RPC junta tudo do dia numa rota ordenada, e o
-- entregador executa parada por parada com a posição dele no mapa.
--
-- DESENHO EM TRÊS TABELAS:
--   delivery_route    — o dia de trabalho de um entregador
--   delivery_stop     — cada ida a um endereço (buscar OU devolver)
--   delivery_position — onde ele está AGORA (uma linha por rota, sobrescrita)
--
-- A posição é sobrescrita, e não acumulada: o rastro completo do dia seria
-- dado pessoal de um funcionário sem nenhum uso operacional depois que a
-- rota acaba. O que serve é "onde ele está agora", e isso cabe em uma linha.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cargo de acesso do colaborador
--
-- role_title continua sendo o cargo escrito na ficha ("Banhista",
-- "Motorista") — texto livre que o petshop usa como quiser. access_role é
-- outra pergunta: qual painel essa pessoa abre quando entra no sistema.
-- Dois campos porque são mesmo duas coisas: o petshop pode ter seis títulos
-- diferentes e só dois painéis.
-- ---------------------------------------------------------------------

alter table collaborator
  add column access_role staff_role not null default 'COLLABORATOR';

alter table collaborator
  add constraint collaborator_access_role_ck
  check (access_role in ('COLLABORATOR', 'DELIVERY'));

comment on column collaborator.access_role is
  'Painel que este colaborador abre: COLLABORATOR (quem atende) ou DELIVERY '
  '(quem busca e devolve o pet). É o papel que a membership recebe no primeiro '
  'acesso — ver link_collaborator_access.';

-- A membership do colaborador nasce num lugar só (0032), com o papel fixo no
-- código. Agora ela segue o cargo de acesso do cadastro.
create or replace function link_collaborator_access(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_collab record;
begin
  select c.id, c.tenant_id, c.full_name, c.access_role
    into v_collab
    from public.collaborator c
   where lower(c.access_email) = v_email
     and (c.profile_id is null or c.profile_id = p_user_id)
     and c.active
   limit 1;

  if v_collab.id is null then
    raise exception 'COLLABORATOR_NOT_FOUND';
  end if;

  insert into public.profile (id, full_name)
  values (p_user_id, coalesce(v_collab.full_name, ''))
  on conflict (id) do update
    set full_name = coalesce(nullif(excluded.full_name, ''), profile.full_name);

  update public.collaborator
     set profile_id = p_user_id
   where id = v_collab.id
     and profile_id is null;

  insert into public.membership (tenant_id, profile_id, role)
  values (v_collab.tenant_id, p_user_id, coalesce(v_collab.access_role, 'COLLABORATOR'))
  on conflict (tenant_id, profile_id) do nothing;
end;
$$;

revoke all on function link_collaborator_access(uuid, text) from public, anon, authenticated;
grant execute on function link_collaborator_access(uuid, text) to service_role;

-- ---------------------------------------------------------------------
-- 2. is_staff passa a excluir também o entregador
--
-- ESTE É O PONTO CRÍTICO DA MIGRATION. is_staff() significa "membro com
-- acesso de gestão" e sustenta ~40 policies (financeiro, estoque, produtos,
-- configurações). Ela era escrita como `role <> 'COLLABORATOR'` — uma
-- negação que aceita qualquer papel futuro por omissão. Sem esta correção,
-- o entregador entraria vendo o caixa do petshop.
--
-- Continua sendo uma lista de exclusão (e não `in (OWNER, MANAGER, ...)`)
-- para não mudar o comportamento de nenhum papel existente nesta migration.
-- ---------------------------------------------------------------------

create or replace function is_staff(_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from membership m
     where m.profile_id = auth.uid()
       and m.tenant_id = _tenant
       and m.role not in ('COLLABORATOR', 'DELIVERY')
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Marcação de leva-e-traz no atendimento
--
-- Duas colunas e não uma: é comum o tutor trazer o pet e pedir só a volta
-- (ou o contrário, deixar de manhã e pedir a entrega à noite).
-- ---------------------------------------------------------------------

alter table appointment
  add column pickup  boolean not null default false,
  add column dropoff boolean not null default false;

comment on column appointment.pickup is
  'Buscar o pet em casa antes do atendimento. Vira uma delivery_stop PICKUP.';
comment on column appointment.dropoff is
  'Levar o pet de volta depois do atendimento. Vira uma delivery_stop DROPOFF.';

-- ---------------------------------------------------------------------
-- 4. Coordenadas: cache da geocodificação
--
-- Endereço vira ponto no mapa por uma consulta externa (Nominatim) que é
-- lenta e tem limite de uso. Guardamos o resultado ao lado do endereço e só
-- consultamos de novo quando ele muda.
-- ---------------------------------------------------------------------

alter table tutor
  add column lat numeric(9,6),
  add column lng numeric(9,6),
  add column geocoded_at timestamptz;

alter table pet
  add column lat numeric(9,6),
  add column lng numeric(9,6),
  add column geocoded_at timestamptz;

comment on column tutor.lat is
  'Cache da geocodificação do endereço. Zerado pelo trigger quando o endereço muda.';

-- O trigger de normalização (0059) passa a invalidar a coordenada junto.
-- Coordenada velha num endereço novo é pior que coordenada nenhuma: manda o
-- entregador com confiança para a casa errada.
--
-- A comparação com `old` importa: o geocoder grava lat/lng sem tocar no
-- endereço (e o trigger nem dispara, porque é `update of <colunas de
-- endereço>`), mas uma tela que salve o cadastro inteiro sem mudar nada
-- reenviaria os mesmos valores — e aí regeocodificar seria desperdício.
create or replace function normalize_address_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_changed boolean := true;
begin
  new.cep           := nullif(regexp_replace(coalesce(new.cep, ''), '\D', '', 'g'), '');
  new.state         := nullif(upper(btrim(coalesce(new.state, ''))), '');
  new.street        := nullif(btrim(coalesce(new.street, '')), '');
  new.street_number := nullif(btrim(coalesce(new.street_number, '')), '');
  new.complement    := nullif(btrim(coalesce(new.complement, '')), '');
  new.district      := nullif(btrim(coalesce(new.district, '')), '');
  new.city          := nullif(btrim(coalesce(new.city, '')), '');

  if tg_op = 'UPDATE' then
    v_changed := (new.cep, new.street, new.street_number, new.complement,
                  new.district, new.city, new.state)
      is distinct from
                 (old.cep, old.street, old.street_number, old.complement,
                  old.district, old.city, old.state);
  end if;

  if v_changed then
    new.lat := null;
    new.lng := null;
    new.geocoded_at := null;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Endereço efetivo do pet
--
-- Gêmeo em SQL de hasAddress()/formatAddressLine() (packages/types/src/
-- address.ts): as sete colunas do pet nulas significam "mora com o tutor"
-- (0059). A escolha é do bloco inteiro, nunca coluna a coluna — meio
-- endereço do pet somado a meio do tutor daria um lugar que não existe.
-- ---------------------------------------------------------------------

create or replace function pet_effective_address(_pet uuid)
returns table (
  cep text, street text, street_number text, complement text,
  district text, city text, state text,
  lat numeric, lng numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    case when s.own then s.p_cep    else s.t_cep    end,
    case when s.own then s.p_street else s.t_street end,
    case when s.own then s.p_number else s.t_number end,
    case when s.own then s.p_compl  else s.t_compl  end,
    case when s.own then s.p_distr  else s.t_distr  end,
    case when s.own then s.p_city   else s.t_city   end,
    case when s.own then s.p_state  else s.t_state  end,
    case when s.own then s.p_lat    else s.t_lat    end,
    case when s.own then s.p_lng    else s.t_lng    end
  from (
    select
      (p.cep is not null or p.street is not null or p.street_number is not null
       or p.complement is not null or p.district is not null
       or p.city is not null or p.state is not null) as own,
      p.cep as p_cep, p.street as p_street, p.street_number as p_number,
      p.complement as p_compl, p.district as p_distr, p.city as p_city,
      p.state as p_state, p.lat as p_lat, p.lng as p_lng,
      t.cep as t_cep, t.street as t_street, t.street_number as t_number,
      t.complement as t_compl, t.district as t_distr, t.city as t_city,
      t.state as t_state, t.lat as t_lat, t.lng as t_lng
    from pet p
    join tutor t on t.id = p.tutor_id
   where p.id = _pet
  ) s;
$$;

-- ---------------------------------------------------------------------
-- 6. Rota, paradas e posição
-- ---------------------------------------------------------------------

create type delivery_route_status as enum ('PLANNED', 'IN_PROGRESS', 'DONE', 'CANCELLED');
create type delivery_stop_kind    as enum ('PICKUP', 'DROPOFF');
create type delivery_stop_status  as enum ('PENDING', 'EN_ROUTE', 'DONE', 'FAILED');

create table delivery_route (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenant(id) on delete cascade,
  collaborator_id uuid not null references collaborator(id) on delete cascade,
  route_date      date not null,
  status          delivery_route_status not null default 'PLANNED',
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  -- Um entregador, um dia, uma rota. Sai de graça a idempotência de
  -- build_delivery_route.
  unique (tenant_id, collaborator_id, route_date)
);
create index on delivery_route (tenant_id, route_date);

create table delivery_stop (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenant(id) on delete cascade,
  route_id       uuid not null references delivery_route(id) on delete cascade,
  appointment_id uuid not null references appointment(id) on delete cascade,
  kind           delivery_stop_kind not null,
  position       integer not null default 0,
  status         delivery_stop_status not null default 'PENDING',

  -- Snapshot do endereço no momento em que a parada foi montada. O tutor pode
  -- se mudar no mês que vem, e o histórico precisa continuar dizendo onde o
  -- pet foi buscado naquele dia — mesma razão de product_reservation_item
  -- guardar product_name (0037).
  cep text, street text, street_number text, complement text,
  district text, city text, state text,
  lat numeric(9,6), lng numeric(9,6),

  eta_at      timestamptz,
  arrived_at  timestamptz,
  done_at     timestamptz,
  fail_reason text,

  -- Um atendimento gera no máximo uma ida e uma volta. É o que impede duas
  -- rotas do mesmo dia disputarem o mesmo pet.
  unique (appointment_id, kind)
);
create index on delivery_stop (route_id, position);
create index on delivery_stop (tenant_id);

create table delivery_position (
  route_id        uuid primary key references delivery_route(id) on delete cascade,
  tenant_id       uuid not null references tenant(id) on delete cascade,
  collaborator_id uuid not null references collaborator(id) on delete cascade,
  lat        numeric(9,6) not null,
  lng        numeric(9,6) not null,
  accuracy_m numeric,
  heading    numeric,
  speed_ms   numeric,
  updated_at timestamptz not null default now()
);

comment on table delivery_position is
  'Onde o entregador está agora — uma linha por rota, sobrescrita a cada '
  'atualização do GPS. Não é histórico de deslocamento de propósito: apagada '
  'quando a rota termina.';

-- ---------------------------------------------------------------------
-- 7. Helpers do entregador (molde de my_collaborator_id, 0031)
-- ---------------------------------------------------------------------

-- my_collaborator_id já resolve "qual é o cadastro desta pessoa" para os dois
-- cargos — o entregador também é uma linha de collaborator. O que falta é
-- saber se o cargo dele é o de entrega.
create or replace function is_delivery(_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from collaborator c
     where c.profile_id = auth.uid()
       and c.tenant_id = _tenant
       and c.active
       and c.access_role = 'DELIVERY'
  );
$$;

-- A parada é minha? É a pergunta que sustenta quase toda a RLS abaixo.
create or replace function my_delivery_stop(_tenant uuid, _stop uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from delivery_stop s
      join delivery_route r on r.id = s.route_id
     where s.id = _stop
       and s.tenant_id = _tenant
       and r.collaborator_id = my_collaborator_id(_tenant)
  );
$$;

-- As rotas do entregador logado.
--
-- Existe como função (e não como subconsulta dentro da policy) por um motivo
-- duro: uma policy de delivery_stop que consulte delivery_route ou appointment
-- dispara a RLS DAQUELAS tabelas, que por sua vez consultam delivery_stop —
-- e o Postgres aborta com "infinite recursion detected in policy". SECURITY
-- DEFINER quebra o ciclo porque roda fora da RLS. Mesma razão de
-- collab_sees_pet existir na 0031.
create or replace function my_route_ids(_tenant uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select r.id
    from delivery_route r
   where r.tenant_id = _tenant
     and r.collaborator_id = my_collaborator_id(_tenant);
$$;

-- Dono do atendimento, sem passar pela RLS de appointment (mesmo ciclo).
create or replace function appointment_tutor(_appointment uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tutor_id from appointment where id = _appointment;
$$;

-- O entregador tem parada para este atendimento?
create or replace function delivery_sees_appointment(_tenant uuid, _appointment uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from delivery_stop s
      join delivery_route r on r.id = s.route_id
     where s.appointment_id = _appointment
       and s.tenant_id = _tenant
       and r.collaborator_id = my_collaborator_id(_tenant)
  );
$$;

-- O entregador enxerga o pet que ele tem parada para buscar ou devolver —
-- gêmeo de collab_sees_pet (0031), por outro caminho.
create or replace function delivery_sees_pet(_tenant uuid, _pet uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from delivery_stop s
      join delivery_route r on r.id = s.route_id
      join appointment a on a.id = s.appointment_id
     where s.tenant_id = _tenant
       and a.pet_id = _pet
       and r.collaborator_id = my_collaborator_id(_tenant)
  );
$$;

-- Tem alguém indo até a casa deste tutor agora? É o que libera o tutor a ver
-- a posição do entregador no app — e só enquanto durar.
create or replace function tutor_active_stop_route(_tenant uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct s.route_id
    from delivery_stop s
    join appointment a on a.id = s.appointment_id
   where s.tenant_id = _tenant
     and s.status = 'EN_ROUTE'
     and a.tutor_id = my_tutor_id(_tenant);
$$;

-- ---------------------------------------------------------------------
-- 8. Montagem da rota
--
-- Uma RPC, e não um trigger em appointment: remarcar horário, cancelar e
-- trocar a marcação de leva-e-traz mexeriam na rota em cascata, cada um com
-- sua exceção. Aqui a rota é RECALCULADA — chamar de novo é sempre seguro.
--
-- O que ela nunca faz: mexer em parada já concluída (DONE/FAILED). O que já
-- aconteceu é histórico, não plano.
-- ---------------------------------------------------------------------

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
       and a.status in ('REQUESTED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED')
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
       a.status in ('CANCELLED', 'REJECTED')
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

grant execute on function build_delivery_route(uuid, date) to authenticated;

-- ---------------------------------------------------------------------
-- 9. RLS
-- ---------------------------------------------------------------------

alter table delivery_route enable row level security;
alter table delivery_stop enable row level security;
alter table delivery_position enable row level security;

-- Gestão administra o leva-e-traz inteiro.
create policy delivery_route_staff on delivery_route for all
  using (is_staff(tenant_id)) with check (is_staff(tenant_id));
create policy delivery_stop_staff on delivery_stop for all
  using (is_staff(tenant_id)) with check (is_staff(tenant_id));
create policy delivery_position_staff on delivery_position for select
  using (is_staff(tenant_id));

-- O entregador lê e atualiza a própria rota. O with check repete a condição
-- para ele não conseguir passar a rota para outro colaborador.
create policy delivery_route_own on delivery_route for select
  using (collaborator_id = my_collaborator_id(tenant_id));
create policy delivery_route_own_update on delivery_route for update
  using (collaborator_id = my_collaborator_id(tenant_id))
  with check (collaborator_id = my_collaborator_id(tenant_id));

create policy delivery_stop_own on delivery_stop for select
  using (route_id in (select my_route_ids(tenant_id)));
create policy delivery_stop_own_update on delivery_stop for update
  using (route_id in (select my_route_ids(tenant_id)))
  with check (route_id in (select my_route_ids(tenant_id)));

-- A posição é escrita pelo próprio aparelho dele, a cada poucos segundos.
create policy delivery_position_own on delivery_position for all
  using (collaborator_id = my_collaborator_id(tenant_id))
  with check (collaborator_id = my_collaborator_id(tenant_id));

-- O tutor vê a posição só enquanto alguém estiver a caminho da casa dele.
-- Fora dessa janela não há linha visível: ninguém acompanha o entregador
-- enquanto ele atende outro cliente.
create policy delivery_position_tutor on delivery_position for select
  using (route_id in (select tutor_active_stop_route(tenant_id)));

create policy delivery_stop_tutor on delivery_stop for select
  using (appointment_tutor(appointment_id) = my_tutor_id(tenant_id));

-- O entregador precisa do atendimento (horário, serviço) e do pet das suas
-- paradas. A 0031 já dá isso ao colaborador que atende, por outro caminho.
create policy appointment_delivery_select on appointment for select using (
  delivery_sees_appointment(tenant_id, id)
);

create policy pet_delivery_select on pet for select using (
  delivery_sees_pet(tenant_id, id)
);

-- tenant, service_type e o próprio cadastro: o painel precisa do nome do
-- petshop, do nome do serviço e de saber quem ele é. As policies
-- tenant_collab_select / service_collab_select / collaborator_self_select da
-- 0031 usam my_collaborator_id, que já vale para os dois cargos.

-- ---------------------------------------------------------------------
-- 10. Ficha da parada para o entregador
--
-- RLS é por linha, não por coluna: dar select em `tutor` entregaria o
-- cadastro inteiro (CPF, e-mail, histórico). Mas o entregador PRECISA do
-- telefone — portão fechado e ninguém atendendo é a regra, não a exceção. A
-- view (SECURITY DEFINER, filtrada pelas paradas dele) entrega o nome, o
-- telefone e o endereço. Nada além disso.
--
-- Mesmo molde de collaborator_pet (0031): segura para conceder a
-- `authenticated` em geral, porque para quem não tem a parada ela vem vazia.
-- ---------------------------------------------------------------------

create view delivery_stop_card
with (security_invoker = false)
as
select
  s.id,
  s.tenant_id,
  s.route_id,
  s.appointment_id,
  s.kind,
  s.position,
  s.status,
  s.eta_at,
  s.arrived_at,
  s.done_at,
  s.fail_reason,
  s.cep, s.street, s.street_number, s.complement,
  s.district, s.city, s.state, s.lat, s.lng,
  a.scheduled_at,
  a.status as appointment_status,
  p.id     as pet_id,
  p.name   as pet_name,
  p.species,
  p.size,
  p.photo_path,
  t.id        as tutor_id,
  t.full_name as tutor_name,
  t.phone     as tutor_phone,
  st.name  as service_name
from delivery_stop s
join delivery_route r on r.id = s.route_id
join appointment a on a.id = s.appointment_id
join pet p on p.id = a.pet_id
join tutor t on t.id = a.tutor_id
left join service_type st on st.id = a.service_type_id
where r.collaborator_id = my_collaborator_id(s.tenant_id);

grant select on delivery_stop_card to authenticated;

-- ---------------------------------------------------------------------
-- 11. Fim da rota apaga a posição
--
-- Rota encerrada, rastreamento encerrado — no banco, não só na tela. O
-- aparelho do entregador para de enviar quando a rota sai de IN_PROGRESS,
-- mas confiar nisso seria deixar a última posição dele (muitas vezes a casa
-- do próprio entregador, no fim do dia) guardada para sempre.
-- ---------------------------------------------------------------------

create or replace function clear_delivery_position()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('DONE', 'CANCELLED') and old.status is distinct from new.status then
    delete from delivery_position where route_id = new.id;
  end if;
  return new;
end $$;

create trigger delivery_route_clear_position
  after update on delivery_route
  for each row execute function clear_delivery_position();

-- ---------------------------------------------------------------------
-- 12. Realtime: o mapa e a lista de paradas se movem sozinhos
-- ---------------------------------------------------------------------

alter table delivery_route replica identity full;
alter table delivery_stop replica identity full;
alter table delivery_position replica identity full;

do $$
declare
  t text;
begin
  foreach t in array array['delivery_route', 'delivery_stop', 'delivery_position']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
