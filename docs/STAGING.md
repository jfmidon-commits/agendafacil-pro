# 🚀 AgendaFácil Pro — Ambiente de Staging

## 📋 Status verificado

Última validação: **31/08/2026**.

| Serviço | Status | Referência |
|---------|--------|------------|
| Frontend + API (Vercel) | ✅ Operacional | `https://agendafacil-staging-pearl.vercel.app` |
| Banco + Auth (Supabase) | ✅ Operacional | migrations aplicadas + RLS otimizada |
| Booking público | ✅ E2E 10/10 | `booking.e2e.test.ts` |
| Onboarding autenticado | ✅ E2E 3/3 | `onboarding-auth.e2e.test.ts` |
| Cancelamento pelo proprietário | ✅ E2E 3/3 | `owner-cancellation.e2e.test.ts` |
| Fluxo profissional UI | ✅ Playwright verde | `e2e/professional-flow.spec.ts` |
| Stripe TEST | ✅ E2E de ponta a ponta verde | `e2e/billing-flow.spec.ts` |
| AgendaFácil → Make | ✅ Entrega real de criação + lembrete | `make-integration.e2e.test.ts` |
| WhatsApp real | 🟡 Provedor ainda não configurado no Make | gate de entrega verificada |

O ambiente está classificado como **beta técnica validada do núcleo de agendamento e cobrança**. Booking público, concorrência, cancelamentos, bloqueios de agenda, limite do plano Free, onboarding autenticado, jornada completa do profissional, ciclo Stripe TEST e transporte AgendaFácil → Make são exercitados automaticamente no staging.

A liberação do beta com profissionais-alvo continua condicionada à **comprovação de uma entrega real de WhatsApp**.

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
integration_settings  → configuração interna server-only de integrações
stripe_events         → idempotência e estado dos webhooks Stripe
```

O banco usa RLS e funções/RPCs para operações privilegiadas e transacionais. A proteção contra dupla reserva é garantida no PostgreSQL, não apenas na interface.

### Hardening/performance validado

- policies RLS preservam as mesmas permissões, com `auth.uid()` inicializado uma vez por query;
- `appointments(service_id)` possui índice de cobertura para a FK;
- índice duplicado de `integration_events(appointment_id,event_type)` foi removido, preservando a restrição única original;
- advisors de performance do Supabase ficaram sem WARNs após a migration `20260831012625_optimize_rls_and_indexes.sql`;
- tabelas internas `integration_events`, `integration_settings` e `stripe_events` permanecem sem policies de cliente por desenho: RLS bloqueia acesso direto e operações internas usam service role.

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

### Make / WhatsApp

O webhook de appointment do Make está configurado no staging por armazenamento interno server-only no Supabase e já foi validado por E2E real. O mesmo webhook funciona como fallback de lembrete.

Overrides suportados por variável de ambiente:

- `MAKE_APPOINTMENT_WEBHOOK_URL`;
- `MAKE_REMINDER_WEBHOOK_URL` — opcional, dedicado a lembretes;
- `MAKE_BILLING_WEBHOOK_URL` — opcional.

O AgendaFácil envia ao Make um bloco `whatsapp` com telefone normalizado em E.164 e mensagem pronta para cliente/profissional. A credencial do provedor WhatsApp permanece exclusivamente no Make.

O ponto externo ainda pendente é conectar um provedor real (Meta Cloud API, Z-API, Evolution API ou equivalente) ao cenário e provar uma mensagem entregue. Somente depois dessa prova deve existir o marcador interno `whatsapp_delivery_verified_at`.

O endpoint protegido `/api/health/integrations` retorna somente estados booleanos; nenhum webhook, token ou outro segredo é exibido.

## 🧪 Validação automática

Após um deploy de staging bem-sucedido, os workflows executam:

1. **Staging E2E — API/Domain** — núcleo de booking/auth/cancelamento + entrega real ao webhook do Make para criação e lembrete.
2. **Staging E2E — Professional UI + Billing** — fluxo completo do profissional em mobile e ciclo Stripe TEST.
3. **Integration Readiness** — exige app, Make, **entrega WhatsApp previamente comprovada** e Stripe no runtime. Enquanto o provedor de WhatsApp não estiver configurado e validado, este gate deve permanecer vermelho de propósito.

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

**Make:**
- reserva pelo endpoint real cria `appointment.created`;
- runtime de staging entrega o evento ao webhook real do Make;
- lembrete `appointment.reminder_due` é entregue ao Make;
- payload inclui telefones E.164 e mensagens WhatsApp prontas;
- tentativas, `delivered_at` e `last_error` são verificados;
- dados sintéticos são removidos ao final.

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

1. [ ] Conectar provedor WhatsApp ao cenário Make e comprovar entrega real de confirmação e lembrete.
2. [ ] Registrar `whatsapp_delivery_verified_at` somente após a prova real e deixar Integration Readiness verde.
3. [x] Configurar Stripe TEST com webhook e lookup keys Pro mensal/anual.
4. [x] Validar ciclo de cobrança completo: checkout → webhook → assinatura → troca mensal/anual → portal → cancelamento.
5. [x] Otimizar RLS e índices do Supabase sem regressão funcional.
6. [ ] Fazer beta com profissionais-alvo depois que WhatsApp estiver verde.
