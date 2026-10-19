-- =====================================================================
-- Avisos do suporte da plataforma. Em migration própria porque um valor
-- novo de enum não pode ser usado na mesma transação em que nasce (0073).
-- =====================================================================

-- A equipe do Pet Live Pro respondeu um chamado (do tutor ou do petshop).
alter type notification_kind add value if not exists 'SUPPORT_REPLIED';
-- O chamado foi marcado como resolvido.
alter type notification_kind add value if not exists 'SUPPORT_RESOLVED';
