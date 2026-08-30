# AgendaFácil Pro

Micro-SaaS de agendamentos para profissionais autônomos no Brasil, com foco em simplicidade, mobile e fluxo WhatsApp-first.

## Estado atual

A implementação principal é **Next.js + Supabase**, em `web/`. O legado Firebase/FlutterFlow/Python permanece temporariamente na raiz apenas como referência de migração.

Em **30/08/2026**, o staging foi validado como **beta técnica do núcleo de agendamento**:

- deploy Vercel operacional;
- Supabase/Auth/RLS e migrations operacionais;
- E2E de domínio com **16/16 testes verdes** (10 booking público + 3 onboarding/auth + 3 cancelamento proprietário);
- Playwright de fluxo profissional UI **1/1 verde** em viewport mobile (390×844), com validação de overflow horizontal;
- reserva concorrente protegida no banco;
- cancelamento atômico e liberação de slot validados;
- bloqueios de agenda e limite mensal do plano Free validados;
- health-check protegido de integrações operacional;
- signup real pela UI como smoke test opcional (não executado em todo deploy para evitar rate limit de e-mail).

As pendências atuais estão concentradas nas **configurações externas de Make/WhatsApp e Stripe**, não no motor de booking nem no fluxo do profissional.

## Arquitetura

- Next.js 15 + TypeScript
- Supabase Auth + PostgreSQL + RLS
- Booking transacional via RPC
- Constraint PostgreSQL contra dupla reserva
- Stripe com webhooks assinados e idempotência (resolução de preços por lookup keys; overrides opcionais via env)
- Make como orquestrador WhatsApp, com outbox/retry
- Vercel para app, APIs e crons
- GitHub Actions para CI, deploy, E2E e readiness de integrações

Leia `docs/ARCHITECTURE_DECISION.md`, `docs/ROADMAP.md` e `docs/STAGING.md`.

## MVP vertical slice

1. usuário cria conta;
2. configura negócio, serviço e disponibilidade;
3. recebe slug/link público;
4. cliente escolhe serviço/data/slot;
5. `/api/book` cria agendamento com transação e limite de plano;
6. profissional acompanha a agenda no dashboard;
7. eventos de integração entram no outbox com retry/idempotência;
8. Make entrega confirmação e lembretes quando os webhooks estiverem configurados;
9. Stripe mantém `subscriptions` como fonte oficial da assinatura paga quando as credenciais e lookup keys forem configurados.

## Estrutura

```text
web/                         # implementação principal
  app/                       # páginas e APIs Next.js
  lib/                       # Supabase, Stripe, integrações e domínio
  e2e/                       # Playwright — fluxo profissional UI
  supabase/migrations/       # schema, RLS e funções transacionais
  vercel.json                # crons
docs/                        # ADR, roadmap, staging e integrações
legacy (raiz atual)          # Firebase/FlutterFlow/Python durante migração
```

## Qualidade e validação

O pipeline do projeto inclui:

- ESLint;
- TypeScript;
- testes unitários (Vitest);
- build Next.js;
- deploy automatizado do staging;
- E2E de domínio no SHA efetivamente publicado (16 testes Vitest);
- E2E de UI no SHA publicado (1 teste Playwright, viewport mobile);
- `Integration Readiness` para verificar Make/Stripe sem revelar valores de segredo.

O E2E de staging cobre, entre outros cenários, slots válidos, bloqueios, concorrência, cancelamento atômico, serviço inativo, limite Free, onboarding autenticado, cancelamento pelo proprietário e jornada completa do profissional pela interface.

## Segurança

Nenhuma credencial real deve ser commitada. Use `web/.env.example` apenas como lista de variáveis e mantenha valores reais nos provedores/secret stores.

Operações privilegiadas usam RLS/RPCs e credenciais server-only. O endpoint de readiness informa somente se determinada configuração existe; ele não retorna os valores.

## Próximo passo para beta externa

O motor de agendamento e o fluxo do profissional já passaram a validação técnica de staging. Para avançar para usuários reais, falta fechar as integrações externas:

1. configurar o webhook de appointment do Make/WhatsApp e validar confirmação real;
2. garantir o webhook efetivo de lembretes;
3. configurar Stripe em modo de teste com `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`;
4. configurar lookup keys Pro mensal (`agendafacil_pro_monthly`) e Pro anual (`agendafacil_pro_annual`);
5. executar o ciclo de cobrança completo no staging;
6. iniciar beta controlada com profissionais-alvo.

Consulte `docs/STAGING.md` para o status verificável e a lista atual de pendências.
