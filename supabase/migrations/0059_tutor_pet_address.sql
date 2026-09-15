-- =====================================================================
-- Endereço do tutor e do pet.
--
-- Nasce estruturado (e não um `address text` como o do petshop em
-- tenant_settings) porque o endereço do cliente é operacional: leva-e-traz
-- escolhe rota por bairro, e um dia a nota fiscal vai exigir CEP e UF
-- separados. Texto livre resolveria hoje e travaria os dois amanhã.
--
-- O número é `text`: existe "s/n", "123-A" e "km 7" — integer perderia
-- todos eles.
--
-- HERANÇA DO PET: pet com as sete colunas nulas mora com o tutor, e é o
-- endereço do tutor que vale. Não há flag booleana para isso — ela seria
-- um segundo lugar onde a mesma verdade poderia divergir (flag marcada e
-- rua preenchida, e aí qual manda?). Preencher qualquer coluna do pet
-- significa endereço próprio: o pet fica na casa de um parente, num
-- hotel, ou o tutor se mudou e o pet não.
--
-- O CEP é gravado só com dígitos, igual ao cpf de 0026 — a máscara é da
-- tela, não do banco. O trigger normaliza o que chega por fora do
-- formulário (import, SQL manual) para o check não virar uma armadilha.
-- =====================================================================

alter table tutor
  add column cep           text,
  add column street        text,
  add column street_number text,
  add column complement    text,
  add column district      text,
  add column city          text,
  add column state         text;

alter table pet
  add column cep           text,
  add column street        text,
  add column street_number text,
  add column complement    text,
  add column district      text,
  add column city          text,
  add column state         text;

comment on column pet.cep is
  'Endereço próprio do pet. As sete colunas nulas = mora com o tutor, e vale o endereço dele.';

-- ---------------------------------------------------------------------
-- Normalização: CEP só com dígitos, UF em maiúsculas, campo vazio vira
-- null (string vazia passaria pelo `is null` dos checks e sujaria as
-- telas com endereços "meio preenchidos").
-- ---------------------------------------------------------------------
create or replace function normalize_address_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.cep           := nullif(regexp_replace(coalesce(new.cep, ''), '\D', '', 'g'), '');
  new.state         := nullif(upper(btrim(coalesce(new.state, ''))), '');
  new.street        := nullif(btrim(coalesce(new.street, '')), '');
  new.street_number := nullif(btrim(coalesce(new.street_number, '')), '');
  new.complement    := nullif(btrim(coalesce(new.complement, '')), '');
  new.district      := nullif(btrim(coalesce(new.district, '')), '');
  new.city          := nullif(btrim(coalesce(new.city, '')), '');
  return new;
end;
$$;

create trigger tutor_normalize_address
  before insert or update of cep, street, street_number, complement, district, city, state
  on tutor
  for each row execute function normalize_address_fields();

create trigger pet_normalize_address
  before insert or update of cep, street, street_number, complement, district, city, state
  on pet
  for each row execute function normalize_address_fields();

alter table tutor
  add constraint tutor_cep_digits check (cep is null or cep ~ '^[0-9]{8}$'),
  add constraint tutor_state_uf   check (state is null or state ~ '^[A-Z]{2}$');

alter table pet
  add constraint pet_cep_digits check (cep is null or cep ~ '^[0-9]{8}$'),
  add constraint pet_state_uf   check (state is null or state ~ '^[A-Z]{2}$');
