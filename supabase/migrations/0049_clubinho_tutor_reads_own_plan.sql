-- =====================================================================
-- O tutor precisa enxergar o plano que ele assina, ativo ou não.
--
-- A policy de 0047 liberava só os planos ativos, pensando na vitrine. Mas
-- clubinho_subscription_view é security_invoker e faz join com
-- clubinho_plan: no dia em que o petshop tira um plano de venda, a linha
-- inteira sumiria do app de quem já assina — o tutor perderia o saldo de
-- vista sem ter perdido o pacote.
--
-- Ler o catálogo do próprio petshop não é dado sensível (o preço já é
-- anunciado no balcão), então a policy passa a cobrir todos os planos do
-- tenant. Quem quiser só a vitrine filtra por `active` na consulta.
-- =====================================================================

drop policy if exists clubinho_plan_tutor_read on clubinho_plan;

create policy clubinho_plan_tutor_read on clubinho_plan for select
  using (my_tutor_id(tenant_id) is not null);

notify pgrst, 'reload schema';
