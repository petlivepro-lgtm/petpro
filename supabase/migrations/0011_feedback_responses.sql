-- Feedback configurável pelo petshop.
-- O petshop monta o formulário de avaliação em tenant.settings.feedback (jsonb).
-- As respostas do tutor passam a ser guardadas de forma estruturada nesta coluna,
-- com snapshot de tipo/label por campo. As colunas legadas rating/comment seguem
-- preenchidas (1º campo STARS / 1º campo TEXT) para compatibilidade e agregação.
alter table feedback add column responses jsonb;
