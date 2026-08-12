-- =====================================================================
-- Primeiro acesso do colaborador ao painel.
--
-- O admin só cadastra o e-mail (collaborator.access_email); a conta de auth
-- nasce quando o colaborador entra pela primeira vez e escolhe a senha —
-- mesmo desenho do primeiro acesso do tutor (0028).
--
-- Só auth.users guarda e-mail (public.profile não tem a coluna), então
-- resolver "este e-mail já tem conta?" exige SECURITY DEFINER. As duas
-- funções são service_role only e chamadas apenas de Server Action: expor
-- "existe/não existe" a anon permitiria enumerar as contas do painel.
-- =====================================================================

-- Estado de um e-mail na tela de login do painel:
--   { status: 'existing'     }                  => conta com membership; peça a senha
--   { status: 'first_access', ... }             => convite pendente; deixe criar a senha
--   { status: 'not_found'    }                  => nada a fazer
--
-- user_id vem sempre preenchido quando o e-mail já tem conta no projeto,
-- inclusive em not_found e first_access (o colaborador também é tutor, por
-- exemplo). Serve a dois consumidores:
--   * a ativação recusa first_access com user_id — sobrescrever a senha de
--     uma conta existente a partir de um e-mail que o admin digitou seria
--     tomada de conta;
--   * o cadastro do e-mail de acesso recusa e-mail já usado, barrando isso
--     antes mesmo do convite.
create or replace function staff_access_target(p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email   text := lower(trim(coalesce(p_email, '')));
  v_user_id uuid;
  v_collab  record;
begin
  if v_email = '' then
    return jsonb_build_object('status', 'not_found');
  end if;

  select id into v_user_id
    from auth.users
   where lower(email) = v_email
   limit 1;

  if v_user_id is not null
     and exists (select 1 from public.membership where profile_id = v_user_id) then
    return jsonb_build_object('status', 'existing', 'user_id', v_user_id);
  end if;

  select c.id, c.tenant_id, c.full_name
    into v_collab
    from public.collaborator c
   where lower(c.access_email) = v_email
     and c.profile_id is null
     and c.active
   limit 1;

  if v_collab.id is not null then
    return jsonb_build_object(
      'status',          'first_access',
      'collaborator_id', v_collab.id,
      'tenant_id',       v_collab.tenant_id,
      'full_name',       v_collab.full_name,
      'user_id',         v_user_id
    );
  end if;

  return jsonb_build_object('status', 'not_found', 'user_id', v_user_id);
end;
$$;

revoke all on function staff_access_target(text) from public, anon, authenticated;
grant execute on function staff_access_target(text) to service_role;

-- Vincula a conta recém-criada ao cadastro do colaborador, numa transação
-- só (molde de link_tutor_access_by, 0028). Idempotente: reexecutar não
-- duplica membership nem rouba um vínculo já feito.
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
  -- profile_id is null = convite ainda não usado; = p_user_id = já é dele, e
  -- reexecutar vira no-op. Qualquer outro dono barra: o vínculo de um
  -- colaborador não pode ser tomado por outra conta.
  select c.id, c.tenant_id, c.full_name
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
  values (v_collab.tenant_id, p_user_id, 'COLLABORATOR')
  on conflict (tenant_id, profile_id) do nothing;
end;
$$;

revoke all on function link_collaborator_access(uuid, text) from public, anon, authenticated;
grant execute on function link_collaborator_access(uuid, text) to service_role;
