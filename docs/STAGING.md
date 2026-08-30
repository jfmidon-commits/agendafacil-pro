# 🚀 AgendaFácil Pro — Ambiente de Staging

## 📋 Status verificado

Última validação: **30/08/2026**.

| Serviço | Status | Referência |
|---------|--------|------------|
| Frontend + API (Vercel) | ✅ Operacional | `https://agendafacil-staging-pearl.vercel.app` |
| Banco + Auth (Supabase) | ✅ Operacional | projeto de staging configurado |
| Booking público | ✅ E2E 10/10 | `booking.e2e.test.ts` |
| Onboarding autenticado | ✅ E2E 3/3 | `onboarding-auth.e2e.test.ts` |
| Cancelamento pelo proprietário | ✅ E2E 3/3 | `owner-cancellation.e2e.test.ts` |
| Fluxo profissional UI | ✅ Playwright 1/1 verde | `e2e/professional-flow.spec.ts` |
| Make / WhatsApp | 🟡 Código pronto, configuração externa pendente | readiness automático |
| Stripe | 🟡 Código pronto, configuração externa pendente | readiness automático |

O ambiente está classificado como **beta técnica validada do núcleo de agendamento**. O fluxo público, concorrência, cancelamento, bloqueios de agenda, limite do plano Free, fluxo autenticado de onboarding e jornada completa do profissional pela UI são exercitados automaticamente no staging.

## 🗄️ Banco de Dados

As migrations do Supabase estão versionadas em `web/supabase/migrations/` e já foram aplicadas no ambiente de staging.

Estruturas centrais incluem:

```text
profiles              → perfis de usuário (dados privados)
public_profiles       → perfis públicos (negócio, slug, descrição, cidade)
services              → serviços oferecidos
availability_rules    → disponibilidade semanal
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

Opcionais (overrides, o app resolve por lookup keys por padrão):

- `STRIPE_PRICE_PRO_MONTHLY` — override do lookup key `agendafacil_pro_monthly`
- `STRIPE_PRICE_PRO_ANNUAL` — override do lookup key `agendafacil_pro_annual`
- `STRIPE_PRICE_STUDIO_MONTHLY` — reservado para fase futura
- `MAKE_BILLING_WEBHOOK_URL`

O endpoint protegido `/api/health/integrations` retorna apenas presença/ausência das configurações; nenhum segredo é exibido.

## 🧪 Validação automática

Após um deploy de staging bem-sucedido, os workflows são executados:

1. **Staging E2E — API/Domain** — valida 16 cenários do núcleo (10 público + 3 onboarding/auth + 3 cancelamento proprietário).
2. **Staging E2E — Professional UI** — valida o fluxo completo do profissional em viewport mobile com Playwright.
3. **Integration Readiness** — verifica se Make e Stripe possuem a configuração mínima necessária.

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

**Profissional UI — Playwright (1 teste, fluxo completo):**
- login com credenciais reais;
- onboarding pela interface (negócio, slug, serviço, preço, duração, horários);
- dashboard com link público, plano e contador de agendamentos;
- edição de configurações do negócio;
- criação de serviço adicional;
- adição de regra de disponibilidade;
- booking público em viewport mobile (390×844);
- agendamento visível no dashboard do profissional;
- cancelamento pelo profissional com atualização de status;
- logout e re-login com persistência de dados;
- validação de ausência de overflow horizontal em cada etapa.

### Signup real pela UI

O signup real pela UI (`/signup`) existe como **smoke test opcional** e é acionado manualmente via `workflow_dispatch` com flag `run_signup_ui`. Não é executado em todo deploy para evitar rate limit de e-mail do Supabase.

## 🚀 Como executar E2E localmente

```bash
cd web
# E2E de domínio (API/REST)
RUN_STAGING_E2E=1 npx vitest run lib/domain/*.e2e.test.ts

# E2E de UI (Playwright)
RUN_STAGING_E2E=1 npx playwright test e2e/professional-flow.spec.ts
```

Requer credenciais de staging configuradas em `.env.local`.

## 🔄 CI/CD

- **Web CI**: ESLint + TypeScript + testes unitários + build.
- **Deploy Staging Fixed**: disparado em alterações relevantes na `main` e também manualmente.
- Antes do deploy, as variáveis críticas de runtime são sincronizadas com a Vercel.
- Após o deploy, E2E de domínio (Vitest) e E2E de UI (Playwright) rodam automaticamente no mesmo SHA publicado.
- Node 24 no workflow de E2E.

## 📝 Próximas prioridades

1. [ ] Configurar Make/WhatsApp no staging e comprovar entrega real de confirmação e lembrete.
2. [ ] Configurar Stripe em modo de teste, incluindo webhook e lookup keys Pro mensal/anual.
3. [ ] Executar ciclo de cobrança completo em staging: checkout → webhook → assinatura → portal/troca/cancelamento.
4. [ ] Fazer beta com profissionais-alvo depois que as integrações externas estiverem verdes.
