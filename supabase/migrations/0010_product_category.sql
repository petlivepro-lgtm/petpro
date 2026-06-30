-- Categoria do produto (seletor predefinido no CRM; filtro no app do tutor).
-- Texto livre no banco; os valores válidos são centralizados em packages/types/src/enums.ts.
alter table product add column category text;

create index on product (tenant_id, category);
