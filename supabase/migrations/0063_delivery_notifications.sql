-- =====================================================================
-- Avisos do leva-e-traz.
--
-- Nada de estrutura nova: recipient_profile_id (0042) já é "aviso privado de
-- uma pessoa", e a policy, a RPC list_notifications e o disparo de push já
-- funcionam para qualquer profile (0044). O que falta são os gatilhos.
--
-- O momento de avisar é a SAÍDA, não a chegada: "estamos a caminho" dá ao
-- tutor os minutos de que ele precisa para prender o cachorro na coleira e
-- descer. Avisar só na chegada seria avisar tarde.
--
-- Parada FAILED (ninguém em casa, portão fechado) de propósito não notifica:
-- ali o certo é o petshop LIGAR, e um push seria um jeito frio de dar uma
-- notícia que precisa de conversa.
-- =====================================================================

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

  -- O nome do pet entra sem artigo ("Thor está a caminho") porque o cadastro
  -- não guarda sexo: "O Thor" erraria em metade dos pets. Mesmo cuidado com
  -- gênero que a 0044 tem com o nome do serviço.
  v_pet := coalesce(v_pet, 'seu pet');

  if new.status = 'EN_ROUTE' and new.kind = 'PICKUP' then
    v_kind  := 'PICKUP_STARTED';
    v_title := 'Estamos a caminho';
    v_body  := 'Nosso entregador saiu para buscar ' || v_pet || '. Já pode deixar tudo pronto!';
    v_href  := '/a-caminho';
  elsif new.status = 'DONE' and new.kind = 'PICKUP' then
    v_kind  := 'PICKUP_DONE';
    v_title := 'Pet a caminho do petshop';
    v_body  := v_pet || ' foi buscado e está indo para o petshop.';
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

create trigger notify_tutor_delivery
  after update on delivery_stop
  for each row execute function notify_tutor_delivery();

-- ---------------------------------------------------------------------
-- Aviso para o próprio entregador: tem rota hoje.
--
-- Dispara na primeira parada da rota, e não na criação da rota, porque no
-- insert de delivery_route ainda não existe parada nenhuma (elas vêm logo
-- depois, na mesma transação de build_delivery_route) e "rota vazia" não é
-- notícia. A deduplicação por route_id garante um aviso só por dia.
-- ---------------------------------------------------------------------

create or replace function notify_delivery_route_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid;
  v_collab  uuid;
  v_date    date;
begin
  select r.collaborator_id, r.route_date into v_collab, v_date
    from delivery_route r where r.id = new.route_id;

  v_profile := collaborator_profile(v_collab);
  if v_profile is null then
    return new;  -- entregador sem login
  end if;

  -- Montou a própria rota: já sabe.
  if v_profile = auth.uid() then
    return new;
  end if;

  if exists (
    select 1 from notification
     where kind = 'ROUTE_ASSIGNED'
       and recipient_profile_id = v_profile
       and meta->>'route_id' = new.route_id::text
  ) then
    return new;
  end if;

  perform create_notification(
    new.tenant_id,
    'ROUTE_ASSIGNED',
    'Sua rota do dia está pronta',
    'Você tem paradas de leva-e-traz em '
      || to_char(v_date, 'DD/MM') || '. Confira a ordem antes de sair.',
    '/rota',
    jsonb_build_object('route_id', new.route_id, 'collaborator_id', v_collab),
    v_profile
  );
  return new;
end $$;

create trigger notify_delivery_route_assigned
  after insert on delivery_stop
  for each row execute function notify_delivery_route_assigned();

-- O entregador também inscreve o aparelho dele no push. A policy da 0044 já
-- aceita qualquer colaborador (my_collaborator_id não distingue cargo), então
-- não há nada a mudar aqui — este comentário existe para quem vier conferir.

notify pgrst, 'reload schema';
