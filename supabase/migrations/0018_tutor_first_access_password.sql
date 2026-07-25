-- =====================================================================
-- Primeiro acesso do tutor definindo a senha DENTRO do app (sem e-mail).
--
-- Antes: o tutor recebia um link mágico por e-mail e só então criava a
-- senha em /criar-senha. Agora o app detecta o primeiro acesso e abre o
-- formulário de senha na hora; a Server Action cria a conta de auth com
-- a senha escolhida usando o service role.
--
-- Três funções SECURITY DEFINER (rodam como owner => ignoram RLS):
--   1. tutor_access_status  : rótulo público (anon) para o app decidir a tela.
--   2. tutor_first_access_target : dados internos p/ a Server Action (service_role).
--   3. link_tutor_access    : vincula a(s) ficha(s) de tutor ao usuário criado.
--
-- Observação: quem souber o e-mail de um tutor cadastrado consegue definir
-- a senha da conta dele. É a escolha de produto (cadastro só existe se o
-- petshop criou a ficha) — se um dia precisar endurecer, reintroduzir o
-- OTP entre o passo do e-mail e o formulário de senha.
-- =====================================================================

-- Estado de acesso de um e-mail. Não expõe dados — só um rótulo.
--   'not_found'    => nenhum tutor cadastrado com esse e-mail
--   'existing'     => há tutor, já existe conta de auth E ela tem senha
--   'first_access' => há tutor e ainda não há conta de auth COM senha
--
-- A diferença para a versão anterior: uma conta criada por link mágico
-- (fluxo antigo) fica sem senha em auth.users. Antes ela era classificada
-- como 'existing' e o tutor caía na tela de senha sem nunca ter criado uma —
-- ficava travado. Agora conta sem senha continua sendo primeiro acesso.
create or replace function tutor_access_status(p_email text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_is_tutor boolean;
  v_has_password boolean;
begin
  if v_email = '' then
    return 'not_found';
  end if;

  select exists (select 1 from public.tutor where lower(email) = v_email) into v_is_tutor;
  if not v_is_tutor then
    return 'not_found';
  end if;

  select exists (
    select 1 from auth.users
     where lower(email) = v_email
       and coalesce(encrypted_password, '') <> ''
  ) into v_has_password;

  return case when v_has_password then 'existing' else 'first_access' end;
end;
$$;

grant execute on function tutor_access_status(text) to anon, authenticated;

-- Versão interna do status, com os dados que a Server Action precisa para
-- criar/atualizar a conta de auth. Nunca exposta a anon/authenticated —
-- devolve o id do usuário e o nome do tutor.
--   { status, user_id, full_name }
create or replace function tutor_first_access_target(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text;
  v_found boolean := false;
  v_user_id uuid;
  v_has_password boolean := false;
begin
  if v_email = '' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select full_name, true into v_name, v_found
    from public.tutor
   where lower(email) = v_email
   order by created_at
   limit 1;

  if not coalesce(v_found, false) then
    return jsonb_build_object('status', 'not_found');
  end if;

  select id, coalesce(encrypted_password, '') <> ''
    into v_user_id, v_has_password
    from auth.users
   where lower(email) = v_email
   limit 1;

  -- Conta de staff nunca é ativada por aqui (staff já nasce com senha; isto é
  -- só a trava para o caso residual de uma conta de staff sem senha).
  if v_user_id is not null
     and exists (select 1 from public.membership where profile_id = v_user_id) then
    return jsonb_build_object('status', 'existing', 'user_id', v_user_id);
  end if;

  return jsonb_build_object(
    'status', case when coalesce(v_has_password, false) then 'existing' else 'first_access' end,
    'user_id', v_user_id,
    'full_name', coalesce(v_name, '')
  );
end;
$$;

revoke all on function tutor_first_access_target(text) from public, anon, authenticated;
grant execute on function tutor_first_access_target(text) to service_role;

-- Vincula um usuário de auth (recém-criado pela Server Action) à(s) ficha(s)
-- de tutor com o mesmo e-mail e garante a linha em profile. Idempotente.
-- Só age sobre fichas que ainda não têm login.
create or replace function link_tutor_access(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_name text;
begin
  if p_user_id is null or v_email = '' then
    return;
  end if;

  select full_name into v_name
    from public.tutor
   where lower(email) = v_email
   order by created_at
   limit 1;

  insert into public.profile (id, full_name)
  values (p_user_id, coalesce(v_name, ''))
  on conflict (id) do nothing;

  update public.tutor
     set profile_id = p_user_id
   where lower(email) = v_email
     and profile_id is null;
end;
$$;

revoke all on function link_tutor_access(uuid, text) from public, anon, authenticated;
grant execute on function link_tutor_access(uuid, text) to service_role;
