-- =====================================================================
-- Leva-e-traz em etapas.
--
-- O fluxo real de um dia de entregador não é uma fila: ele sai, busca um ou
-- dois pets, deixa no petshop, busca outros, e só leva de volta quem já
-- terminou o banho. Esta migration dá ao banco as peças para isso:
--
--   1. o veículo do entregador (ícone do mapa, dele e do tutor);
--   2. os avisos ao tutor passam a acompanhar as três etapas da busca;
--   3. deixar o pet no petshop faz o check-in do atendimento sozinho;
--   4. o entregador é avisado quando o banho termina e o pet pode voltar.
--
-- Os valores de enum usados aqui vêm da 0066.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Veículo
-- ---------------------------------------------------------------------

alter table collaborator
  add column if not exists vehicle delivery_vehicle not null default 'MOTORCYCLE';

comment on column collaborator.vehicle is
  'Com o que o entregador anda. Só tem efeito para access_role = DELIVERY: '
  'decide o ícone dele no mapa.';

-- Copiado para a posição porque o TUTOR precisa dele e não enxerga a tabela
-- collaborator — a posição é a única linha do entregador que o tutor lê.
alter table delivery_position
  add column if not exists vehicle delivery_vehicle;

-- ---------------------------------------------------------------------
-- 2. Avisos ao tutor, agora em três etapas na busca
--
-- EN_ROUTE   → "Estamos a caminho"          (igual antes)
-- PICKED_UP  → "Pet a caminho do petshop"   (era o aviso do DONE)
-- DONE       → "Chegou ao petshop"          (novo)
-- A devolução segue igual: EN_ROUTE e DONE.
-- ---------------------------------------------------------------------

create or replace function notify_tutor_delivery()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid;
  v_tenant  uuid;
  v_pet     text;
  v_tutor   uuid;
  v_kind    notification_kind;
  v_title   text;
  v_body    text;
  v_href    text;
begin
  if new.status = old.status then
    return new;
  end if;

  select a.tutor_id, p.name, a.tenant_id
    into v_tutor, v_pet, v_tenant
    from appointment a
    join pet p on p.id = a.pet_id
   where a.id = new.appointment_id;

  v_profile := tutor_profile(v_tutor);
  if v_profile is null then
    return new;  -- tutor sem acesso ao app
  end if;

  -- Sem artigo antes do nome, pelo mesmo motivo da 0063: o cadastro não
  -- guarda sexo do pet.
  v_pet := coalesce(v_pet, 'seu pet');

  if new.status = 'EN_ROUTE' and new.kind = 'PICKUP' then
    v_kind  := 'PICKUP_STARTED';
    v_title := 'Estamos a caminho';
    v_body  := 'Nosso entregador saiu para buscar ' || v_pet || '. Já pode deixar tudo pronto!';
    v_href  := '/a-caminho';
  elsif new.status = 'PICKED_UP' and new.kind = 'PICKUP' then
    v_kind  := 'PICKUP_DONE';
    v_title := 'Pet a caminho do petshop';
    v_body  := v_pet || ' foi buscado e está indo para o petshop.';
    v_href  := '/atendimentos';
  elsif new.status = 'DONE' and new.kind = 'PICKUP' then
    v_kind  := 'PICKUP_ARRIVED';
    v_title := 'Chegou ao petshop';
    v_body  := v_pet || ' chegou ao petshop e já vai ser atendido.';
    v_href  := '/atendimentos';
  elsif new.status = 'EN_ROUTE' and new.kind = 'DROPOFF' then
    v_kind  := 'DROPOFF_STARTED';
    v_title := 'Voltando para casa';
    v_body  := 'Nosso entregador saiu para levar ' || v_pet || ' de volta.';
    v_href  := '/a-caminho';
  elsif new.status = 'DONE' and new.kind = 'DROPOFF' then
    v_kind  := 'DROPOFF_DONE';
    v_title := 'Pet entregue';
    v_body  := v_pet || ' foi entregue em casa. Até a próxima!';
    v_href  := '/atendimentos';
  else
    return new;
  end if;

  perform create_notification(
    v_tenant,
    v_kind,
    v_title,
    v_body,
    v_href,
    jsonb_build_object(
      'stop_id', new.id,
      'route_id', new.route_id,
      'appointment_id', new.appointment_id,
      'kind', new.kind
    ),
    v_profile
  );
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. Pet deixado no petshop = check-in do atendimento
--
-- A recepção não precisa marcar à mão que o pet chegou: quem trouxe já
-- confirmou. Só avança de CONFIRMED — atendimento já em curso (ou já
-- finalizado, se a recepção foi mais rápida) não volta para trás.
--
-- Gatilho no banco, e não na server action, porque o entregador não tem
-- permissão de escrever em appointment (RLS da 0062 só dá select), e abrir
-- essa porta para ele fazer UMA transição seria abrir para todas.
-- ---------------------------------------------------------------------

create or replace function delivery_pickup_check_in()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'PICKUP'
     and new.status = 'DONE'
     and old.status is distinct from 'DONE' then
    update appointment
       set status = 'CHECKED_IN'
     where id = new.appointment_id
       and status = 'CONFIRMED';
  end if;
  return new;
end $$;

drop trigger if exists delivery_pickup_check_in on delivery_stop;
create trigger delivery_pickup_check_in
  after update of status on delivery_stop
  for each row execute function delivery_pickup_check_in();

-- ---------------------------------------------------------------------
-- 4. Banho terminou → aviso ao entregador
--
-- É o que tira a devolução de "aguardando banho". A tela já muda sozinha
-- (o sync_delivery_route da 0065 refresca a parada, e ela está no
-- realtime); o push é para quem está na rua, com o celular no bolso.
-- ---------------------------------------------------------------------

create or replace function notify_delivery_dropoff_ready()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_stop    uuid;
  v_route   uuid;
  v_collab  uuid;
  v_profile uuid;
  v_pet     text;
begin
  if new.status <> 'COMPLETED' or old.status = 'COMPLETED' or not new.dropoff then
    return new;
  end if;

  select s.id, s.route_id, r.collaborator_id
    into v_stop, v_route, v_collab
    from delivery_stop s
    join delivery_route r on r.id = s.route_id
   where s.appointment_id = new.id
     and s.kind = 'DROPOFF'
     and s.status = 'PENDING';

  if v_stop is null then
    return new;  -- rota ainda não montada, ou devolução já em andamento
  end if;

  v_profile := collaborator_profile(v_collab);
  if v_profile is null then
    return new;  -- entregador sem login
  end if;

  select name into v_pet from pet where id = new.pet_id;

  perform create_notification(
    new.tenant_id,
    'DROPOFF_READY',
    'Pronto para entregar',
    coalesce(v_pet, 'Um pet') || ' terminou o atendimento e já pode voltar para casa.',
    '/rota',
    jsonb_build_object(
      'stop_id', v_stop,
      'route_id', v_route,
      'appointment_id', new.id,
      'collaborator_id', v_collab
    ),
    v_profile
  );
  return new;
end $$;

drop trigger if exists notify_delivery_dropoff_ready on appointment;
create trigger notify_delivery_dropoff_ready
  after update of status on appointment
  for each row execute function notify_delivery_dropoff_ready();

notify pgrst, 'reload schema';
