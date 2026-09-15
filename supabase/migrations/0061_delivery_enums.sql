-- =====================================================================
-- Entregador (leva-e-traz): os valores de enum, e só eles.
--
-- Migration isolada pelo mesmo motivo da 0030, 0041 e 0043: o Postgres não
-- permite *usar* um valor de enum na mesma transação em que ele é criado, e
-- cada arquivo daqui é aplicado como uma transação. Toda a estrutura que
-- compara com 'DELIVERY' vem na 0062.
--
-- DELIVERY é irmão de COLLABORATOR, não um papel de gestão: quem tem esse
-- papel busca e devolve o pet na casa do tutor, e nada mais. A 0062 é quem
-- tira os dois de is_staff() — sem aquilo, este valor novo entraria como
-- staff pleno em ~40 policies.
-- =====================================================================

alter type staff_role add value if not exists 'DELIVERY';

-- Avisos do leva-e-traz para o tutor (0063). PICKUP é a ida até a casa dele,
-- DROPOFF é a volta; STARTED é "o entregador saiu", DONE é "chegou".
alter type notification_kind add value if not exists 'PICKUP_STARTED';
alter type notification_kind add value if not exists 'PICKUP_DONE';
alter type notification_kind add value if not exists 'DROPOFF_STARTED';
alter type notification_kind add value if not exists 'DROPOFF_DONE';

-- Aviso para o próprio entregador: a rota do dia foi montada/atribuída.
alter type notification_kind add value if not exists 'ROUTE_ASSIGNED';
