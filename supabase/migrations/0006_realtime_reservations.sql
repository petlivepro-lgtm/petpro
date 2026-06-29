-- =====================================================================
-- Habilita Supabase Realtime para estoque e reservas, para que o catálogo
-- (tutor) e a tela de estoque (petshop) atualizem sozinhos quando uma
-- reserva abate ou um cancelamento devolve estoque.
-- REPLICA IDENTITY FULL: o Realtime precisa do registro completo em
-- UPDATE/DELETE para avaliar RLS e entregar os dados antigos.
-- =====================================================================

alter table product replica identity full;
alter table product_reservation replica identity full;
alter table product_reservation_item replica identity full;

-- Adiciona à publicação supabase_realtime apenas se ainda não estiver
-- (alter publication ... add table falha se a tabela já estiver presente).
do $$
declare
  t text;
begin
  foreach t in array array['product', 'product_reservation', 'product_reservation_item']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
