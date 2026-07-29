-- =====================================================================
-- Seed de desenvolvimento — tenant piloto + catálogo.
-- Usuários (auth.users) são criados via Supabase Studio / signup.
-- Depois vincule:
--   * staff:  insert em membership (tenant_id, profile_id, role)
--   * tutor:  update tutor set profile_id = '<auth user id>' where email = ...
-- =====================================================================

insert into tenant (id, name, slug)
values ('00000000-0000-0000-0000-0000000000a1', 'Petshop Piloto', 'piloto')
on conflict (id) do nothing;

insert into service_type (tenant_id, name, description, price_cents, duration_min)
values
  ('00000000-0000-0000-0000-0000000000a1', 'Banho',  'Banho completo com secagem', 6000, 60),
  ('00000000-0000-0000-0000-0000000000a1', 'Tosa',   'Tosa higiênica ou completa', 9000, 90),
  ('00000000-0000-0000-0000-0000000000a1', 'Consulta', 'Consulta veterinária',     12000, 30)
on conflict do nothing;

insert into product (tenant_id, name, description, price_cents, stock, min_stock)
values
  ('00000000-0000-0000-0000-0000000000a1', 'Ração Premium 1kg', 'Ração super premium', 4500, 25, 10),
  ('00000000-0000-0000-0000-0000000000a1', 'Brinquedo Mordedor', 'Mordedor resistente', 2900, 40, 5),
  ('00000000-0000-0000-0000-0000000000a1', 'Shampoo Neutro 500ml', 'Shampoo hipoalergênico', 3200, 15, 20)
on conflict do nothing;

-- Lançamentos financeiros de exemplo (datas relativas → gráficos populados)
select set_config('app.allow_missing_payment', '1', false);
insert into finance_entry (tenant_id, type, description, category, amount_cents, occurred_on)
values
  ('00000000-0000-0000-0000-0000000000a1', 'INCOME',  'Banho e tosa avulso',    'servico', 15000, current_date - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000a1', 'INCOME',  'Venda de ração',         'produto',  9000, current_date - interval '5 days'),
  ('00000000-0000-0000-0000-0000000000a1', 'EXPENSE', 'Compra de insumos',      'insumo',   7500, current_date - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000a1', 'INCOME',  'Pacote mensal de banho', 'servico', 24000, current_date - interval '1 month'),
  ('00000000-0000-0000-0000-0000000000a1', 'EXPENSE', 'Aluguel',                'aluguel', 20000, current_date - interval '1 month'),
  ('00000000-0000-0000-0000-0000000000a1', 'INCOME',  'Consultas veterinárias', 'servico', 36000, current_date - interval '2 months'),
  ('00000000-0000-0000-0000-0000000000a1', 'EXPENSE', 'Salário auxiliar',       'salario', 18000, current_date - interval '2 months')
on conflict do nothing;
select set_config('app.allow_missing_payment', '', false);

-- Tutor de exemplo (sem login ainda — profile_id nulo)
insert into tutor (id, tenant_id, full_name, email, phone)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'Maria Tutora', 'maria@example.com', '+55 11 99999-0000')
on conflict (id) do nothing;

insert into pet (id, tenant_id, tutor_id, name, species, breed, size)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Thor', 'cão', 'Golden Retriever', 'grande')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Boletim de comportamento: categorias do petshop + histórico do Thor em
-- meses diferentes, para o card do pet nascer com média, contagem e selo.
-- ---------------------------------------------------------------------
update tenant set settings = settings || jsonb_build_object(
  'behavior', jsonb_build_object('categories', jsonb_build_array(
    jsonb_build_object('id', 'default-socializacao',  'label', 'Socialização',           'inverted', false, 'required', true),
    jsonb_build_object('id', 'default-obediencia',    'label', 'Obediência',             'inverted', false, 'required', true),
    jsonb_build_object('id', 'default-tranquilidade', 'label', 'Tranquilidade no banho', 'inverted', false, 'required', true),
    jsonb_build_object('id', 'default-manuseio',      'label', 'Tolerância ao manuseio', 'inverted', false, 'required', false),
    jsonb_build_object('id', 'default-ansiedade',     'label', 'Ansiedade',              'inverted', true,  'required', false)
  ))
)
where id = '00000000-0000-0000-0000-0000000000a1';

-- Quatro atendimentos concluídos do Thor, um por mês.
insert into appointment (id, tenant_id, pet_id, tutor_id, service_type_id, origin, status, scheduled_at, finished_at, payment_method)
select
  ('00000000-0000-0000-0000-0000000000d' || n)::uuid,
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000b1',
  (select id from service_type where tenant_id = '00000000-0000-0000-0000-0000000000a1' and name = 'Banho' limit 1),
  'STAFF', 'COMPLETED',
  now() - (n || ' months')::interval,
  now() - (n || ' months')::interval + interval '1 hour',
  'PIX'
from generate_series(1, 4) as n
on conflict (id) do nothing;

-- Boletins: notas sobem ao longo dos meses (o mais recente é o melhor).
-- overall_score já vem normalizado — "Ansiedade" é invertida, entra como 6 - nota.
insert into pet_behavior_report (tenant_id, pet_id, appointment_id, overall_score, responses, note)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d1', 4.80,
   '[{"category_id":"default-socializacao","label":"Socialização","inverted":false,"value":5},
     {"category_id":"default-obediencia","label":"Obediência","inverted":false,"value":5},
     {"category_id":"default-tranquilidade","label":"Tranquilidade no banho","inverted":false,"value":5},
     {"category_id":"default-manuseio","label":"Tolerância ao manuseio","inverted":false,"value":5},
     {"category_id":"default-ansiedade","label":"Ansiedade","inverted":true,"value":2}]'::jsonb,
   'Comportou-se muito bem, brincou com os outros cães.'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d2', 4.20,
   '[{"category_id":"default-socializacao","label":"Socialização","inverted":false,"value":5},
     {"category_id":"default-obediencia","label":"Obediência","inverted":false,"value":4},
     {"category_id":"default-tranquilidade","label":"Tranquilidade no banho","inverted":false,"value":4},
     {"category_id":"default-manuseio","label":"Tolerância ao manuseio","inverted":false,"value":4},
     {"category_id":"default-ansiedade","label":"Ansiedade","inverted":true,"value":2}]'::jsonb,
   'Tranquilo no banho, um pouco agitado na secagem.'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d3', 3.60,
   '[{"category_id":"default-socializacao","label":"Socialização","inverted":false,"value":4},
     {"category_id":"default-obediencia","label":"Obediência","inverted":false,"value":3},
     {"category_id":"default-tranquilidade","label":"Tranquilidade no banho","inverted":false,"value":4},
     {"category_id":"default-manuseio","label":"Tolerância ao manuseio","inverted":false,"value":4},
     {"category_id":"default-ansiedade","label":"Ansiedade","inverted":true,"value":3}]'::jsonb,
   null),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000d4', 3.00,
   '[{"category_id":"default-socializacao","label":"Socialização","inverted":false,"value":3},
     {"category_id":"default-obediencia","label":"Obediência","inverted":false,"value":3},
     {"category_id":"default-tranquilidade","label":"Tranquilidade no banho","inverted":false,"value":3},
     {"category_id":"default-manuseio","label":"Tolerância ao manuseio","inverted":false,"value":3},
     {"category_id":"default-ansiedade","label":"Ansiedade","inverted":true,"value":3}]'::jsonb,
   'Primeiro banho — estranhou o ambiente.')
on conflict (appointment_id) do nothing;

-- created_at acompanha a data do atendimento, para o agrupamento mensal fazer sentido.
update pet_behavior_report r
set created_at = a.finished_at
from appointment a
where a.id = r.appointment_id
  and r.pet_id = '00000000-0000-0000-0000-0000000000c1';
