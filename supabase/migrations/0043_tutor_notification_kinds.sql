-- =====================================================================
-- Tipos de notificação do tutor.
--
-- Arquivo separado: o Postgres não deixa usar valor de enum recém-adicionado
-- na mesma transação que o criou, e a 0044 usa todos eles (mesma razão da
-- 0022 e da 0041).
-- =====================================================================

alter type notification_kind add value if not exists 'BOOKING_CONFIRMED';
alter type notification_kind add value if not exists 'BOOKING_REJECTED';
alter type notification_kind add value if not exists 'BOOKING_COMPLETED';
alter type notification_kind add value if not exists 'RESERVATION_READY';
alter type notification_kind add value if not exists 'RESERVATION_REJECTED';
