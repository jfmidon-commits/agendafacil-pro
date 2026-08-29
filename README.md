# AgendaFácil Pro

Micro-SaaS de agendamentos para profissionais autônomos no Brasil, com foco em simplicidade, mobile e fluxo WhatsApp-first.

## Estado atual

A implementação principal é **Next.js + Supabase**, em `web/`. O legado Firebase/FlutterFlow/Python permanece temporariamente na raiz apenas como referência de migração.

Em **29/08/2026**, o staging do núcleo de agendamento foi validado como **beta técnica**:

- deploy Vercel operacional;
- Supabase/Auth/RLS e migrations operacionais;
- E2E público com **10/10 testes verdes**;
- reserva concorrente protegida no banco;
- cancelamento atômico e liberação de slot validados;
- bloqueios de agenda e limite mensal do plano Free validados;
- health-check protegido de integrações operacional.

As pendências atuais estão concentradas nas **configurações externas de Make/WhatsApp e Stripe**, não no motor de booking.

## Arquitetura

- Next.js 15 + TypeScript
- Supabase Auth + PostgreSQL + RLS
- Booking transacional via RPC
- Constraint PostgreSQL contra dupla reserva
- Stripe com webhooks assinados e idempotência
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
9. Stripe mantém `subscriptions` como fonte oficial da assinatura paga quando as credenciais e Price IDs forem configurados.

## Estrutura

```text
web/                         # implementação principal
  app/                       # páginas e APIs Next.js
  lib/                       # Supabase, Stripe, integrações e domínio
  supabase/migrations/       # schema, RLS e funções transacionais
  vercel.json                # crons
docs/                        # ADR, roadmap, staging e integrações
legacy (raiz atual)          # Firebase/FlutterFlow/Python durante migração
```

## Qualidade e validação

O pipeline do projeto inclui:

- ESLint;
- TypeScript;
- testes unitários;
- build Next.js;
- deploy automatizado do staging;
- E2E do booking público no SHA efetivamente publicado;
- `Integration Readiness` para verificar Make/Stripe sem revelar valores de segredo.

O E2E de staging cobre, entre outros cenários, slots válidos, bloqueios, concorrência, cancelamento atômico, serviço inativo e limite Free.

## Segurança

Nenhuma credencial real deve ser commitada. Use `web/.env.example` apenas como lista de variáveis e mantenha valores reais nos provedores/secret stores.

Operações privilegiadas usam RLS/RPCs e credenciais server-only. O endpoint de readiness informa somente se determinada configuração existe; ele não retorna os valores.

## Próximo passo para beta externa

O motor de agendamento já passou a validação técnica de staging. Para avançar para usuários reais, falta fechar as integrações externas:

1. configurar o webhook de appointment do Make/WhatsApp e validar confirmação real;
2. garantir o webhook efetivo de lembretes;
3. configurar Stripe em modo de teste com `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`;
4. configurar os Price IDs Pro mensal e Pro anual;
5. executar o ciclo de cobrança completo no staging;
6. iniciar beta controlada com profissionais-alvo.

Consulte `docs/STAGING.md` para o status verificável e a lista atual de pendências.
