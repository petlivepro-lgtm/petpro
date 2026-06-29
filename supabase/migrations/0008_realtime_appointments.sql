-- =====================================================================
-- Agendamentos em tempo real + solicitações com vários serviços.
--   * request_group_id agrupa os appointments criados juntos numa mesma
--     solicitação do tutor (um appointment por serviço escolhido), para o
--     petshop poder confirmar/recusar tudo de uma vez ou individualmente.
--   * Habilita Supabase Realtime para `appointment`, para que a tela de
--     Solicitações e o dashboard do petshop atualizem sozinhos quando um
--     tutor envia um pedido.
-- REPLICA IDENTITY FULL: o Realtime precisa do registro completo em
-- UPDATE/DELETE para avaliar RLS e entregar os dados antigos.
-- =====================================================================

alter table appointment add column if not exists request_group_id uuid;
create index if not exists appointment_request_group_id_idx on appointment (request_group_id);

alter table appointment replica identity full;

-- Adiciona à publicação supabase_realtime apenas se ainda não estiver
-- (alter publication ... add table falha se a tabela já estiver presente).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointment'
  ) then
    execute 'alter publication supabase_realtime add table appointment';
  end if;
end $$;
