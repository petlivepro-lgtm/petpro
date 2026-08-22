-- =====================================================================
-- Busca global do painel (a paleta de comandos, Ctrl+K).
--
-- Uma função só, e não seis consultas do cliente: a paleta busca a cada
-- tecla, e seis viagens por tecla é o que transforma uma busca boa numa
-- lista que sempre chega tarde.
--
-- SECURITY INVOKER de propósito. É a RLS de cada tabela que decide o que
-- entra no resultado — o colaborador não tem policy de select em `tutor`,
-- então tutor simplesmente não aparece para ele, sem nenhum `if` aqui que
-- alguém possa esquecer de atualizar quando um papel novo surgir.
-- =====================================================================

-- Acento não pode atrapalhar quem digita com pressa: "jose" acha "José".
-- translate() em vez da extensão unaccent porque o painel é pt-BR e uma
-- tabela de 26 letras não justifica uma dependência de extensão.
create or replace function search_norm(p_text text)
returns text
language sql
immutable
as $$
  select translate(
    lower(coalesce(p_text, '')),
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn'
  );
$$;

comment on function search_norm(text) is
  'Minúsculas e sem acento, para comparação de busca.';

-- O retorno mudou de forma no desenvolvimento; replace não recria colunas.
drop function if exists global_search(uuid, text, int);

create or replace function global_search(
  p_tenant uuid,
  p_query  text,
  p_limit  int default 5
)
returns table (
  kind     text,
  id       uuid,
  title    text,
  subtitle text,
  extra    text,
  -- Preço em centavos quando o tipo tem um; a formatação em reais fica com o
  -- cliente, que já tem formatBRL e é quem precisa ficar igual ao resto da tela.
  amount_cents int,
  rank     int
)
language sql
stable
security invoker
set search_path = public
as $$
with q as (
  select
    search_norm(btrim(coalesce(p_query, '')))            as term,
    -- Telefone e CPF são procurados por dígito: quem digita "(11) 99999"
    -- e quem digita "1199999" está procurando a mesma pessoa.
    regexp_replace(coalesce(p_query, ''), '\D', '', 'g') as digits
  where length(search_norm(btrim(coalesce(p_query, '')))) >= 2
),
pets as (
  select
    'pet'::text as kind, p.id, p.name as title,
    nullif(concat_ws(' · ', p.breed, t.full_name), '') as subtitle,
    null::text as extra,
    null::int as amount_cents,
    -- Quem começa com o termo vem antes de quem só o contém no meio.
    case when search_norm(p.name) like q.term || '%' then 0 else 1 end as rank
  from pet p
  cross join q
  left join tutor t on t.id = p.tutor_id
  where p.tenant_id = p_tenant
    and (search_norm(p.name) like '%' || q.term || '%'
      or search_norm(coalesce(p.breed, '')) like '%' || q.term || '%')
  order by 7, p.name
  limit p_limit
),
tutors as (
  select
    'tutor'::text, t.id, t.full_name,
    nullif(concat_ws(' · ', t.phone, t.email), ''),
    null::text,
    null::int,
    case when search_norm(t.full_name) like q.term || '%' then 0 else 1 end
  from tutor t
  cross join q
  where t.tenant_id = p_tenant
    and (search_norm(t.full_name) like '%' || q.term || '%'
      or search_norm(coalesce(t.email, '')) like '%' || q.term || '%'
      or (length(q.digits) >= 3
          and (coalesce(t.phone_digits, '') like '%' || q.digits || '%'
            or coalesce(t.cpf, '') like '%' || q.digits || '%')))
  order by 7, t.full_name
  limit p_limit
),
appointments as (
  select
    'appointment'::text, a.id,
    concat_ws(' · ', p.name, s.name),
    concat_ws(' · ', br_datetime(a.scheduled_at), t.full_name),
    a.status::text,
    null::int,
    case when search_norm(coalesce(p.name, '')) like q.term || '%' then 0 else 1 end
  from appointment a
  cross join q
  left join pet p          on p.id = a.pet_id
  left join service_type s on s.id = a.service_type_id
  left join tutor t        on t.id = a.tutor_id
  where a.tenant_id = p_tenant
    and (search_norm(coalesce(p.name, '')) like '%' || q.term || '%'
      or search_norm(coalesce(s.name, '')) like '%' || q.term || '%'
      or search_norm(coalesce(t.full_name, '')) like '%' || q.term || '%'
      -- "29/07" também acha o dia, que é como se procura um atendimento
      -- quando não se lembra do pet.
      or to_char(a.scheduled_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')
         like '%' || btrim(coalesce(p_query, '')) || '%')
  -- Perto de hoje primeiro, para os dois lados: quem procura "marley" quer o
  -- banho de amanhã ou o de ontem, não o de oito meses atrás.
  order by 7, abs(extract(epoch from (a.scheduled_at - now())))
  limit p_limit
),
collaborators as (
  select
    'collaborator'::text, c.id, c.full_name,
    nullif(concat_ws(' · ', c.role_title, c.access_email), ''),
    case when c.active then null else 'inativo' end,
    null::int,
    case when search_norm(c.full_name) like q.term || '%' then 0 else 1 end
  from collaborator c
  cross join q
  where c.tenant_id = p_tenant
    and (search_norm(c.full_name) like '%' || q.term || '%'
      or search_norm(coalesce(c.role_title, '')) like '%' || q.term || '%')
  order by 7, c.full_name
  limit p_limit
),
services as (
  select
    'service'::text, s.id, s.name,
    nullif(s.duration_min || ' min', ''),
    case when s.active then null else 'inativo' end,
    s.price_cents,
    case when search_norm(s.name) like q.term || '%' then 0 else 1 end
  from service_type s
  cross join q
  where s.tenant_id = p_tenant
    and (search_norm(s.name) like '%' || q.term || '%'
      or search_norm(coalesce(s.description, '')) like '%' || q.term || '%')
  order by 7, s.name
  limit p_limit
),
products as (
  select
    'product'::text, pr.id, pr.name,
    pr.category,
    pr.stock || ' em estoque',
    pr.price_cents,
    case when search_norm(pr.name) like q.term || '%' then 0 else 1 end
  from product pr
  cross join q
  where pr.tenant_id = p_tenant
    and (search_norm(pr.name) like '%' || q.term || '%'
      or search_norm(coalesce(pr.category, '')) like '%' || q.term || '%')
  order by 7, pr.name
  limit p_limit
)
select * from appointments
union all select * from pets
union all select * from tutors
union all select * from collaborators
union all select * from services
union all select * from products;
$$;

comment on function global_search(uuid, text, int) is
  'Busca da paleta de comandos: atendimentos, pets, tutores, colaboradores, serviços e produtos que a RLS deixa o usuário ver.';

grant execute on function search_norm(text) to authenticated;
grant execute on function global_search(uuid, text, int) to authenticated;
