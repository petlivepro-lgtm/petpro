-- =====================================================================
-- Login do tutor por TELEFONE, além do e-mail.
--
-- O tutor cadastrado pelo petshop passa a poder entrar no app usando
-- o telefone (DDD + número) no lugar do e-mail. A senha é a mesma: o
-- telefone é só outro jeito de encontrar a ficha e a conta de auth.
--
-- Problema de partida: tutor.phone é texto livre, gravado mascarado
-- ('(11) 91234-5678') pelo PhoneInput e com formatos divergentes no
-- banco ('+55 11 99999-0000' vem do seed). Sem normalização não dá
-- para buscar. A coluna gerada phone_digits resolve isso sem tocar em
-- tutor.phone, que continua servindo à exibição no Pet Pro.
--
-- Funções novas (todas SECURITY DEFINER, espelhando 0018/0019):
--   1. normalize_phone_br            : dígitos, sem DDI 55.
--   2. tutor_user_has_usable_password: versão por user_id da de 0019.
--   3. tutor_login_status            : rótulo público (anon), aceita
--                                      e-mail OU telefone.
--   4. tutor_login_target            : dados internos p/ as Server
--                                      Actions (service_role).
--   5. link_tutor_access_by          : vincula a ficha por e-mail OU
--                                      por telefone.
--
-- As funções de 0018/0019 (tutor_access_status, tutor_first_access_target,
-- link_tutor_access) continuam existindo: o fluxo legado de /criar-senha
-- ainda usa claim_tutor_access e não queremos quebrá-lo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Normalização do telefone
-- ---------------------------------------------------------------------

-- Só os dígitos, descartando o DDI 55 quando ele aparece (12 ou 13
-- dígitos com '55' na frente = DDI + DDD + número). Sem isso, o
-- '+55 11 99999-0000' legado viraria o "DDD 55".
create or replace function normalize_phone_br(p_value text)
returns text
language sql
immutable
as $$
  select case
    when length(d) in (12, 13) and left(d, 2) = '55' then right(d, length(d) - 2)
    else d
  end
  from (select regexp_replace(coalesce(p_value, ''), '\D', '', 'g') as d) s;
$$;

-- Coluna gerada: nada de backfill, todas as fichas existentes já saem
-- normalizadas. tutor.phone continua intocado (é o que as telas mostram).
alter table tutor
  add column phone_digits text
  generated always as (nullif(normalize_phone_br(phone), '')) stored;

create index tutor_phone_digits_idx on tutor (phone_digits);

-- As funções de 0018/0019 fazem lower(email) = ... em seq scan; o índice
-- que faltava desde o início.
create index tutor_email_lower_idx on tutor (lower(email));

-- ---------------------------------------------------------------------
-- 2. Senha usável por user_id
-- ---------------------------------------------------------------------

-- Mesma regra de tutor_has_usable_password (0019), mas partindo do id:
-- quem entra por telefone pode não ter e-mail nenhum na ficha.
create or replace function tutor_user_has_usable_password(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users u
     where u.id = p_user_id
       and coalesce(u.encrypted_password, '') <> ''
       and coalesce(u.raw_user_meta_data ->> 'must_reset_password', 'false') <> 'true'
  );
$$;

revoke all on function tutor_user_has_usable_password(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3./4. Resolução do identificador (e-mail ou telefone)
-- ---------------------------------------------------------------------

-- Núcleo compartilhado pelas duas funções públicas abaixo. Devolve tudo
-- o que se sabe sobre o identificador; quem chama decide o que expõe.
--
--   status : 'not_found' | 'first_access' | 'existing' | 'ambiguous'
--   kind   : 'email' | 'phone'
--
-- 'ambiguous' só acontece por telefone: o mesmo número em fichas com
-- identidades diferentes (logins distintos, ou e-mails distintos). Nesse
-- caso não dá para saber em qual conta entrar — o app manda usar o e-mail.
create or replace function tutor_resolve_identifier(p_identifier text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_raw    text := trim(coalesce(p_identifier, ''));
  v_kind   text;
  v_email  text;
  v_digits text;
  v_name        text;
  v_tutor_email text;
  v_profile_id  uuid;
  v_user_id     uuid;
  v_auth_email  text;
  v_identities  int;
  v_found       boolean := false;
begin
  if v_raw = '' then
    return jsonb_build_object('status', 'not_found', 'kind', 'email');
  end if;

  if position('@' in v_raw) > 0 then
    v_kind := 'email';
    v_email := lower(v_raw);
  else
    v_kind := 'phone';
    v_digits := normalize_phone_br(v_raw);
    -- 10 dígitos (fixo) ou 11 (celular), sempre com DDD.
    if length(coalesce(v_digits, '')) not in (10, 11) then
      return jsonb_build_object('status', 'not_found', 'kind', v_kind);
    end if;
  end if;

  if v_kind = 'email' then
    select full_name, email, profile_id, true
      into v_name, v_tutor_email, v_profile_id, v_found
      from public.tutor
     where lower(email) = v_email
     order by created_at
     limit 1;
  else
    -- Quantas identidades distintas usam este telefone? Fichas do mesmo
    -- tutor em petshops diferentes (mesmo e-mail / mesmo login) contam
    -- como uma só.
    select count(distinct coalesce(profile_id::text, lower(email), '@sem-identidade'))
      into v_identities
      from public.tutor
     where phone_digits = v_digits;

    if coalesce(v_identities, 0) > 1 then
      return jsonb_build_object('status', 'ambiguous', 'kind', v_kind, 'phone_digits', v_digits);
    end if;

    select full_name, email, profile_id, true
      into v_name, v_tutor_email, v_profile_id, v_found
      from public.tutor
     where phone_digits = v_digits
     order by created_at
     limit 1;
  end if;

  if not coalesce(v_found, false) then
    return jsonb_build_object('status', 'not_found', 'kind', v_kind);
  end if;

  -- A conta de auth: pelo vínculo da ficha, ou pelo e-mail dela.
  if v_profile_id is not null then
    select id, email into v_user_id, v_auth_email
      from auth.users where id = v_profile_id;
  elsif coalesce(v_tutor_email, '') <> '' then
    select id, email into v_user_id, v_auth_email
      from auth.users where lower(email) = lower(v_tutor_email) limit 1;
  end if;

  -- Conta de staff nunca é ativada por aqui (mesma trava de 0019).
  if v_user_id is not null
     and exists (select 1 from public.membership where profile_id = v_user_id) then
    return jsonb_build_object('status', 'existing', 'kind', v_kind, 'user_id', v_user_id);
  end if;

  return jsonb_build_object(
    'status', case when v_user_id is not null and public.tutor_user_has_usable_password(v_user_id)
                   then 'existing' else 'first_access' end,
    'kind', v_kind,
    'user_id', v_user_id,
    -- e-mail com que se autentica hoje; null => a Server Action gera um
    -- e-mail interno a partir do telefone.
    'auth_email', coalesce(v_auth_email, nullif(v_tutor_email, '')),
    -- e-mail real da ficha (nunca o interno) — define se dá para mandar
    -- link de "esqueci a senha".
    'tutor_email', nullif(v_tutor_email, ''),
    'full_name', coalesce(v_name, ''),
    'phone_digits', v_digits
  );
end;
$$;

revoke all on function tutor_resolve_identifier(text) from public, anon, authenticated;

-- Rótulo público: o app decide qual tela mostrar. Não expõe nenhum dado.
create or replace function tutor_login_status(p_identifier text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'status', r ->> 'status',
    'kind', r ->> 'kind'
  )
  from (select public.tutor_resolve_identifier(p_identifier) as r) s;
$$;

grant execute on function tutor_login_status(text) to anon, authenticated;

-- Versão interna, com os dados que a Server Action precisa para criar a
-- conta ou resolver o e-mail de login. Nunca exposta a anon/authenticated.
create or replace function tutor_login_target(p_identifier text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.tutor_resolve_identifier(p_identifier);
$$;

revoke all on function tutor_login_target(text) from public, anon, authenticated;
grant execute on function tutor_login_target(text) to service_role;

-- ---------------------------------------------------------------------
-- 5. Vínculo ficha <-> conta de auth, por e-mail OU telefone
-- ---------------------------------------------------------------------

-- Igual a link_tutor_access (0018), mas casando também pelo telefone —
-- ficha sem e-mail só tem esse caminho. Idempotente, só toca fichas que
-- ainda não têm login.
create or replace function link_tutor_access_by(
  p_user_id uuid,
  p_email text,
  p_phone_digits text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_digits text := coalesce(p_phone_digits, '');
  v_name   text;
begin
  if p_user_id is null or (v_email = '' and v_digits = '') then
    return;
  end if;

  select full_name into v_name
    from public.tutor
   where (v_email <> '' and lower(email) = v_email)
      or (v_digits <> '' and phone_digits = v_digits)
   order by created_at
   limit 1;

  insert into public.profile (id, full_name)
  values (p_user_id, coalesce(v_name, ''))
  on conflict (id) do nothing;

  update public.tutor
     set profile_id = p_user_id
   where profile_id is null
     and ( (v_email <> '' and lower(email) = v_email)
        or (v_digits <> '' and phone_digits = v_digits) );
end;
$$;

revoke all on function link_tutor_access_by(uuid, text, text) from public, anon, authenticated;
grant execute on function link_tutor_access_by(uuid, text, text) to service_role;
