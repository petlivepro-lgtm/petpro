-- =====================================================================
-- Conversas do suporte em tempo real.
--
-- Petshop e tutor assinam pelo navegador: o Realtime avalia a RLS de cada
-- linha com o JWT de quem assina (0073), então nota interna e chamado de
-- outra pessoa nunca são entregues. As telas usam o evento só como sinal
-- para recarregar pelo servidor — o payload não é exibido.
--
-- O admin não tem client Supabase no navegador: o servidor do admin-web
-- assina com service role e repassa à página apenas "o chamado X mudou".
--
-- REPLICA IDENTITY FULL: o Realtime precisa da linha completa em
-- UPDATE/DELETE para avaliar a RLS (mesmo padrão da 0006).
-- =====================================================================

alter table support_ticket replica identity full;
alter table support_message replica identity full;

do $$
declare
  t text;
begin
  foreach t in array array['support_ticket', 'support_message']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;
