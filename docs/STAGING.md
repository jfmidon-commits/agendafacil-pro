# 🚀 AgendaFácil Pro — Ambiente de Staging

## 📋 Status verificado

Última validação: **29/08/2026**.

| Serviço | Status | Referência |
|---------|--------|------------|
| Frontend + API (Vercel) | ✅ Operacional | `https://agendafacil-staging-pearl.vercel.app` |
| Banco + Auth (Supabase) | ✅ Operacional | projeto de staging configurado |
| Booking público | ✅ E2E 10/10 | GitHub Actions `Staging E2E Public Booking` |
| Make / WhatsApp | 🟡 Código pronto, configuração externa pendente | readiness automático |
| Stripe | 🟡 Código pronto, configuração externa pendente | readiness automático |

O ambiente está classificado como **beta técnica do núcleo de agendamento**. O fluxo público, concorrência, cancelamento, bloqueios de agenda e limite do plano Free são exercitados automaticamente no staging.

## 🗄️ Banco de Dados

As migrations do Supabase estão versionadas em `web/supabase/migrations/` e já foram aplicadas no ambiente de staging.

Estruturas centrais incluem:

```text
profiles             → perfis de usuário
businesses            → negócios cadastrados
professionals         → profissionais
services              → serviços oferecidos
availability          → disponibilidade semanal
schedule_blocks       → bloqueios de agenda
appointments          → agendamentos
subscriptions         → estado de assinatura/plano
integration_events    → outbox/retry de integrações
```

O banco usa RLS e funções/RPCs para operações privilegiadas e transacionais. A proteção contra dupla reserva é garantida no PostgreSQL, não apenas na interface.

## 🔧 Variáveis de Ambiente

Nunca versione valores reais. `web/.env.example` serve apenas como referência de nomes.

### Base já operacional

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `CANCEL_SIGNING_SECRET`
- `CRON_SECRET`

O deploy de staging sincroniza `CRON_SECRET` e `NEXT_PUBLIC_APP_URL` com o runtime de produção do projeto Vercel antes de publicar.

### Pendências verificadas pelo Integration Readiness

Obrigatórias para fechar as integrações externas:

- `MAKE_APPOINTMENT_WEBHOOK_URL`
- `MAKE_REMINDER_WEBHOOK_URL` ou fallback efetivo pelo webhook de appointment
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PRO_MONTHLY`
- `STRIPE_PRICE_PRO_ANNUAL`

Opcionais nesta fase:

- `MAKE_BILLING_WEBHOOK_URL`
- `STRIPE_PRICE_STUDIO_MONTHLY`

O endpoint protegido `/api/health/integrations` retorna apenas presença/ausência das configurações; nenhum segredo é exibido.

## 🧪 Validação automática

Após um deploy de staging bem-sucedido, dois workflows são executados:

1. **Staging E2E Public Booking** — valida 10 cenários do núcleo de reserva.
2. **Integration Readiness** — verifica se Make e Stripe possuem a configuração mínima necessária.

### Cenários E2E atualmente verdes

- slug inexistente com estado amigável;
- ausência de vazamento de erro interno;
- listagem apenas de slots válidos;
- rejeição de horário fora da grade;
- bloqueio de agenda na listagem e na reserva direta;
- concorrência de reserva com exatamente `201 + 409`;
- cancelamento atômico concorrente com `200 + 409` e liberação do slot;
- serviço inativo tratado como indisponível;
- limite mensal do plano Free;
- fluxo complementar coberto pelo conjunto E2E do booking.

## 👤 Teste manual de aceitação

Quando necessário validar UX além dos testes automatizados:

1. acessar `/signup`;
2. criar a conta;
3. concluir o onboarding do negócio;
4. cadastrar serviço, por exemplo **Corte — 30 min — R$35**;
5. definir disponibilidade;
6. abrir `/{slug}` sem login;
7. realizar uma reserva;
8. confirmar o agendamento no dashboard;
9. testar reserva concorrente do mesmo horário.

## 🔄 CI/CD

- **Web CI**: ESLint + TypeScript + testes + build.
- **Deploy Staging Fixed**: disparado em alterações relevantes na `main` e também manualmente.
- Antes do deploy, as variáveis críticas de runtime são sincronizadas com a Vercel.
- Após o deploy, E2E e Integration Readiness rodam automaticamente no mesmo SHA publicado.

## 📝 Próximas prioridades

1. [ ] Configurar Make/WhatsApp no staging e comprovar entrega real de confirmação e lembrete.
2. [ ] Configurar Stripe em modo de teste, incluindo webhook e Price IDs Pro mensal/anual.
3. [ ] Executar ciclo de cobrança completo em staging: checkout → webhook → assinatura → portal/troca/cancelamento.
4. [ ] Fazer beta com profissionais-alvo depois que as integrações externas estiverem verdes.
