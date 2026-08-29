# AgendaFácil Pro

Micro-SaaS de agendamentos para profissionais autônomos no Brasil.

## Estado real do projeto

O repositório tinha uma prova de conceito baseada em FlutterFlow/Firebase, composta principalmente por documentação e scripts Python. O código exportado do frontend FlutterFlow não estava versionado; por isso a afirmação antiga de “100% MVP pronto para deploy” não era reproduzível a partir do GitHub.

A implementação principal passa a ser **Next.js + Supabase**, em `web/`. O legado Firebase/FlutterFlow permanece temporariamente na raiz para referência e migração.

## Nova arquitetura

- Next.js + TypeScript
- Supabase Auth + PostgreSQL + RLS
- Booking transacional via RPC
- Constraint PostgreSQL contra dupla reserva
- Stripe com webhooks assinados e idempotência
- Make como orquestrador WhatsApp, com outbox/retry
- Vercel para app/API/crons

Leia `docs/ARCHITECTURE_DECISION.md` e `docs/ROADMAP.md`.

## MVP vertical slice

1. usuário cria conta;
2. configura negócio, serviço e disponibilidade;
3. recebe slug/link público;
4. cliente escolhe serviço/data/slot;
5. `/api/book` cria agendamento com transação e limite de plano;
6. profissional vê e atualiza sua agenda no dashboard;
7. Make recebe confirmação/lembretes/cancelamentos;
8. Stripe mantém `subscriptions` como fonte oficial de verdade da assinatura paga.

## Estrutura

```text
web/                         # implementação principal
  app/                       # páginas e APIs Next.js
  lib/                       # Supabase, Stripe, integrações e domínio
  supabase/migrations/       # schema, RLS e funções transacionais
  vercel.json                # crons
legacy (raiz atual)          # Firebase/FlutterFlow/Python durante migração
docs/                        # ADR, roadmap e integrações
```

## Segurança

Nenhuma credencial real deve ser commitada. Use `web/.env.example` apenas como lista de variáveis e configure valores reais no Supabase/Vercel/Stripe/Make.

## Próximo passo para beta

Aplicar as migrations em um projeto Supabase, configurar variáveis no Vercel, cadastrar os Price IDs do Stripe e informar os webhooks do Make. Depois executar o teste vertical completo e só então migrar/arquivar o legado Firebase.
