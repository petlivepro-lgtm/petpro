-- =====================================================================
-- Recusa do petshop deixa de ser indistinguível do cancelamento do tutor
-- (ambos gravavam CANCELLED). Novo valor: REJECTED.
--
-- ATENÇÃO: este arquivo contém SÓ o ALTER TYPE. O Postgres proíbe
-- AVALIAR um valor de enum recém-adicionado na mesma transação, e a
-- Management API executa cada arquivo como uma transação implícita —
-- qualquer check/policy/default/update que referencie 'REJECTED' tem de
-- ficar na migration seguinte (0023).
-- =====================================================================

alter type reservation_status add value if not exists 'REJECTED';
