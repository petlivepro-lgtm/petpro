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

-- Tutor de exemplo (sem login ainda — profile_id nulo)
insert into tutor (id, tenant_id, full_name, email, phone)
values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'Maria Tutora', 'maria@example.com', '+55 11 99999-0000')
on conflict (id) do nothing;

insert into pet (tenant_id, tutor_id, name, species, breed, size)
values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'Thor', 'cão', 'Golden Retriever', 'grande')
on conflict do nothing;
