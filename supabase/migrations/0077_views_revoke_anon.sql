-- Tira o papel `anon` das views SECURITY DEFINER do colaborador e do entregador.
--
-- collaborator_pet (0031) e delivery_stop_card (0062) já se filtram por
-- auth.uid() e voltam vazias para quem não está logado — mas o Supabase dá
-- select ao `anon` em tudo que nasce no `public`, e não há motivo para a porta
-- existir. Quem lê essas views é sempre um colaborador logado (`authenticated`),
-- que continua com o grant das migrations de origem.
--
-- Pelo mesmo motivo, `authenticated` fica só com select: o padrão do Supabase
-- também lhe dava insert/update/delete/truncate. As views têm join e o Postgres
-- já recusaria a escrita, mas o privilégio não precisa existir.

revoke all on collaborator_pet, delivery_stop_card from anon;
revoke insert, update, delete, truncate, references, trigger
  on collaborator_pet, delivery_stop_card from authenticated;
