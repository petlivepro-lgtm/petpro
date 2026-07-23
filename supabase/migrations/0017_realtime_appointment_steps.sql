-- =====================================================================
-- Etapas do atendimento em tempo real.
--   * Habilita Supabase Realtime para `appointment_step`, para que o tutor
--     veja no app (barra abaixo do ao vivo) cada etapa que o petshop marca
--     como concluída, no momento em que acontece.
-- REPLICA IDENTITY FULL: o Realtime precisa do registro completo em
-- UPDATE/DELETE para avaliar RLS (step_tutor_select) e entregar os dados.
-- =====================================================================

alter table appointment_step replica identity full;

-- Adiciona à publicação supabase_realtime apenas se ainda não estiver
-- (alter publication ... add table falha se a tabela já estiver presente).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointment_step'
  ) then
    execute 'alter publication supabase_realtime add table appointment_step';
  end if;
end $$;
