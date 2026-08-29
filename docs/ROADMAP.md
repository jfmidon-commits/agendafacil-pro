# Backlog / Milestones — AgendaFácil Pro

Os issues já existentes são preservados. A execução passa a seguir esta ordem, com a migração Next.js + Supabase como implementação principal.

## Sprint 0 — Segurança + Banco

- #1 Separar dados públicos/privados
- #2 Corrigir regras de segurança
- #3 Availability rules e schedule blocks
- #4 `appointments`: `startsAt`, `endsAt`, timezone
- Base Supabase, RLS, migrations e política de secrets

**Saída:** schema reproduzível, sem criação pública direta de appointment, dados privados protegidos.

## Sprint 1 — Motor + Fluxo

- #5 API `/api/book`
- #6 Motor de disponibilidade
- #7 Vertical slice completo
- #8 Dashboard do profissional

**Saída:** cadastro → serviço → horários → link público → booking → painel.

## Sprint 2 — WhatsApp + Stripe

- #9 Make + WhatsApp
- #10 ciclo completo Stripe

**Saída:** confirmação/lembrete/cancelamento e assinatura paga sincronizada.

## Sprint 3 — Planos + Trial

- #11 plan/trial/limite Free
- #12 downgrade/expiração

**Saída:** 10 bookings/mês no Free; trial e assinatura resolvidos sem estado ambíguo.

## Sprint 4 — Landing + Beta

- #13 landing
- #14 beta

**Saída:** onboarding público e teste com usuários reais.

## Arquitetura / Organização

- #15 decisão de arquitetura — resolvida por `docs/ARCHITECTURE_DECISION.md`
- #16 `.gitignore`/secrets — manter e ampliar conforme novas ferramentas forem incluídas

> Nota: os objetos "Milestone" do GitHub ainda precisam ser vinculados aos issues na interface/API de administração. Este arquivo é a fonte versionada do planejamento e evita que a ordem dependa apenas da configuração do GitHub.
