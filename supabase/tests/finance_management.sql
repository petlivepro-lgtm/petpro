\set ON_ERROR_STOP on

begin;

create or replace function pg_temp.assert_true(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(condition, false) then
    raise exception 'ASSERTION FAILED: %', message;
  end if;
end;
$$;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'finance-test@example.com',
  crypt('finance-test', gen_salt('bf')),
  now(),
  '{}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into profile (id, full_name)
values ('10000000-0000-0000-0000-000000000001', 'Responsável Teste');

insert into membership (tenant_id, profile_id, role)
values (
  '00000000-0000-0000-0000-0000000000a1',
  '10000000-0000-0000-0000-000000000001',
  'OWNER'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  v_tenant constant uuid := '00000000-0000-0000-0000-0000000000a1';
  v_product uuid;
  v_service uuid;
  v_tutor uuid;
  v_pet uuid;
  v_collaborator uuid;
  v_appointment uuid;
  v_sale uuid;
  v_item uuid;
  v_stock_before int;
  v_stock_after_sale int;
  v_price int;
  v_refund uuid;
  v_count int;
  v_amount int;
  v_failed boolean := false;
  v_reservation uuid;
  v_movements_before int;
begin
  select id, stock, price_cents
  into v_product, v_stock_before, v_price
  from product
  where tenant_id = v_tenant and active and for_sale
  order by created_at
  limit 1;

  -- Venda anônima: estoque e receita são criados juntos.
  v_sale := register_counter_sale(
    v_tenant,
    null,
    'PIX',
    jsonb_build_array(jsonb_build_object(
      'product_id', v_product,
      'quantity', 2
    )),
    '20000000-0000-0000-0000-000000000001'
  );

  select stock into v_stock_after_sale from product where id = v_product;
  perform pg_temp.assert_true(
    v_stock_after_sale = v_stock_before - 2,
    'venda de balcão deve baixar duas unidades'
  );
  perform pg_temp.assert_true(
    (select status = 'COMPLETED' and tutor_id is null and origin = 'STAFF'
     from product_reservation where id = v_sale),
    'venda anônima deve ficar concluída e sem tutor'
  );
  perform pg_temp.assert_true(
    (select count(*) = 1 from finance_entry where reservation_id = v_sale),
    'venda deve gerar exatamente uma receita'
  );
  perform pg_temp.assert_true(
    (select snapshot #>> '{customer,name}' = 'Consumidor final'
     from finance_entry where reservation_id = v_sale),
    'snapshot deve preservar consumidor final'
  );

  -- Repetição com a mesma chave não duplica baixa nem receita.
  perform register_counter_sale(
    v_tenant,
    null,
    'PIX',
    jsonb_build_array(jsonb_build_object(
      'product_id', v_product,
      'quantity', 2
    )),
    '20000000-0000-0000-0000-000000000001'
  );
  perform pg_temp.assert_true(
    (select stock = v_stock_after_sale from product where id = v_product),
    'reenvio idempotente não pode baixar o estoque novamente'
  );
  perform pg_temp.assert_true(
    (select count(*) = 1 from finance_entry where reservation_id = v_sale),
    'reenvio idempotente não pode duplicar receita'
  );

  select id into v_item
  from product_reservation_item
  where reservation_id = v_sale;

  -- Primeira devolução parcial.
  v_refund := refund_product_sale(
    v_sale,
    jsonb_build_array(jsonb_build_object(
      'reservation_item_id', v_item,
      'quantity', 1
    )),
    'Devolução parcial de teste',
    'PIX',
    '30000000-0000-0000-0000-000000000001'
  );
  perform pg_temp.assert_true(
    (select status = 'PARTIALLY_REFUNDED' from product_reservation where id = v_sale),
    'primeira devolução deve marcar status parcial'
  );
  perform pg_temp.assert_true(
    (select stock = v_stock_after_sale + 1 from product where id = v_product),
    'devolução parcial deve repor uma unidade'
  );
  perform pg_temp.assert_true(
    (select amount_cents = v_price from finance_refund where id = v_refund),
    'devolução deve usar o preço congelado na venda'
  );

  -- Segunda devolução completa o estorno.
  perform refund_product_sale(
    v_sale,
    jsonb_build_array(jsonb_build_object(
      'reservation_item_id', v_item,
      'quantity', 1
    )),
    'Devolução final de teste',
    'PIX',
    '30000000-0000-0000-0000-000000000002'
  );
  perform pg_temp.assert_true(
    (select status = 'REFUNDED' from product_reservation where id = v_sale),
    'segunda devolução deve marcar venda devolvida'
  );
  perform pg_temp.assert_true(
    (select stock = v_stock_before from product where id = v_product),
    'devolução total deve restaurar o estoque original'
  );
  perform pg_temp.assert_true(
    (select count(*) = 2 from finance_refund where reservation_id = v_sale),
    'duas devoluções parciais devem permanecer auditáveis'
  );

  -- Quantidade excedente deve falhar sem alterar dados.
  begin
    perform refund_product_sale(
      v_sale,
      jsonb_build_array(jsonb_build_object(
        'reservation_item_id', v_item,
        'quantity', 1
      )),
      'Quantidade excedente',
      'PIX',
      '30000000-0000-0000-0000-000000000003'
    );
  exception when others then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'devolução acima do saldo deve falhar');
  perform pg_temp.assert_true(
    (select count(*) = 2 from finance_refund where reservation_id = v_sale),
    'falha não pode deixar estorno parcial gravado'
  );

  -- Estoque insuficiente deve reverter venda inteira.
  select count(*) into v_count from product_reservation;
  v_failed := false;
  begin
    perform register_counter_sale(
      v_tenant,
      null,
      'CASH',
      jsonb_build_array(jsonb_build_object(
        'product_id', v_product,
        'quantity', 999999
      )),
      '20000000-0000-0000-0000-000000000002'
    );
  exception when others then
    v_failed := true;
  end;
  perform pg_temp.assert_true(v_failed, 'venda sem estoque deve falhar');
  perform pg_temp.assert_true(
    (select count(*) = v_count from product_reservation),
    'rollback deve remover cabeçalho da venda inválida'
  );
  perform pg_temp.assert_true(
    (select stock = v_stock_before from product where id = v_product),
    'rollback deve preservar estoque'
  );

  -- Atendimento concluído gera uma receita e aceita estorno integral único.
  insert into tutor (tenant_id, full_name, cpf, phone)
  values (v_tenant, 'Cliente Serviço', '12345678901', '(11) 99999-9999')
  returning id into v_tutor;

  insert into pet (tenant_id, tutor_id, name, species)
  values (v_tenant, v_tutor, 'Pet Serviço', 'Cão')
  returning id into v_pet;

  insert into collaborator (tenant_id, full_name, role_title)
  values (v_tenant, 'Banhista Teste', 'Banhista')
  returning id into v_collaborator;

  select id into v_service
  from service_type
  where tenant_id = v_tenant
  order by created_at
  limit 1;

  insert into appointment (
    tenant_id, tutor_id, pet_id, service_type_id, collaborator_id,
    status, scheduled_at, started_at
  )
  values (
    v_tenant, v_tutor, v_pet, v_service, v_collaborator,
    'IN_PROGRESS', now(), now()
  )
  returning id into v_appointment;

  update appointment
  set status = 'COMPLETED',
      finished_at = now(),
      payment_method = 'CREDIT_CARD',
      completed_by = '10000000-0000-0000-0000-000000000001'
  where id = v_appointment;

  perform pg_temp.assert_true(
    (select count(*) = 1 from finance_entry where appointment_id = v_appointment),
    'atendimento deve gerar uma receita'
  );
  perform pg_temp.assert_true(
    (select snapshot #>> '{customer,cpf}' = '12345678901'
     from finance_entry where appointment_id = v_appointment),
    'snapshot do serviço deve preservar CPF'
  );
  perform pg_temp.assert_true(
    (select snapshot #>> '{collaborator,name}' = 'Banhista Teste'
     from finance_entry where appointment_id = v_appointment),
    'snapshot do serviço deve preservar colaborador'
  );

  update appointment set status = 'COMPLETED' where id = v_appointment;
  perform pg_temp.assert_true(
    (select count(*) = 1 from finance_entry where appointment_id = v_appointment),
    'submissão repetida não pode duplicar receita do serviço'
  );

  select count(*) into v_movements_before from stock_movement;
  perform refund_service(
    v_appointment,
    'Estorno integral de teste',
    'CREDIT_CARD',
    '40000000-0000-0000-0000-000000000001'
  );
  perform pg_temp.assert_true(
    (select status = 'COMPLETED' from appointment where id = v_appointment),
    'estorno não deve apagar ou cancelar atendimento concluído'
  );
  perform pg_temp.assert_true(
    (select count(*) = 1 from finance_refund where appointment_id = v_appointment),
    'serviço deve aceitar somente um estorno'
  );
  perform pg_temp.assert_true(
    (select count(*) = v_movements_before from stock_movement),
    'estorno de serviço não pode movimentar estoque'
  );

  perform refund_service(
    v_appointment,
    'Clique repetido',
    'CREDIT_CARD',
    '40000000-0000-0000-0000-000000000002'
  );
  perform pg_temp.assert_true(
    (select count(*) = 1 from finance_refund where appointment_id = v_appointment),
    'clique repetido não pode duplicar estorno de serviço'
  );

  -- Cancelamento antes do pagamento repõe uma única vez.
  insert into product_reservation (
    tenant_id, tutor_id, status, origin, expires_at
  )
  values (v_tenant, v_tutor, 'PICKED', 'TUTOR', now() + interval '1 day')
  returning id into v_reservation;

  insert into product_reservation_item (
    tenant_id, reservation_id, product_id, quantity, price_cents
  )
  values (v_tenant, v_reservation, v_product, 1, v_price);
  update product set stock = stock - 1 where id = v_product;

  perform cancel_product_reservation(
    v_reservation,
    'Cliente desistiu antes do pagamento',
    'CANCELLED'
  );
  perform pg_temp.assert_true(
    (select status = 'CANCELLED' from product_reservation where id = v_reservation),
    'cancelamento deve marcar reserva cancelada'
  );
  perform pg_temp.assert_true(
    (select stock = v_stock_before from product where id = v_product),
    'cancelamento deve repor estoque'
  );
  perform cancel_product_reservation(
    v_reservation,
    'Clique repetido no cancelamento',
    'CANCELLED'
  );
  perform pg_temp.assert_true(
    (select stock = v_stock_before from product where id = v_product),
    'cancelamento repetido não pode repor duas vezes'
  );

  -- Expiração automática repõe estoque e registra a origem.
  insert into product_reservation (
    tenant_id, tutor_id, status, origin, expires_at
  )
  values (v_tenant, v_tutor, 'RESERVED', 'TUTOR', now() - interval '1 hour')
  returning id into v_reservation;
  insert into product_reservation_item (
    tenant_id, reservation_id, product_id, quantity, price_cents
  )
  values (v_tenant, v_reservation, v_product, 1, v_price);
  update product set stock = stock - 1 where id = v_product;

  perform expire_product_reservations();
  perform pg_temp.assert_true(
    (select status = 'EXPIRED' from product_reservation where id = v_reservation),
    'rotina deve expirar reserva vencida'
  );
  perform pg_temp.assert_true(
    (select stock = v_stock_before from product where id = v_product),
    'expiração deve repor estoque'
  );
  perform pg_temp.assert_true(
    (select exists (
      select 1 from stock_movement
      where reservation_id = v_reservation and source = 'EXPIRATION' and type = 'IN'
    )),
    'histórico deve identificar reposição por expiração'
  );

  -- Consulta retorna totais líquidos e detalhes serializáveis.
  perform pg_temp.assert_true(
    (search_finance_movements(
      v_tenant, null, null, null, null, null, null, null, null, null, 1, 50
    )->>'total')::int > 0,
    'consulta financeira deve retornar resultados'
  );
  perform pg_temp.assert_true(
    jsonb_array_length(
      search_stock_movements(
        v_tenant, null, null, null, null, null, 1, 50
      )->'rows'
    ) > 0,
    'consulta de estoque deve retornar resultados'
  );
end;
$$;

rollback;
