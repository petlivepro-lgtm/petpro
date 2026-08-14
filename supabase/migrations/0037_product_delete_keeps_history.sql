-- =====================================================================
-- Excluir produto de verdade, sem perder o histórico de reservas.
--
-- Antes: product_reservation_item.product_id (e variant_id, 0021) eram
-- "on delete restrict". Bastava o produto ter entrado numa reserva —
-- mesmo cancelada, mesmo de meses atrás — para o delete falhar com
-- 23503 e o petshop ficar só com a opção de desativar.
--
-- Agora: o item guarda o nome do produto em snapshot (product_name, no
-- mesmo espírito de price_cents e variant_label, que já eram snapshot) e
-- as duas FKs viram "on delete set null". Excluir o produto apaga
-- catálogo, fotos, variações e movimentações de estoque (product_variant
-- e stock_movement já eram cascade), mas a reserva antiga continua
-- legível e o financeiro fica intacto — finance_entry nunca dependeu de
-- product, só do total gravado no item.
--
-- O snapshot é preenchido por trigger, e não dentro das funções de
-- reserva: hoje existem dois caminhos de insert (reserve_products, 0021,
-- e register_counter_sale, 0036) e o trigger cobre os dois — além dos
-- futuros — sem precisar reescrever nenhuma delas.
--
-- restore_reservation_stock (0021) não muda: com product_id/variant_id
-- nulos o "update ... where id = null" não acha linha e a devolução de
-- estoque vira no-op, que é exatamente o certo para produto excluído.
-- =====================================================================

alter table product_reservation_item
  add column if not exists product_name text;

comment on column product_reservation_item.product_name is
  'Snapshot do nome do produto na hora da reserva — é o que sobra quando o produto é excluído do catálogo.';

update product_reservation_item ri
   set product_name = p.name
  from product p
 where p.id = ri.product_id
   and ri.product_name is null;

-- ---------------------------------------------------------------------
-- Snapshot automático em qualquer caminho de insert.
-- ---------------------------------------------------------------------
create or replace function fill_reservation_item_product_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_name is null and new.product_id is not null then
    select name into new.product_name from product where id = new.product_id;
  end if;
  return new;
end;
$$;

drop trigger if exists product_reservation_item_name_snapshot on product_reservation_item;

create trigger product_reservation_item_name_snapshot
  before insert on product_reservation_item
  for each row execute function fill_reservation_item_product_name();

-- ---------------------------------------------------------------------
-- restrict -> set null nas FKs de catálogo do item.
--
-- As constraints são dropadas por busca (confdeltype = 'r'), e não pelo
-- nome default: as de tenant_id/reservation_id são cascade, então o
-- filtro pega exatamente product_id e variant_id, qualquer que seja o
-- nome que o Postgres tenha gerado.
-- ---------------------------------------------------------------------
alter table product_reservation_item alter column product_id drop not null;

do $$
declare r record;
begin
  for r in
    select conname
      from pg_constraint
     where conrelid = 'product_reservation_item'::regclass
       and contype = 'f'
       and confdeltype = 'r'
  loop
    execute format('alter table product_reservation_item drop constraint %I', r.conname);
  end loop;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'product_reservation_item'::regclass
       and conname = 'product_reservation_item_product_id_fkey'
  ) then
    alter table product_reservation_item
      add constraint product_reservation_item_product_id_fkey
      foreign key (product_id) references product(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'product_reservation_item'::regclass
       and conname = 'product_reservation_item_variant_id_fkey'
  ) then
    alter table product_reservation_item
      add constraint product_reservation_item_variant_id_fkey
      foreign key (variant_id) references product_variant(id) on delete set null;
  end if;
end $$;

-- PostgREST guarda os relacionamentos em cache; sem isso os embeds
-- product:product_id(...) continuariam com o schema antigo até o reload.
notify pgrst, 'reload schema';
