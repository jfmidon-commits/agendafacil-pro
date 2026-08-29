# AgendaFácil Pro — Web MVP

Implementação principal em Next.js + Supabase.

## Rodar localmente

1. Crie um projeto Supabase.
2. Aplique, em ordem, os arquivos de `supabase/migrations/`.
3. Copie `.env.example` para `.env.local` e preencha apenas localmente.
4. `npm install`
5. `npm run dev`

## Vertical slice

`/signup` → `/onboarding` → cadastro de serviço/horários → `/{slug}` → `/api/book` → `/dashboard`.

## Segurança

- dados privados: `profiles`, `appointments`, `subscriptions` com RLS;
- públicos: `public_profiles` e serviços ativos;
- `availability_rules` e `schedule_blocks` não são lidos anonimamente;
- `appointments` não possui permissão de INSERT para `anon`/`authenticated`;
- booking público ocorre somente pela RPC `book_appointment`;
- exclusion constraint + advisory lock impedem dupla reserva e corrida no limite Free.

## Deploy

Root Directory no Vercel: `web`.

Configure os secrets listados em `.env.example`; nunca use chaves reais em arquivos versionados.

Stripe webhook: `POST /api/stripe/webhook`.

Crons estão em `vercel.json`. Se o plano Vercel não suportar a frequência configurada, use Supabase Cron ou Make para chamar os mesmos endpoints com `Authorization: Bearer $CRON_SECRET`.
