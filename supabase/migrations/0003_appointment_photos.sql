-- Fotos do pet registradas no atendimento (tiradas pelo staff ao finalizar).
alter table appointment add column if not exists photos text[] not null default '{}';
