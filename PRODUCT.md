# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

O usuário principal é o **dono de petshop brasileiro** (banho e tosa, com ou sem
loja de produtos e leva-e-traz) que hoje toca a operação no WhatsApp, caderno e
planilha. Ele decide a compra e cria a conta sozinho. Dentro do sistema também
trabalham colaboradores (banhistas, tosadores, atendentes) e o entregador do
leva-e-traz, cada um com seu painel.

Público secundário: o **tutor** (dono do pet), que usa o app do tutor oferecido
pelo petshop. Ele não é o comprador, mas é o motivo de muitas decisões do dono.

## Product Purpose

Um só produto, **Pet Live Pro**, com duas faces sobre a mesma base de dados:

- **Painel do petshop** (`apps/pro-web`, app.petlivepro.com.br) — gestão do petshop:
  agenda e atendimentos com checklist, tutores e pets, serviços com preço por
  porte e adicionais, Clubinho (assinaturas/pacotes recorrentes), produtos com
  variações e estoque, vendas de balcão, receitas e despesas, colaboradores,
  solicitações dos tutores, leva-e-traz com rota no mapa e boletim de
  comportamento do pet.
- **App do tutor** (`apps/tutor-pwa`, tutor.petlivepro.com.br) — PWA:
  agendar, acompanhar o pet **ao vivo pela câmera** durante o banho/tosa,
  acompanhar o leva-e-traz "a caminho", histórico, boletins, reservar produtos,
  Clubinho.

Sucesso: o petshop opera o dia inteiro num só lugar e o tutor confia mais,
volta mais e compra mais porque enxerga o que acontece com o pet.

## Positioning

O sistema de petshop que deixa o tutor **ver**: câmera ao vivo do atendimento,
leva-e-traz rastreado e boletim do pet no celular do tutor, ligados à gestão
completa do petshop. A transparência vira argumento de venda do próprio petshop.

## Operating Context

O dia do petshop é corrido, cheio de pets chegando e saindo, banho, secagem,
tosa, entregas e mensagens. O dono usa celular e um PC no balcão. Câmeras Tapo
C200 nas salas, ligadas por um gateway local.

## Capabilities and Constraints

- Cadastro self-serve do petshop em `app.petlivepro.com.br/cadastrar` (CTA principal da landing).
- Câmera ao vivo: WebRTC (~1s no projeto, ainda não medido com câmera real; na comunicação usar "quase em tempo real"), gravações com retenção 7/15/30 dias, consentimento LGPD.
- Stack: monorepo pnpm/turbo, Next.js, Tailwind, `@mylivepet/ui` (nome interno de pacote, não aparece para o usuário); Supabase.
- Landing pública: novo app `apps/landing`, domínio raiz `petlivepro.com.br`.

## Brand Commitments

- Nome: **Pet Live Pro** em todo o sistema (painel do petshop, app do tutor e landing), seguindo o domínio petlivepro.com.br. "MyLivePet" é um nome antigo e não deve aparecer para o usuário; no painel, o app usado pelo tutor é chamado de "app do tutor".
- Slogan: **Transparência e cuidado**.
- Logo em `public/brand/logopet.svg` (símbolo play + cão + sinal, nome "Pet Live Pro" com "Pro" em laranja e o slogan) e favicon `faviconpet.svg` (só o símbolo) — nunca trocados por ícone genérico. Versão para fundo escuro: `apps/landing/public/brand/logopet-white.svg`.
- Cores do branding: grafite `#1F2A33` (base), laranja `#FF6A00` (destaque/CTA), petróleo `#1D4E5F` (confiança), cinza `#66717C`, cinza claro `#F4F6F8`.
- Fontes do branding: Manrope (títulos), Inter (texto/UI), Sora (destaques).

## Evidence on Hand

- Sem métricas públicas, clientes citáveis ou depoimentos confirmados. Não inventar
  clientes, depoimentos, logos de parceiros, números, imprensa ou selos.
- Preço/planos: definidos pelo dono do produto, valores a confirmar antes de publicar.
- Ativos reais: o próprio produto (telas do painel e do app do tutor) e o logo.
- Valores ilustrativos dentro de mock-ups do produto são permitidos quando claramente demonstração.

## Anti-references

Nada de landing de pet "fofinha" genérica (patinhas espalhadas, cachorro sorrindo
em fundo pastel, ossinhos). Nada de SaaS genérico com gradiente roxo, cards iguais
e "IA" vaga. O petshop é um negócio sério e corrido — a página deve parecer feita
por quem conhece o balcão.
