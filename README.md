# MyLivePet · Pet Live Pro

Plataforma para o mercado pet (SaaS multi-tenant) composta por dois produtos que compartilham a mesma base de dados:

- **Pet Live Pro** (`apps/pro-web`) — CRM/gestão do petshop (B2B).
- **MyLivePet** (`apps/tutor-pwa`) — app do tutor (B2C, PWA): histórico, agendamento, feedbacks, reserva de produtos e (Fase 2) câmera ao vivo.

Backend gerenciado: **Supabase** (Postgres + Auth + Storage + Realtime). Isolamento multi-tenant via **Row Level Security**.

## Estrutura

```
apps/
  pro-web/      Next.js — painel do petshop (staff)
  tutor-pwa/    Next.js (PWA) — app do tutor
packages/
  ui/           design system (branding MyLivePet)
  types/        tipos do banco (gerados) + DTOs (zod)
  config/       tailwind preset + tsconfig compartilhados
supabase/
  migrations/   schema + RLS
  seed.sql      dados iniciais (tenant piloto)
```

## Setup

Pré-requisitos: Node >= 20, pnpm, e (para o Supabase local) Docker Desktop + Supabase CLI.

```bash
pnpm install

# Banco local (precisa de Docker):
pnpm db:start          # sobe o Supabase local
pnpm db:reset          # aplica migrations + seed
pnpm db:types          # gera os tipos TypeScript do schema

# Copie as chaves impressas por `db:start` para apps/*/.env.local (ver .env.example)
pnpm dev               # sobe pro-web e tutor-pwa
```

Sem Docker, use um projeto Supabase na nuvem: aplique as migrations com `supabase db push` e preencha `.env.local` com a URL/anon key do projeto.

## Branding

Cores e tipografia derivam do documento de branding (grafite `#1F2A33`, laranja `#FF6A00`; fontes Manrope/Inter/Sora). Tokens em `packages/config`.
