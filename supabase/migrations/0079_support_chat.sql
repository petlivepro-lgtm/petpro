-- =====================================================================
-- Conversa do suporte, lado do cliente (petshop e tutor):
--
--   * anexo em qualquer mensagem: support_attachment ganha message_id e o
--     cliente passa a ler os anexos dos próprios chamados (o arquivo em si
--     continua atrás do servidor, que entrega URL assinada curta);
--   * o cliente encerra o chamado e avalia o atendimento (1 a 5);
--   * "não lidas": última leitura por pessoa, para o selo de resposta nova.
--
-- A escrita continua só por RPC; as tabelas seguem sem insert/update para
-- authenticated.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Anexo por mensagem
-- ---------------------------------------------------------------------

alter table support_attachment
  add column message_id uuid references support_message(id) on delete set null;
create index support_attachment_message on support_attachment (message_id);

-- Os anexos que já existem vieram na abertura: ficam na primeira mensagem.
update support_attachment a
   set message_id = (
     select m.id from support_message m
      where m.ticket_id = a.ticket_id and m.author_kind = 'CUSTOMER'
      order by m.created_at limit 1)
 where a.message_id is null;

-- Mensagem só com anexo: o texto pode vir vazio. Quem exige texto quando não
-- há anexo é a RPC (o admin, sem anexo, valida no servidor dele).
alter table support_message drop constraint support_message_body_check;
alter table support_message add constraint support_message_body_check
  check (char_length(body) <= 5000);

create policy support_attachment_select on support_attachment
  for select using (
    can_see_support_ticket(ticket_id)
    and (message_id is null or exists (
      select 1 from support_message m where m.id = message_id and not m.internal))
  );
-- storage_path fica de fora: o caminho no bucket só o servidor conhece.
grant select (id, ticket_id, message_id, file_name, mime_type, size_bytes, created_at)
  on support_attachment to authenticated;

-- ---------------------------------------------------------------------
-- Avaliação e prazo visíveis ao cliente
-- ---------------------------------------------------------------------

alter table support_ticket
  add column satisfaction_rating  smallint check (satisfaction_rating between 1 and 5),
  add column satisfaction_comment text check (char_length(satisfaction_comment) <= 1000);

grant select (first_response_due_at, satisfaction_rating, satisfaction_comment)
  on support_ticket to authenticated;

-- ---------------------------------------------------------------------
-- Leitura por pessoa (dono e gerente leem o mesmo chamado do petshop)
-- ---------------------------------------------------------------------

create table support_read (
  ticket_id    uuid not null references support_ticket(id) on delete cascade,
  profile_id   uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (ticket_id, profile_id)
);
alter table support_read enable row level security;
create policy support_read_select on support_read
  for select using (profile_id = auth.uid());
revoke all on support_read from public, anon, authenticated;
grant select on support_read to authenticated;
grant select, insert, update, delete on support_read to service_role;

/** Marca o chamado como lido agora por quem chama. Silencioso se não enxerga. */
create or replace function mark_support_read(p_ticket uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not can_see_support_ticket(p_ticket) then
    return;
  end if;
  insert into support_read (ticket_id, profile_id, last_read_at)
  values (p_ticket, auth.uid(), now())
  on conflict (ticket_id, profile_id) do update set last_read_at = excluded.last_read_at;
end $$;

/**
 * Chamados com resposta da equipe depois da última leitura de quem chama.
 * INVOKER: a RLS de support_ticket e support_message recorta (só os chamados
 * que a pessoa vê, nunca nota interna). O filtro por petshop e origem usa o
 * índice support_ticket_tenant.
 */
create or replace function support_unread_tickets(p_tenant uuid, p_origin text)
returns setof uuid
language sql stable security invoker set search_path = public as $$
  select t.id
    from support_ticket t
    left join support_read r on r.ticket_id = t.id and r.profile_id = auth.uid()
   where t.tenant_id = p_tenant
     and t.origin = p_origin
     and exists (
       select 1 from support_message m
        where m.ticket_id = t.id
          and m.author_kind = 'ADMIN'
          and not m.internal
          and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
     );
$$;

-- ---------------------------------------------------------------------
-- Resposta do cliente, agora com anexo opcional
-- ---------------------------------------------------------------------

drop function reply_support_ticket(uuid, text);

/**
 * Resposta do cliente num chamado que ele enxerga. Reabre se estava
 * resolvido. Com anexo: o servidor do app já subiu o arquivo no bucket
 * (service role, tipo conferido pelos bytes) em `<chamado>/<uuid>.<ext>`; aqui
 * só se confere que o objeto existe nesse chamado, ainda sem registro, e o
 * registro sai na mesma transação da mensagem. Devolve o id da mensagem.
 */
create or replace function reply_support_ticket(
  p_ticket    uuid,
  p_body      text,
  p_file_path text default null,
  p_file_name text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_body   text := btrim(coalesce(p_body, ''));
  v_ticket support_ticket;
  v_name   text;
  v_mime   text;
  v_size   integer;
  v_file   text;
  v_msg    uuid;
begin
  if v_uid is null or not can_see_support_ticket(p_ticket) then
    raise exception 'Chamado não encontrado.' using errcode = '42501';
  end if;
  if char_length(v_body) > 5000 then
    raise exception 'A mensagem precisa ter até 5.000 caracteres.' using errcode = 'P0001';
  end if;
  if v_body = '' and p_file_path is null then
    raise exception 'Escreva a mensagem ou anexe um arquivo.' using errcode = 'P0001';
  end if;
  if (select count(*) from support_message
       where author_id = v_uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Muitas mensagens em pouco tempo. Aguarde um pouco.' using errcode = 'P0001';
  end if;

  if p_file_path is not null then
    if p_file_path !~ ('^' || p_ticket::text || '/[0-9a-f-]{36}\.(png|jpg|webp|pdf)$')
       or exists (select 1 from support_attachment where storage_path = p_file_path) then
      raise exception 'Anexo inválido.' using errcode = 'P0001';
    end if;
    select o.metadata ->> 'mimetype', (o.metadata ->> 'size')::integer
      into v_mime, v_size
      from storage.objects o
     where o.bucket_id = 'support' and o.name = p_file_path;
    if not found or v_mime not in ('image/png', 'image/jpeg', 'image/webp', 'application/pdf') then
      raise exception 'Anexo inválido.' using errcode = 'P0001';
    end if;
    v_file := left(btrim(regexp_replace(coalesce(p_file_name, ''), '[[:cntrl:]/\\]', '', 'g')), 160);
    if v_file = '' then
      v_file := 'anexo';
    end if;
  end if;

  select * into v_ticket from support_ticket where id = p_ticket for update;
  if v_ticket.status = 'CLOSED' then
    raise exception 'Este chamado foi encerrado. Abra um novo, se precisar.' using errcode = 'P0001';
  end if;

  if v_ticket.origin = 'TUTOR' then
    select full_name into v_name from tutor
     where profile_id = v_uid and tenant_id = v_ticket.tenant_id limit 1;
  else
    select full_name into v_name from profile where id = v_uid;
  end if;

  insert into support_message (ticket_id, author_kind, author_id, author_name, body)
  values (p_ticket, 'CUSTOMER', v_uid, v_name, v_body)
  returning id into v_msg;

  if p_file_path is not null then
    insert into support_attachment (ticket_id, message_id, storage_path, file_name, mime_type, size_bytes, uploaded_by)
    values (p_ticket, v_msg, p_file_path, v_file, v_mime, v_size, v_uid);
  end if;

  update support_ticket
     set status = case when status in ('WAITING_CUSTOMER', 'RESOLVED') then 'IN_PROGRESS' else status end,
         resolved_at = case when status = 'RESOLVED' then null else resolved_at end,
         last_customer_message_at = now(),
         updated_at = now()
   where id = p_ticket;

  -- Quem responde leu a conversa até aqui.
  insert into support_read (ticket_id, profile_id, last_read_at)
  values (p_ticket, v_uid, now())
  on conflict (ticket_id, profile_id) do update set last_read_at = excluded.last_read_at;

  return v_msg;
end $$;

-- ---------------------------------------------------------------------
-- Encerramento pelo cliente
-- ---------------------------------------------------------------------

/**
 * O cliente encerra o próprio chamado (resolvido ou não) e, se quiser, avalia
 * o atendimento. Encerrado não recebe mais resposta de nenhum dos lados.
 */
create or replace function close_support_ticket(
  p_ticket  uuid,
  p_rating  integer default null,
  p_comment text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
  v_ticket  support_ticket;
  v_name    text;
begin
  if v_uid is null or not can_see_support_ticket(p_ticket) then
    raise exception 'Chamado não encontrado.' using errcode = '42501';
  end if;
  if p_rating is not null and p_rating not between 1 and 5 then
    raise exception 'A avaliação vai de 1 a 5 estrelas.' using errcode = 'P0001';
  end if;
  if char_length(v_comment) > 1000 then
    raise exception 'O comentário precisa ter até 1.000 caracteres.' using errcode = 'P0001';
  end if;

  select * into v_ticket from support_ticket where id = p_ticket for update;
  if v_ticket.status = 'CLOSED' then
    raise exception 'Este chamado já foi encerrado.' using errcode = 'P0001';
  end if;

  if v_ticket.origin = 'TUTOR' then
    select full_name into v_name from tutor
     where profile_id = v_uid and tenant_id = v_ticket.tenant_id limit 1;
  else
    select full_name into v_name from profile where id = v_uid;
  end if;

  update support_ticket
     set status = 'CLOSED',
         resolved_at = coalesce(resolved_at, now()),
         satisfaction_rating = p_rating,
         satisfaction_comment = v_comment,
         updated_at = now()
   where id = p_ticket;

  insert into support_message (ticket_id, author_kind, body)
  values (p_ticket, 'SYSTEM', format(
    '%s encerrou o chamado%s.',
    coalesce(v_name, 'O cliente'),
    case when p_rating is null then ''
         else format(' e avaliou o atendimento com %s de 5', p_rating) end
  ));
end $$;

revoke execute on function mark_support_read(uuid) from public, anon;
revoke execute on function support_unread_tickets(uuid, text) from public, anon;
revoke execute on function reply_support_ticket(uuid, text, text, text) from public, anon;
revoke execute on function close_support_ticket(uuid, integer, text) from public, anon;
grant execute on function mark_support_read(uuid) to authenticated;
grant execute on function support_unread_tickets(uuid, text) to authenticated;
grant execute on function reply_support_ticket(uuid, text, text, text) to authenticated;
grant execute on function close_support_ticket(uuid, integer, text) to authenticated;
