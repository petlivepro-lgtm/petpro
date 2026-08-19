-- =====================================================================
-- Notificações para o tutor.
--
-- Até aqui o fluxo era de mão única: o tutor pedia e ficava sem saber o que
-- aconteceu depois. Ele descobria que o pedido foi aceito, que o pet ficou
-- pronto ou que a reserva estava separada abrindo o app por conta própria —
-- ou ligando para a loja.
--
-- Nada de estrutura nova: `recipient_profile_id` (0042) já significa "aviso
-- privado de uma pessoa", e a policy notification_recipient_select, a RPC
-- list_notifications e o disparo de push já funcionam para qualquer profile.
-- O que falta é deixar o tutor inscrever o navegador dele e os gatilhos.
--
-- Tutor sem login (profile_id nulo — quem foi cadastrado pelo petshop e nunca
-- acessou) simplesmente não gera notificação: não há para quem entregar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Push: o tutor passa a poder inscrever o aparelho dele
-- ---------------------------------------------------------------------

drop policy if exists push_subscription_own on push_subscription;

create policy push_subscription_own on push_subscription
  for all
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and (
      is_management(tenant_id)
      or my_collaborator_id(tenant_id) is not null
      or my_tutor_id(tenant_id) is not null
    )
  );

-- Dono do login deste tutor, quando existe.
create or replace function tutor_profile(_tutor uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select profile_id from tutor where id = _tutor;
$$;

-- ---------------------------------------------------------------------
-- Agendamentos: aceito, recusado, finalizado
--
-- Um pedido com N serviços são N linhas irmãs pelo request_group_id (0008).
-- Aceitar ou recusar é uma decisão sobre o pedido inteiro, então vale um aviso
-- só — mas FINALIZAR é por serviço: o banho pode sair às 10h e a tosa às 14h,
-- e dizer "está pronto" na primeira seria mentira. Por isso só os dois
-- primeiros deduplicam por grupo.
-- ---------------------------------------------------------------------

create or replace function notify_tutor_appointment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid;
  v_pet text; v_service text; v_quando text;
  v_kind notification_kind; v_title text; v_body text;
  v_dedup boolean := false;
begin
  if new.status = old.status then
    return new;
  end if;

  v_profile := tutor_profile(new.tutor_id);
  if v_profile is null then
    return new;  -- tutor sem acesso ao app
  end if;

  -- Se quem mexeu foi o próprio tutor, ele já sabe.
  if my_tutor_id(new.tenant_id) = new.tutor_id then
    return new;
  end if;

  if new.status = 'CONFIRMED' and old.status = 'REQUESTED' then
    v_kind := 'BOOKING_CONFIRMED'; v_title := 'Agendamento confirmado'; v_dedup := true;
  elsif new.status = 'REJECTED' then
    v_kind := 'BOOKING_REJECTED'; v_title := 'Pedido não aceito'; v_dedup := true;
  elsif new.status = 'COMPLETED' then
    v_kind := 'BOOKING_COMPLETED'; v_title := 'Atendimento finalizado';
  else
    return new;
  end if;

  if v_dedup and new.request_group_id is not null and exists (
    select 1 from notification
     where kind = v_kind
       and recipient_profile_id = v_profile
       and meta->>'request_group_id' = new.request_group_id::text
  ) then
    return new;
  end if;

  select name into v_pet from pet where id = new.pet_id;
  select name into v_service from service_type where id = new.service_type_id;
  v_quando := br_datetime(new.scheduled_at);

  -- Os textos começam por um substantivo masculino fixo ("agendamento",
  -- "pedido", "atendimento") de propósito: o nome do serviço é livre e pode
  -- ter qualquer gênero, e "Hidratação está confirmado" sairia errado.
  v_body := case v_kind
    when 'BOOKING_CONFIRMED' then
      'Seu agendamento de ' || coalesce(v_service, 'serviço') || ' para '
        || coalesce(v_pet, 'seu pet')
        || coalesce(' está confirmado para ' || v_quando, ' foi confirmado')
    when 'BOOKING_REJECTED' then
      'Seu pedido de ' || coalesce(v_service, 'serviço') || ' para '
        || coalesce(v_pet, 'seu pet') || ' não pôde ser aceito. Fale com o petshop.'
    else
      'O atendimento de ' || coalesce(v_pet, 'seu pet')
        || coalesce(' (' || v_service || ')', '')
        || ' foi finalizado. Já pode buscar!'
  end;

  perform create_notification(
    new.tenant_id,
    v_kind,
    v_title,
    v_body,
    '/atendimentos',
    jsonb_build_object(
      'appointment_id', new.id,
      'request_group_id', new.request_group_id,
      'pet_id', new.pet_id
    ),
    v_profile
  );
  return new;
end $$;

drop trigger if exists notify_tutor_appointment on appointment;
create trigger notify_tutor_appointment
  after update on appointment
  for each row execute function notify_tutor_appointment();

-- ---------------------------------------------------------------------
-- Reservas: separada (pode retirar) e recusada
--
-- PICKED é o momento útil: a mercadoria está separada e esperando. COMPLETED
-- fica de fora de propósito — ali o tutor está no balcão pagando, e avisar o
-- celular dele naquele instante não serve para nada.
--
-- A recusa continua tendo o banner com o motivo dentro do app
-- (rejection-notice.tsx); esta notificação é para quem NÃO está com o app
-- aberto. São camadas diferentes, não duplicatas.
-- ---------------------------------------------------------------------

create or replace function notify_tutor_reservation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_profile uuid; v_kind notification_kind; v_title text; v_body text;
  v_items int;
begin
  if new.status = old.status or new.tutor_id is null then
    return new;
  end if;

  v_profile := tutor_profile(new.tutor_id);
  if v_profile is null then
    return new;
  end if;

  if my_tutor_id(new.tenant_id) = new.tutor_id then
    return new;
  end if;

  if new.status = 'PICKED' then
    v_kind := 'RESERVATION_READY'; v_title := 'Reserva separada';
  elsif new.status = 'REJECTED' then
    v_kind := 'RESERVATION_REJECTED'; v_title := 'Reserva não aceita';
  else
    return new;
  end if;

  select count(*) into v_items
    from product_reservation_item where reservation_id = new.id;

  v_body := case v_kind
    when 'RESERVATION_READY' then
      case when v_items = 1
        then 'Seu item está separado e esperando por você na loja.'
        else 'Seus ' || v_items || ' itens estão separados e esperando por você na loja.'
      end
    else
      'O petshop não pôde atender sua reserva.'
        || coalesce(' Motivo: ' || new.rejection_reason, '')
  end;

  perform create_notification(
    new.tenant_id,
    v_kind,
    v_title,
    v_body,
    '/produtos',
    jsonb_build_object('reservation_id', new.id, 'item_count', v_items),
    v_profile
  );
  return new;
end $$;

drop trigger if exists notify_tutor_reservation on product_reservation;
create trigger notify_tutor_reservation
  after update on product_reservation
  for each row execute function notify_tutor_reservation();

notify pgrst, 'reload schema';
