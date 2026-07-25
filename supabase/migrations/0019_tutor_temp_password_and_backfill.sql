-- =====================================================================
-- Fecha dois buracos deixados pelo fluxo antigo de cadastro de tutor.
--
-- (a) SENHA TEMPORÁRIA. Antes, o Pet Pro criava a conta de auth do tutor
--     com uma senha aleatória e marcava user_metadata.must_reset_password.
--     O tutor nunca soube essa senha, mas a conta EXISTE COM senha — então
--     tutor_access_status devolvia 'existing' e ele caía direto na tela de
--     login, sem nenhuma forma de criar a própria senha. Agora uma conta
--     com must_reset_password = true conta como primeiro acesso.
--
-- (b) FICHAS ÓRFÃS. Tutores com conta de auth criada mas tutor.profile_id
--     nulo: o login funciona, o middleware não acha a ficha e desloga com
--     "Você não tem permissão para acessar". Backfill no fim do arquivo.
-- =====================================================================

-- Uma conta só conta como "já tem senha" se tiver senha E ela não for a
-- temporária do fluxo antigo.
create or replace function tutor_has_usable_password(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users u
     where lower(u.email) = lower(trim(coalesce(p_email, '')))
       and coalesce(u.encrypted_password, '') <> ''
       and coalesce(u.raw_user_meta_data ->> 'must_reset_password', 'false') <> 'true'
  );
$$;

revoke all on function tutor_has_usable_password(text) from public, anon, authenticated;

-- Estado de acesso de um e-mail. Não expõe dados — só um rótulo.
--   'not_found'    => nenhum tutor cadastrado com esse e-mail
--   'existing'     => há tutor e a conta tem senha escolhida pelo próprio tutor
--   'first_access' => há tutor e ainda não há senha própria (nenhuma conta,
--                     conta sem senha, ou conta com senha temporária)
create or replace function tutor_access_status(p_email text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if v_email = '' then
    return 'not_found';
  end if;

  if not exists (select 1 from public.tutor where lower(email) = v_email) then
    return 'not_found';
  end if;

  return case
    when public.tutor_has_usable_password(v_email) then 'existing'
    else 'first_access'
  end;
end;
$$;

grant execute on function tutor_access_status(text) to anon, authenticated;

-- Versão interna, com os dados que a Server Action precisa para criar ou
-- atualizar a conta de auth. Nunca exposta a anon/authenticated.
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

  select id into v_user_id
    from auth.users
   where lower(email) = v_email
   limit 1;

  -- Conta de staff nunca é ativada por aqui (staff já nasce com senha; isto é
  -- só a trava para o caso residual de uma conta de staff sem senha própria).
  if v_user_id is not null
     and exists (select 1 from public.membership where profile_id = v_user_id) then
    return jsonb_build_object('status', 'existing', 'user_id', v_user_id);
  end if;

  return jsonb_build_object(
    'status', case when public.tutor_has_usable_password(v_email) then 'existing'
                   else 'first_access' end,
    'user_id', v_user_id,
    'full_name', coalesce(v_name, '')
  );
end;
$$;

revoke all on function tutor_first_access_target(text) from public, anon, authenticated;
grant execute on function tutor_first_access_target(text) to service_role;

-- ---------------------------------------------------------------------
-- (b) Backfill das fichas órfãs.
-- Só toca em fichas sem profile_id cujo e-mail bate com uma conta de auth
-- que NÃO é staff — a conta de staff é bloqueada no app do tutor de propósito,
-- vincular a ficha a ela não destravaria nada e misturaria as identidades.
-- ---------------------------------------------------------------------
insert into public.profile (id, full_name)
select distinct on (u.id) u.id, coalesce(t.full_name, '')
  from public.tutor t
  join auth.users u on lower(u.email) = lower(t.email)
 where t.profile_id is null
   and coalesce(t.email, '') <> ''
   and not exists (select 1 from public.membership m where m.profile_id = u.id)
 order by u.id, t.created_at
on conflict (id) do nothing;

update public.tutor t
   set profile_id = u.id
  from auth.users u
 where t.profile_id is null
   and coalesce(t.email, '') <> ''
   and lower(u.email) = lower(t.email)
   and not exists (select 1 from public.membership m where m.profile_id = u.id);
