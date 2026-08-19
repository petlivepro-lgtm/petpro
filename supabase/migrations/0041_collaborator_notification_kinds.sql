-- =====================================================================
-- Tipos de notificação do colaborador.
--
-- Arquivo separado de propósito: o Postgres não deixa usar um valor de enum
-- recém-adicionado na mesma transação que o criou, e a 0042 usa todos eles
-- nos gatilhos (mesma razão da 0022).
-- =====================================================================

alter type notification_kind add value if not exists 'APPOINTMENT_REQUESTED_FOR_ME';
alter type notification_kind add value if not exists 'APPOINTMENT_ASSIGNED';
alter type notification_kind add value if not exists 'APPOINTMENT_CANCELLED_FOR_ME';
alter type notification_kind add value if not exists 'APPOINTMENT_RESCHEDULED';
