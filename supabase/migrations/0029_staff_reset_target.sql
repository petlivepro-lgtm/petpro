-- =====================================================================
-- Recuperação de senha no painel do petshop (Pet Pro).
--
-- A Server Action precisa saber, antes de disparar o magic link, se o
-- e-mail digitado pertence mesmo a uma conta do painel. Só auth.users
-- guarda e-mail (public.profile não tem a coluna), então isso exige uma
-- função SECURITY DEFINER — mesmo papel que tutor_login_target (0028)
-- cumpre no app do tutor.
--
-- A checagem de membership é o que impede mandar link do painel para uma
-- conta de tutor, espelhando a trava inversa de tutor_first_access_target
-- (0019), que recusa ativar acesso de tutor para conta de staff.
-- =====================================================================

-- Estado de um e-mail para fins de redefinição de senha no painel.
--   { status: 'staff',     email }  => existe conta de auth E ela tem membership
--   { status: 'not_found'          }  => não existe conta, ou existe mas não é staff
--
-- Nunca exposta a anon/authenticated: devolver "existe/não existe" a
-- qualquer um permitiria enumerar as contas do painel.
create or replace function staff_reset_target(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user_id uuid;
begin
  if v_email = '' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select id into v_user_id
    from auth.users
   where lower(email) = v_email
   limit 1;

  if v_user_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if not exists (select 1 from public.membership where profile_id = v_user_id) then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object('status', 'staff', 'email', v_email);
end;
$$;

revoke all on function staff_reset_target(text) from public, anon, authenticated;
grant execute on function staff_reset_target(text) to service_role;
