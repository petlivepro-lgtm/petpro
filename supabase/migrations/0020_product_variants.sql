-- =====================================================================
-- Variações de produto (SKU): cor + tamanho + peso, cada combinação com
-- preço e estoque próprios. Qualquer um dos três atributos pode faltar
-- (produto só com cor, só com peso etc.).
--
-- product.stock e product.price_cents viram DERIVADOS quando o produto
-- tem variações (soma dos estoques ativos / menor preço ativo), mantidos
-- por trigger. Isso preserva as telas existentes (grid do CRM com
-- min_stock, vitrine do tutor, dashboard) sem reescrevê-las e mantém o
-- stock_movement com fonte única no trigger de product.stock (0012).
--
-- ORDEM DE LOCK (regra do sistema): quando o produto tem variações,
-- trava-se SEMPRE product_variant primeiro; o trigger de agregação
-- escala para product. Nenhum caminho pode travar product antes da
-- variação, sob pena de deadlock ABBA com o CRM editando variações.
-- =====================================================================

create table product_variant (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenant(id) on delete cascade,
  product_id    uuid not null references product(id) on delete cascade,

  color_name    text,
  color_hex     text check (color_hex ~ '^#[0-9a-fA-F]{6}$'),
  size          text,                                        -- texto livre: "P", "nº 3", "40cm"
  weight_value  numeric(10,3) check (weight_value > 0),
  weight_unit   text check (weight_unit in ('g','kg')),

  -- Peso normalizado em gramas: impede "1 kg" e "1000 g" como duas linhas.
  weight_grams  numeric(13,3) generated always as (
    case
      when weight_value is null then null
      when weight_unit = 'kg'   then weight_value * 1000
      else weight_value
    end
  ) stored,

  price_cents   integer not null default 0 check (price_cents >= 0),
  stock         integer not null default 0 check (stock >= 0),
  active        boolean not null default true,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),

  constraint product_variant_has_attribute check (
    color_name is not null or size is not null or weight_value is not null
  ),
  constraint product_variant_color_pair  check ((color_name   is null) = (color_hex   is null)),
  constraint product_variant_weight_pair check ((weight_value is null) = (weight_unit is null))
);

create index on product_variant (tenant_id);
create index on product_variant (product_id, position, created_at);

-- NULL não colide em unique constraint, daí o coalesce; lower(btrim())
-- evita "M" e " m " como variações distintas.
create unique index product_variant_combo_uniq on product_variant (
  product_id,
  lower(btrim(coalesce(color_name, ''))),
  lower(btrim(coalesce(size, ''))),
  coalesce(weight_grams, (-1)::numeric)
);

-- ---------------------------------------------------------------------
-- RLS: espelha product_staff (0001) e product_read (0013). O exists roda
-- sob a RLS do chamador em product, que já expõe ao tutor exatamente os
-- produtos active + for_sale.
-- ---------------------------------------------------------------------
alter table product_variant enable row level security;

create policy product_variant_staff on product_variant for all
  using (is_staff(tenant_id)) with check (is_staff(tenant_id));

create policy product_variant_read on product_variant for select using (
  is_staff(tenant_id)
  or (
    active
    and my_tutor_id(tenant_id) is not null
    and exists (
      select 1 from product p
       where p.id = product_variant.product_id and p.active and p.for_sale
    )
  )
);

-- ---------------------------------------------------------------------
-- Rótulo canônico da variação ("Preto · M · 1 kg"): uma única formatação,
-- usada no snapshot do item de reserva. concat_ws ignora NULL.
-- ---------------------------------------------------------------------
create or replace function product_variant_label(v product_variant)
returns text
language sql
immutable
as $$
  select nullif(
    concat_ws(' · ',
      v.color_name,
      v.size,
      case when v.weight_value is null then null
           else trim_scale(v.weight_value)::text || ' ' || v.weight_unit end
    ), '');
$$;

-- ---------------------------------------------------------------------
-- stock_movement passa a registrar a variação. O trigger em product.stock
-- não sabe qual variação mexeu: recebe pelo mesmo idioma de GUC
-- transacional já usado para a nota (app.stock_note).
-- ---------------------------------------------------------------------
alter table stock_movement
  add column variant_id uuid references product_variant(id) on delete set null;

create or replace function log_stock_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stock is distinct from old.stock then
    insert into stock_movement (tenant_id, product_id, variant_id, type, quantity, stock_after, note, created_by)
    values (
      new.tenant_id,
      new.id,
      nullif(current_setting('app.stock_variant_id', true), '')::uuid,
      case when new.stock > old.stock then 'IN'::stock_movement_type else 'OUT'::stock_movement_type end,
      abs(new.stock - old.stock),
      new.stock,
      nullif(current_setting('app.stock_note', true), ''),
      auth.uid()
    );
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Agregação. Trava a linha de product ANTES de calcular o agregado: sem
-- isso o EvalPlanQual do READ COMMITTED reaproveita o snapshot do subplan
-- e duas transações mexendo em variações distintas do mesmo produto
-- perdem update. Somar (em vez de aplicar delta) é auto-curativo: absorve
-- insert, delete e toggle de `active` sem drift.
-- ---------------------------------------------------------------------
create or replace function sync_product_aggregate(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sum   int;
  v_price int;
  v_any   boolean;
begin
  -- Em cascade delete de product a linha já sumiu: 0 linhas travadas e o
  -- update abaixo vira no-op.
  perform 1 from product where id = p_product_id for update;

  select count(*) > 0,
         coalesce(sum(stock) filter (where active), 0)::int,
         min(price_cents) filter (where active)
    into v_any, v_sum, v_price
    from product_variant
   where product_id = p_product_id;

  -- Produto sem variações mantém os valores editados à mão.
  if not v_any then
    return;
  end if;

  perform set_config('app.variant_sync', '1', true);
  update product
     set stock       = v_sum,
         price_cents = coalesce(v_price, price_cents)
   where id = p_product_id
     and (stock is distinct from v_sum
          or price_cents is distinct from coalesce(v_price, price_cents));
  perform set_config('app.variant_sync', '', true);
end;
$$;

revoke execute on function sync_product_aggregate(uuid) from public;

create or replace function sync_product_from_variants()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_variant_id uuid;
  v_prev_note  text;
begin
  if tg_op = 'DELETE' then
    v_product_id := old.product_id;
    v_variant_id := old.id;
  else
    v_product_id := new.product_id;
    v_variant_id := new.id;
  end if;

  perform set_config('app.stock_variant_id', v_variant_id::text, true);
  v_prev_note := coalesce(current_setting('app.stock_note', true), '');
  if v_prev_note = '' then
    perform set_config('app.stock_note', 'Recálculo pelas variações', true);
  end if;

  perform sync_product_aggregate(v_product_id);

  if tg_op = 'UPDATE' and new.product_id is distinct from old.product_id then
    perform sync_product_aggregate(old.product_id);
  end if;

  perform set_config('app.stock_variant_id', '', true);
  perform set_config('app.stock_note', v_prev_note, true);
  return null;
end;
$$;

create trigger product_variant_sync
  after insert or delete or update of stock, price_cents, active, product_id
  on product_variant
  for each row execute function sync_product_from_variants();

-- ---------------------------------------------------------------------
-- Guarda: escrita direta em product.stock/price_cents é ignorada quando o
-- produto tem variações. updateProduct envia os dois campos em TODO save;
-- sem esta guarda, editar o nome sobrescreveria o agregado e geraria um
-- stock_movement fantasma. Ignora em silêncio (a UI esconde os campos).
-- ---------------------------------------------------------------------
create or replace function guard_derived_product_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Escrita vinda da própria agregação.
  if coalesce(current_setting('app.variant_sync', true), '') = '1' then
    return new;
  end if;

  if (new.stock is distinct from old.stock or new.price_cents is distinct from old.price_cents)
     and exists (select 1 from product_variant v where v.product_id = new.id) then
    new.stock       := old.stock;
    new.price_cents := old.price_cents;
  end if;
  return new;
end;
$$;

create trigger product_derived_guard
  before update of stock, price_cents on product
  for each row execute function guard_derived_product_fields();

-- ---------------------------------------------------------------------
-- Realtime: o seletor de variação do tutor mostra estoque/preço por
-- variação, então a tabela precisa estar na publicação (espelha 0006).
-- ---------------------------------------------------------------------
alter table product_variant replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'product_variant'
  ) then
    execute 'alter publication supabase_realtime add table product_variant';
  end if;
end $$;
