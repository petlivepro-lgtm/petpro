-- =====================================================================
-- Quem pode excluir um pet, e quando.
--
-- Apagar um pet leva junto, em cascata, tudo que se apoia nele:
-- atendimentos (e com eles o checklist, as fotos, os boletins de
-- comportamento e as sessões de câmera) e a assinatura do Clubinho com os
-- ciclos e o saldo. O financeiro sobrevive — finance_entry solta o
-- vínculo em vez de sumir (on delete set null) —, então o caixa continua
-- fechando; o que se perde é o histórico de atendimento.
--
-- A policy pet_tutor_write (0001) é `for all`, escrita quando a única
-- coisa que o tutor fazia era cadastrar e corrigir os próprios pets. Com
-- um botão de excluir no app dele, esse `all` passa a significar que o
-- cliente pode apagar o boletim que o petshop escreveu e o registro dos
-- banhos que ele pagou. Não é o que ninguém quer dizer com "remover um
-- pet cadastrado por engano".
--
-- Então a regra vira trigger, e não texto de tela:
--   - pet em atendimento (CHECKED_IN/IN_PROGRESS) não se exclui, por
--     ninguém: ele está fisicamente na loja agora;
--   - o tutor exclui só pet sem histórico e sem Clubinho aberto;
--   - o petshop exclui o resto, avisado do que vai junto.
-- =====================================================================

create or replace function pet_delete_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total    integer;
  v_open     integer;
  v_clubinho integer;
begin
  -- auth.uid() nulo = service_role / rotina interna (exclusão de tenant,
  -- seed, backfill), que roda fora de qualquer sessão e segue liberada.
  if auth.uid() is null then
    return old;
  end if;

  select
    count(*),
    count(*) filter (where status in ('CHECKED_IN', 'IN_PROGRESS'))
  into v_total, v_open
  from appointment
  where pet_id = old.id;

  if v_open > 0 then
    raise exception
      'O pet está em atendimento agora — conclua ou cancele antes de excluir';
  end if;

  if is_staff(old.tenant_id) then
    return old;
  end if;

  if v_total > 0 then
    raise exception
      'Este pet já tem atendimento registrado no petshop. Peça a exclusão a quem atende.';
  end if;

  select count(*)
  into v_clubinho
  from clubinho_subscription
  where pet_id = old.id and status in ('ACTIVE', 'PAUSED');

  if v_clubinho > 0 then
    raise exception
      'Este pet tem assinatura do Clubinho. Cancele com o petshop antes de excluir.';
  end if;

  return old;
end;
$$;

drop trigger if exists pet_delete_guard on pet;

create trigger pet_delete_guard
  before delete on pet
  for each row execute function pet_delete_guard();

notify pgrst, 'reload schema';
