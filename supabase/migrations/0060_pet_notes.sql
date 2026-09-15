-- =====================================================================
-- A observação é do pet, não do tutor.
--
-- `tutor.notes` existe desde 0001, mas o cadastro do pet nunca teve um
-- campo equivalente no formulário de criação — então quem atende escrevia
-- no tutor o que era do pet. Das oito observações gravadas em produção,
-- sete eram instrução de banho e tosa ("deixar o rosto mais baixinho",
-- "não pode perfume", "secar apenas com secador"): pertencem ao animal
-- que vai para a mesa, e é na ficha dele que precisam aparecer.
--
-- Pior: a observação do tutor também é editável pelo próprio cliente no
-- app MyLivePet. Uma instrução de tosa não deveria morar num campo que o
-- cliente edita achando que é o "sobre mim" dele.
--
-- Esta migração move o conteúdo para os pets e derruba a coluna. Depois
-- dela, observação de cliente (agenda apertada, preferência de contato)
-- não tem mais onde ser escrita — e isso é deliberado: o campo genérico
-- era justamente o que fazia todo mundo escrever no lugar errado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Move a observação de cada tutor para o(s) pet(s) dele.
--
-- Quando o texto cita o nome de um pet ("O simba tem problema de pele"),
-- vai só para esse — é a única forma de acertar o alvo em tutor com mais
-- de um pet. Sem citação, vai para todos os pets do tutor (que hoje é
-- sempre um só): duplicar é recuperável, perder não.
--
-- Nomes com menos de três letras não entram no casamento por nome, para
-- um pet chamado "Bo" não sequestrar a nota por causa de um "bom" no
-- meio da frase.
--
-- O `case` preserva o que o pet já tiver escrito: hoje nenhum dos 65 tem
-- observação, mas a migração não pode depender disso.
-- ---------------------------------------------------------------------
with origem as (
  select t.id as tutor_id, btrim(t.notes) as nota
  from tutor t
  where t.notes is not null and btrim(t.notes) <> ''
),
com_match as (
  select o.tutor_id, o.nota, p.id as pet_id
  from origem o
  join pet p on p.tutor_id = o.tutor_id
  where length(p.name) >= 3
    and position(lower(p.name) in lower(o.nota)) > 0
),
sem_match as (
  select o.tutor_id, o.nota, p.id as pet_id
  from origem o
  join pet p on p.tutor_id = o.tutor_id
  where not exists (select 1 from com_match c where c.tutor_id = o.tutor_id)
),
destino as (
  select * from com_match
  union all
  select * from sem_match
)
update pet
set notes = case
  when pet.notes is null or btrim(pet.notes) = '' then d.nota
  else pet.notes || E'\n' || d.nota
end
from destino d
where pet.id = d.pet_id;

-- ---------------------------------------------------------------------
-- 2) Derruba a coluna. Nenhuma view depende dela: collaborator_pet (0031)
-- e clubinho_subscription_view (0047) citam `notes`, mas a do pet e a da
-- assinatura.
-- ---------------------------------------------------------------------
alter table tutor drop column notes;
