-- collaborator_pet e delivery_stop_card passam a SECURITY INVOKER.
--
-- As duas nasceram SECURITY DEFINER (0031, 0062) só por causa do tutor: o
-- colaborador e o entregador não têm policy em `tutor` (a linha inteira traria
-- CPF, e-mail, histórico). Todo o resto que elas juntam — pet, appointment,
-- delivery_stop, delivery_route, service_type — eles já leem pela própria RLS,
-- com as mesmas condições do WHERE das views.
--
-- Então a view roda com a RLS de quem consulta, e só o pedaço do tutor sai de
-- uma função SECURITY DEFINER que refaz a checagem por conta própria. As
-- funções ficam no schema `private`, que a API (PostgREST) não expõe: não dá
-- para chamá-las por /rpc, só através das views. O Security Advisor deixa de
-- acusar "Security Definer View".
--
-- Colunas, nomes e tipos são os mesmos (create or replace exige), e o pro-web
-- não muda. Os grants das views (só select para authenticated, 0077) ficam.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- Nome do tutor do pet, para o colaborador que atende o pet. Fora isso, null.
create or replace function private.collab_pet_tutor_name(_pet uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select t.full_name
    from pet p
    join tutor t on t.id = p.tutor_id
   where p.id = _pet
     and collab_sees_pet(p.tenant_id, p.id);
$$;

-- Nome e telefone do tutor da parada, para o entregador da rota. Fora isso,
-- nenhuma linha.
create or replace function private.delivery_stop_tutor(_stop uuid)
returns table (full_name text, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select t.full_name, t.phone
    from delivery_stop s
    join delivery_route r on r.id = s.route_id
    join appointment a on a.id = s.appointment_id
    join tutor t on t.id = a.tutor_id
   where s.id = _stop
     and r.collaborator_id = my_collaborator_id(s.tenant_id);
$$;

revoke all on function private.collab_pet_tutor_name(uuid) from public;
revoke all on function private.delivery_stop_tutor(uuid) from public;
grant execute on function private.collab_pet_tutor_name(uuid) to authenticated, service_role;
grant execute on function private.delivery_stop_tutor(uuid) to authenticated, service_role;

create or replace view collaborator_pet
with (security_invoker = true)
as
select
  p.id,
  p.tenant_id,
  p.tutor_id,
  p.name,
  p.species,
  p.breed,
  p.size,
  p.birth_date,
  p.photo_path,
  p.notes,
  p.created_at,
  private.collab_pet_tutor_name(p.id) as tutor_name
from pet p
where collab_sees_pet(p.tenant_id, p.id);

create or replace view delivery_stop_card
with (security_invoker = true)
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
  a.tutor_id,
  tc.full_name as tutor_name,
  tc.phone     as tutor_phone,
  st.name  as service_name
from delivery_stop s
join delivery_route r on r.id = s.route_id
join appointment a on a.id = s.appointment_id
join pet p on p.id = a.pet_id
left join lateral private.delivery_stop_tutor(s.id) tc on true
left join service_type st on st.id = a.service_type_id
where r.collaborator_id = my_collaborator_id(s.tenant_id);
