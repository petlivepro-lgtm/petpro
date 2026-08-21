-- =====================================================================
-- Cor do serviço na agenda.
--
-- A agenda em calendário identifica o serviço pela cor do badge do card,
-- com uma legenda no topo ("Banho", "Tosa", "Banho e Tosa"...). Como o
-- catálogo de serviços é cadastrado por petshop, a cor não pode ser uma
-- lista fixa no código — cada tenant escolhe a sua no cadastro do serviço.
--
-- Fica nula por padrão: o catálogo que já existe não precisa ser editado
-- para a agenda funcionar. Quem não tem cor cadastrada recebe uma cor
-- estável derivada do id do serviço (ver lib/agenda-colors.ts) — nunca
-- cinza genérico, e nunca mudando de cor entre um render e outro.
--
-- O check só aceita "#RRGGBB" em vez de qualquer texto de cor CSS porque
-- a UI monta variações da cor (fundo translúcido, borda) a partir do hex.
--
-- Sem mexer em RLS: as policies de service_type são "for all", cobrindo
-- qualquer coluna nova.
-- =====================================================================

alter table service_type
  add column if not exists color_hex text;

alter table service_type
  drop constraint if exists service_type_color_hex_check;

alter table service_type
  add constraint service_type_color_hex_check
  check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$');

comment on column service_type.color_hex is
  'Cor do serviço na agenda, em #RRGGBB. Nulo = cor derivada do id pela UI.';

-- PostgREST guarda o schema em cache; sem isso o select da coluna nova
-- falharia até o próximo reload.
notify pgrst, 'reload schema';
