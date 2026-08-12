-- =====================================================================
-- Papel COLLABORATOR: o profissional que atende (tabela collaborator, 0014)
-- passa a poder ter login no painel, com acesso restrito à própria agenda.
--
-- Migration isolada de propósito: o Postgres não permite *usar* um valor de
-- enum na mesma transação em que ele é adicionado, e cada arquivo aqui é
-- aplicado como uma transação. As policies que comparam com 'COLLABORATOR'
-- vêm na 0031.
-- =====================================================================

alter type staff_role add value if not exists 'COLLABORATOR';
