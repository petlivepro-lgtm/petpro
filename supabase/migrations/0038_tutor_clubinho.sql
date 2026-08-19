-- =====================================================================
-- Clubinho: marcar quais tutores assinam o pacote de serviços pago.
--
-- Antes, a única forma de registrar isso era escrever no campo livre de
-- observações do tutor — que ninguém lê na correria do balcão. Quem
-- atende precisa da informação num relance, então ela vira um flag
-- próprio, exibido como selo no card da listagem de tutores.
--
-- É de propósito um booleano e nada mais: responde "tem ou não tem".
-- Vigência, valor, qual pacote e consumo do que foi contratado ficam de
-- fora até existir uma regra de negócio que precise deles.
--
-- Sem mexer em RLS: a policy tutor_staff (for all using is_staff) já
-- cobre qualquer coluna nova da tabela.
-- =====================================================================

alter table tutor
  add column if not exists clubinho boolean not null default false;

comment on column tutor.clubinho is
  'Tutor assinante do Clubinho (pacote de serviços pago). Flag simples de sim/não — não controla vigência nem consumo.';

-- PostgREST guarda o schema em cache; sem isso o select da coluna nova
-- falharia até o próximo reload.
notify pgrst, 'reload schema';
