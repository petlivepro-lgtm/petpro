-- Enums novos e extensões de enums existentes ficam isolados nesta migration.
-- PostgreSQL não permite usar valores adicionados por ALTER TYPE na mesma
-- transação em que eles são criados.

create type payment_method as enum (
  'CASH',
  'PIX',
  'DEBIT_CARD',
  'CREDIT_CARD',
  'BANK_TRANSFER',
  'OTHER'
);

create type reservation_origin as enum ('TUTOR', 'STAFF');
create type finance_refund_kind as enum ('PRODUCT_RETURN', 'SERVICE_REFUND');
create type stock_movement_source as enum (
  'MANUAL',
  'RESERVATION',
  'SALE',
  'CANCELLATION',
  'EXPIRATION',
  'REFUND'
);

alter type finance_source add value if not exists 'REFUND';
alter type reservation_status add value if not exists 'PARTIALLY_REFUNDED';
alter type reservation_status add value if not exists 'REFUNDED';
