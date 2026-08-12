-- =====================================================================
-- O colaborador (0030) precisa poder concluir o próprio atendimento.
--
-- O trigger finance_on_appointment_completed (0026) exigia
-- can_manage_finance() — o predicado que mantém o VIEWER fora do caixa —
-- e isso barrava também o colaborador ao finalizar. Não dá para relaxar
-- can_manage_finance: ela também guarda as policies de finance_entry e as
-- RPCs de venda, estorno e devolução, onde o colaborador não entra.
--
-- Entra então um predicado próprio: quem gere o caixa conclui qualquer
-- atendimento; o colaborador conclui apenas os atribuídos a ele. A receita
-- em si continua sendo gravada pelo trigger (SECURITY DEFINER), sem que ele
-- enxergue a tabela.
-- =====================================================================

create or replace function can_complete_appointment(
  p_tenant_id uuid,
  p_collaborator_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select can_manage_finance(p_tenant_id)
      or (
        p_collaborator_id is not null
        and p_collaborator_id = my_collaborator_id(p_tenant_id)
      );
$$;

revoke execute on function can_complete_appointment(uuid, uuid) from public;
grant execute on function can_complete_appointment(uuid, uuid) to authenticated;

-- Recriada a partir de 0026: muda só a linha da permissão.
create or replace function finance_on_appointment_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price int;
  v_desc text;
  v_snapshot jsonb;
begin
  if new.status = 'COMPLETED' and old.status is distinct from new.status then
    if not can_complete_appointment(new.tenant_id, new.collaborator_id) then
      raise exception 'Sem permissão para concluir atendimentos';
    end if;
    if new.payment_method is null then
      raise exception 'Informe a forma de pagamento';
    end if;

    select
      st.price_cents,
      'Atendimento: ' || st.name,
      jsonb_build_object(
        'kind', 'SERVICE',
        'customer', jsonb_build_object(
          'id', t.id,
          'name', t.full_name,
          'cpf', t.cpf,
          'phone', t.phone,
          'email', t.email
        ),
        'pet', jsonb_build_object('id', p.id, 'name', p.name),
        'service', jsonb_build_object('id', st.id, 'name', st.name),
        'collaborator', jsonb_build_object('id', c.id, 'name', c.full_name),
        'scheduled_at', new.scheduled_at,
        'started_at', new.started_at,
        'finished_at', coalesce(new.finished_at, now()),
        'total_cents', st.price_cents
      )
    into v_price, v_desc, v_snapshot
    from tutor t
    join pet p on p.id = new.pet_id
    left join service_type st on st.id = new.service_type_id
    left join collaborator c on c.id = new.collaborator_id
    where t.id = new.tutor_id;

    if coalesce(v_price, 0) > 0 then
      insert into finance_entry (
        tenant_id, type, source, description, category, amount_cents,
        occurred_on, appointment_id, payment_method, snapshot, created_by
      )
      values (
        new.tenant_id, 'INCOME', 'APPOINTMENT', v_desc, 'servico', v_price,
        coalesce(new.finished_at, now())::date, new.id, new.payment_method,
        coalesce(v_snapshot, '{}'::jsonb), new.completed_by
      )
      on conflict (appointment_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;
