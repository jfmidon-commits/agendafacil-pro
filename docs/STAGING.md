# 🚀 AgendaFácil Pro — Ambiente de Staging

## 📋 Status verificado

Última validação: **30/08/2026**.

| Serviço | Status | Referência |
|---------|--------|------------|
| Frontend + API (Vercel) | ✅ Operacional | `https://agendafacil-staging-pearl.vercel.app` |
| Banco + Auth (Supabase) | ✅ Operacional | migrations aplicadas + RLS otimizada |
| Booking público | ✅ E2E 10/10 | `booking.e2e.test.ts` |
| Onboarding autenticado | ✅ E2E 3/3 | `onboarding-auth.e2e.test.ts` |
| Cancelamento pelo proprietário | ✅ E2E 3/3 | `owner-cancellation.e2e.test.ts` |
| Fluxo profissional UI | ✅ Playwright verde | `e2e/professional-flow.spec.ts` |
| Stripe TEST | ✅ E2E de ponta a ponta verde | `e2e/billing-flow.spec.ts` |
| Make / WhatsApp | 🟡 Código pronto, credencial/webhook externo pendente | readiness automático |

O ambiente está classificado como **beta técnica validada do núcleo de agendamento e cobrança**. Booking público, concorrência, cancelamentos, bloqueios de agenda, limite do plano Free, onboarding autenticado, jornada completa do profissional e ciclo Stripe TEST são exercitados automaticamente no staging.

## 🗄️ Banco de Dados

As migrations do Supabase estão versionadas em `web/supabase/migrations/` e aplicadas no staging.

Estruturas centrais incluem:

```text
profiles              → perfis de usuário (dados privados)
public_profiles       → perfis públicos (negócio, slug, descrição, cidade)
services              → serviços oferecidos
availability_rules    → disponibilidade semanal
schedule_blocks       → bloqueios de agenda
appointments          → agendamentos
subscriptions         → estado de assinatura/plano + periodicidade
integration_events    → outbox/retry de integrações
stripe_events         → idempotência e estado dos webhooks Stripe
```

O banco usa RLS e funções/RPCs para operações privilegiadas e transacionais. A proteção contra dupla reserva é garantida no PostgreSQL, não apenas na interface.

### Hardening/performance validado

- policies RLS preservam as mesmas permissões, com `auth.uid()` inicializado uma vez por query;
- `appointments(service_id)` possui índice de cobertura para a FK;
- índice duplicado de `integration_events(appointment_id,event_type)` foi removido, preservando a restrição única original;
- advisors de performance do Supabase ficaram sem WARNs após a migration `20260831012625_optimize_rls_and_indexes.sql`;
- tabelas internas `integration_events` e `stripe_events` permanecem sem policies de cliente por desenho: RLS bloqueia acesso direto e operações internas usam service role.

Permanece como recomendação de segurança da plataforma ativar **Leaked Password Protection** no Supabase Auth quando o plano do projeto suportar esse recurso.

## 🔧 Variáveis de Ambiente

Nunca versione valores reais. `web/.env.example` serve apenas como referência de nomes.

### Base operacional

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `CANCEL_SIGNING_SECRET`
- `CRON_SECRET`

O deploy de staging sincroniza as variáveis críticas de runtime com a Vercel antes de publicar.

### Stripe TEST — operacional

- `STRIPE_SECRET_KEY` — chave exclusivamente TEST;
- `STRIPE_WEBHOOK_SECRET` — webhook de staging validado;
- lookup key `agendafacil_pro_monthly` — validada;
- lookup key `agendafacil_pro_annual` — validada;
- Customer Portal TEST — configurado e validado.

Overrides opcionais:

- `STRIPE_PRICE_PRO_MONTHLY`;
- `STRIPE_PRICE_PRO_ANNUAL`;
- `STRIPE_PRICE_STUDIO_MONTHLY` — reservado para fase futura.

### Make / WhatsApp — única integração externa pendente

Para fechar o readiness externo ainda são necessários:

- `MAKE_APPOINTMENT_WEBHOOK_URL`;
- `MAKE_REMINDER_WEBHOOK_URL` ou fallback efetivo pelo webhook de appointment.

Opcional:

- `MAKE_BILLING_WEBHOOK_URL`.

O endpoint protegido `/api/health/integrations` retorna somente presença/ausência das configurações; nenhum segredo é exibido.

## 🧪 Validação automática

Após um deploy de staging bem-sucedido, os workflows executam:

1. **Staging E2E — API/Domain** — 16 cenários do núcleo (10 público + 3 onboarding/auth + 3 cancelamento proprietário).
2. **Staging E2E — Professional UI + Billing** — fluxo completo do profissional em mobile e ciclo Stripe TEST.
3. **Integration Readiness** — verifica Make e Stripe no runtime. Atualmente Stripe está verde e Make permanece pendente.

### Cenários E2E atualmente verdes

**Público (10 testes):**
- slug inexistente com estado amigável;
- ausência de vazamento de erro interno;
- listagem apenas de slots válidos;
- rejeição de horário fora da grade;
- bloqueio de agenda respeitado na listagem e na reserva direta;
- concorrência de reserva com exatamente `201 + 409`;
- cancelamento atômico concorrente com `200 + 409` e liberação do slot;
- serviço inativo tratado como indisponível;
- limite mensal do plano Free;
- cenário temporário de setup validado.

**Autenticado (6 testes):**
- onboarding bloqueado sem sessão;
- onboarding completo cria perfil, serviço e agenda;
- edição de configurações preserva dados existentes;
- cancelamento pelo dono com autoria e evento de integração;
- proteção contra cancelamento por outro usuário;
- rejeição de duplo cancelamento.

**Profissional UI:**
- login com credenciais reais;
- onboarding pela interface;
- dashboard, link público e contador de agendamentos;
- edição das configurações do negócio;
- criação de serviço adicional;
- disponibilidade semanal;
- booking público em viewport mobile;
- agendamento visível no dashboard;
- cancelamento pelo profissional;
- logout e re-login com persistência;
- ausência de overflow horizontal nos viewports auditados.

**Stripe TEST — billing E2E:**
- criação de Checkout Session pelo endpoint real do app;
- criação de cliente e assinatura de teste sem cobrança real;
- webhook → Supabase com idempotência;
- plano Pro mensal e periodicidade `month`;
- troca mensal → anual pelo endpoint real;
- plano Pro anual e periodicidade `year`;
- Customer Portal;
- cancelamento ao fim do período;
- persistência correta de `current_period_start/end` no formato atual da API Stripe;
- limpeza automática dos dados sintéticos ao final do teste.

### Signup real pela UI

O signup real pela UI (`/signup`) existe como **smoke test opcional** e é acionado manualmente via `workflow_dispatch` com flag `run_signup_ui`. Não roda em todo deploy para evitar rate limit de e-mail do Supabase.

## 🚀 Como executar E2E localmente

```bash
cd web

RUN_STAGING_E2E=1 npx vitest run lib/domain/*.e2e.test.ts

RUN_STAGING_E2E=1 npx playwright test \
  e2e/professional-flow.spec.ts \
  e2e/copy-link.spec.ts \
  e2e/dashboard-mobile-audit.spec.ts \
  e2e/billing-flow.spec.ts
```

Requer credenciais de staging configuradas em `.env.local`.

## 🔄 CI/CD

- **Web CI**: ESLint + TypeScript + testes unitários + build.
- **Deploy Staging Fixed**: disparado em alterações relevantes na `main` e manualmente.
- Antes do deploy, variáveis críticas são sincronizadas com a Vercel.
- Após o deploy, E2E de domínio e Playwright rodam automaticamente no mesmo SHA publicado.
- Node 24 nos workflows atuais.

## 📝 Próximas prioridades

1. [ ] Configurar Make/WhatsApp no staging e comprovar entrega real de confirmação e lembrete.
2. [x] Configurar Stripe TEST com webhook e lookup keys Pro mensal/anual.
3. [x] Validar ciclo de cobrança completo: checkout → webhook → assinatura → troca mensal/anual → portal → cancelamento.
4. [x] Otimizar RLS e índices do Supabase sem regressão funcional.
5. [ ] Fazer beta com profissionais-alvo depois que Make/WhatsApp estiver verde.
