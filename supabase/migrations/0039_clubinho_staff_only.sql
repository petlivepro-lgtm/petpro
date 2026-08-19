-- =====================================================================
-- Só o petshop altera o Clubinho do tutor.
--
-- A policy tutor_self_update (0001) deixa o tutor atualizar a própria
-- linha sem restringir colunas — foi escrita quando tudo em `tutor` era
-- dado de contato que ele mesmo mantém. Com o Clubinho (0038) isso muda
-- de figura: é um flag comercial, e a partir do momento em que o app do
-- tutor passa a exibi-lo como selo, ele vira algo que o tutor tem motivo
-- para querer ligar sozinho. E conseguiria: bastaria um PATCH direto no
-- PostgREST com o token dele — a tela de perfil do MyLivePet não expõe o
-- campo, mas a API não depende da tela.
--
-- Em vez de reescrever a policy (que precisaria enumerar colunas e
-- voltaria a quebrar a cada coluna nova), um trigger guarda só a
-- transição do flag. Quem não é staff continua editando nome, e-mail e
-- telefone como sempre; só não muda o Clubinho.
-- =====================================================================

create or replace function tutor_clubinho_staff_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() nulo = service_role / rotina interna (seed, backfill),
  -- que roda fora de qualquer sessão e segue liberada.
  if new.clubinho is distinct from old.clubinho
     and auth.uid() is not null
     and not is_staff(new.tenant_id) then
    raise exception 'Só o petshop pode alterar o Clubinho do tutor';
  end if;
  return new;
end;
$$;

drop trigger if exists tutor_clubinho_staff_only on tutor;

create trigger tutor_clubinho_staff_only
  before update on tutor
  for each row execute function tutor_clubinho_staff_only();
