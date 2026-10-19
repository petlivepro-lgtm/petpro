-- Sugestões da Busca de identidade enquanto o admin digita.
--
-- Procura por nome ou por parte do e-mail em contas de acesso e em fichas de
-- tutor, e devolve o e-mail já MASCARADO: o e-mail inteiro nunca sai daqui.
-- A escolha volta como id (conta ou ficha) e o admin-web resolve o e-mail no
-- servidor, então ele também não passa pela URL nem pelo navegador.

create or replace function admin_identity_suggest(p_search text, p_limit integer default 8)
returns jsonb
language sql stable security definer set search_path = public as $$
  with term as (
    select lower(btrim(coalesce(p_search, ''))) as t
  ), candidates as (
    select 'conta' as kind, u.id, lower(u.email) as email,
           coalesce(nullif(btrim(pr.full_name), ''), nullif(btrim(u.raw_user_meta_data->>'full_name'), '')) as name,
           u.last_sign_in_at as recent
      from auth.users u left join profile pr on pr.id = u.id
     where u.email is not null
    union all
    select 'ficha', tu.id, lower(tu.email), tu.full_name, tu.created_at
      from tutor tu
     where tu.email is not null and tu.profile_id is null
  ), matched as (
    select distinct on (c.email) c.*
      from candidates c, term
     where length(term.t) >= 2
       and (strpos(c.email, term.t) > 0 or strpos(lower(coalesce(c.name, '')), term.t) > 0)
     order by c.email, (c.kind = 'conta') desc, c.recent desc nulls last
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', m.kind,
           'id', m.id,
           'name', m.name,
           'email', mask_email(m.email),
           'staff', exists (select 1 from membership mb where mb.profile_id = m.id),
           'tutor', m.kind = 'ficha' or exists (select 1 from tutor tu where tu.profile_id = m.id),
           'admin', exists (select 1 from platform_admin a where a.user_id = m.id))
         order by m.recent desc nulls last), '[]'::jsonb)
    from (select * from matched order by recent desc nulls last
           limit greatest(1, least(coalesce(p_limit, 8), 10))) m;
$$;

revoke execute on function admin_identity_suggest(text, integer) from public, anon, authenticated;
grant execute on function admin_identity_suggest(text, integer) to service_role;
