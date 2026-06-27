-- Fluxo padrão (passo a passo) do serviço, semeado como checklist ao iniciar o atendimento.
alter table service_type add column if not exists default_steps text[] not null default '{}';
