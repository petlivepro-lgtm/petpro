-- =====================================================================
-- Leva-e-traz em etapas: os valores de enum, e só eles.
--
-- Migration isolada pelo mesmo motivo da 0061: o Postgres não permite *usar*
-- um valor de enum na mesma transação em que ele é criado. A estrutura que
-- compara com estes valores vem na 0067.
-- =====================================================================

-- A busca ganha uma etapa no meio. Antes, "Peguei o pet" já encerrava a
-- parada, e ninguém confirmava que o pet CHEGOU ao petshop. Agora:
--   PENDING → EN_ROUTE → PICKED_UP (pet no veículo) → DONE (deixado no petshop)
-- A devolução não usa PICKED_UP: ela já sai do petshop com o pet.
alter type delivery_stop_status add value if not exists 'PICKED_UP' after 'EN_ROUTE';

-- PICKUP_DONE passa a ser "foi buscado" (disparado no PICKED_UP) e este é o
-- aviso novo de "chegou ao petshop".
alter type notification_kind add value if not exists 'PICKUP_ARRIVED';

-- Para o entregador: o banho terminou, o pet pode voltar para casa.
alter type notification_kind add value if not exists 'DROPOFF_READY';

-- O ícone do entregador no mapa (dele e do tutor).
do $$ begin
  create type delivery_vehicle as enum ('MOTORCYCLE', 'BICYCLE', 'CAR');
exception when duplicate_object then null;
end $$;
