-- =====================================================================
-- Auto-ativação de acesso do tutor (primeiro acesso pelo próprio tutor).
--   O cadastro no Pet Pro não gera mais senha. O tutor ativa o login no
--   app confirmando a posse do e-mail (OTP) e definindo a própria senha.
--
-- Duas funções SECURITY DEFINER (rodam como owner => ignoram RLS) cobrem
-- os dois passos que o client do app do tutor não consegue fazer sozinho:
--   1. tutor_access_status: descobrir, sem login, se um e-mail já é tutor
--      cadastrado e se já tem conta de auth (sem expor dados).
--   2. claim_tutor_access: depois do OTP, vincular a(s) ficha(s) de tutor
--      ao auth.uid() recém-criado e garantir a linha em profile.
-- =====================================================================

-- Estado de acesso de um e-mail. Não expõe dados — só um rótulo.
--   'not_found'    => nenhum tutor cadastrado com esse e-mail
--   'existing'     => há tutor e já existe conta de auth (login por senha)
--   'first_access' => há tutor e ainda não existe conta de auth (ativar)
create or replace function tutor_access_status(p_email text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_is_tutor boolean;
  v_has_auth boolean;
begin
  if v_email = '' or v_email is null then
    return 'not_found';
  end if;

  select exists (select 1 from public.tutor where lower(email) = v_email) into v_is_tutor;
  if not v_is_tutor then
    return 'not_found';
  end if;

  select exists (select 1 from auth.users where lower(email) = v_email) into v_has_auth;
  if v_has_auth then
    return 'existing';
  end if;

  return 'first_access';
end;
$$;

grant execute on function tutor_access_status(text) to anon, authenticated;

-- Vincula o usuário recém-autenticado (via OTP) à(s) ficha(s) de tutor que
-- têm o mesmo e-mail e ainda não têm login. Idempotente e seguro: só age
-- sobre fichas cujo e-mail bate com o e-mail COMPROVADO do chamador.
create or replace function claim_tutor_access()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is null then
    return;
  end if;

  -- nome a partir da ficha de tutor (fallback para metadados do auth)
  select full_name into v_name
    from public.tutor
   where lower(email) = v_email
   order by created_at
   limit 1;

  insert into public.profile (id, full_name)
  values (v_uid, coalesce(v_name, ''))
  on conflict (id) do nothing;

  update public.tutor
     set profile_id = v_uid
   where lower(email) = v_email
     and profile_id is null;
end;
$$;

grant execute on function claim_tutor_access() to authenticated;
