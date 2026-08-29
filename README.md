# 🚀 AgendaFácil Pro v2.0

> **Micro-SaaS de agendamentos para profissionais autônomos.**
> Seu link de agendamento profissional em 2 minutos. Clientes marcam sozinhos, você só confirma.

---

## 📊 Status do Projeto: 100% MVP

| Sprint | Foco | Status | Progresso |
|--------|------|--------|-----------|
| **Sprint 0** | Segurança + Banco de Dados | ✅ Concluído | 100% |
| **Sprint 1** | Motor de Disponibilidade + Fluxo | ✅ Concluído | 100% |
| **Sprint 2** | WhatsApp + Stripe | ✅ Concluído | 100% |
| **Sprint 3** | Planos + Trial | ✅ Concluído | 100% |
| **Sprint 4** | Landing Page + Beta | ✅ Concluído | 100% |

**🎉 MVP COMPLETO E PRONTO PARA DEPLOY!**

---

## 📁 Estrutura Completa do Repositório

```
agendafacil-pro/
├── README.md                          # Este arquivo
├── .gitignore                         # Ignora credenciais
│
├── 📁 backend/                        # Cloud Functions Python
│   ├── setup_firebase.py              # Setup inicial do banco
│   ├── api_book.py                    # API de agendamento segura
│   ├── availability_engine.py         # Motor de disponibilidade
│   ├── stripe_webhooks.py             # Handler Stripe completo
│   ├── stripe_checkout.py             # Criação de checkout Stripe
│   ├── trial_manager.py               # Downgrade automático de trial
│   ├── check_limits_api.py            # Verificador de limites
│   └── plan_limits.py                 # Lógica de planos
│
├── 📁 docs/                           # Documentação
│   ├── flutterflow_guide.md           # Guia geral FlutterFlow
│   ├── flutterflow_sprint1.md         # Telas do fluxo vertical slice
│   ├── make_automation_guide.md       # Guia geral Make
│   ├── make_automation_sprint2.md     # Automações WhatsApp/Stripe
│   ├── beta_testing_guide.md          # Guia de teste beta
│   └── data_structure.json            # Estrutura do banco de dados
│
├── 📁 landing/                        # Landing Page
│   └── landing_page.html              # Página de vendas completa
│
├── 📁 config/                         # Configurações
│   └── firestore_rules.txt            # Regras de segurança
│
└── 📁 .github/workflows/              # CI/CD
    └── setup-firebase.yml             # Workflow de setup automático
```

---

## 🏗️ Arquitetura

### Stack Atual (MVP)
| Camada | Tecnologia | Status |
|--------|-----------|--------|
| **Frontend** | FlutterFlow (No-Code) | ✅ Configurado |
| **Backend** | Firebase (Firestore + Auth + Hosting) | ✅ Configurado |
| **API** | Cloud Functions (Python) | ✅ 7 funções prontas |
| **Pagamentos** | Stripe | ✅ Ciclo completo |
| **Automações** | Make + WhatsApp API | ✅ 5 cenários |
| **Banco de Dados** | Firestore (NoSQL) | ✅ Estrutura v2.0 |
| **Landing Page** | HTML/CSS (Carrd) | ✅ Pronta |

---

## 🗄️ Estrutura de Dados (v2.0)

### Separação de Dados Públicos/Privados

| Coleção | Tipo | Acesso | Descrição |
|---------|------|--------|-----------|
| `users` | 🔒 Privado | Apenas dono | Dados pessoais, plano, trial |
| `publicProfiles` | 🌐 Público | Qualquer um | Perfil do negócio, horários, slug |
| `services` | 🌐/🔒 | Leitura pública, escrita dono | Serviços oferecidos |
| `availabilityRules` | 🌐/🔒 | Leitura pública, escrita dono | Regras de disponibilidade |
| `scheduleBlocks` | 🌐/🔒 | Leitura pública, escrita dono | Bloqueios (folga, almoço) |
| `appointments` | 🔒 Privado | Apenas via API `/api/book` | Agendamentos v2.0 |
| `subscriptions` | 🔒 Privado | Apenas webhooks Stripe | Assinaturas (fonte da verdade) |

### Campos Principais v2.0

**appointments:**
```json
{
  "userId": "prof-id",
  "serviceId": "service-id",
  "serviceName": "Corte de Cabelo",
  "serviceDuration": 30,
  "bufferBefore": 5,
  "bufferAfter": 5,
  "totalDuration": 40,
  "clientName": "João",
  "clientPhone": "+5511988888888",
  "startsAt": "2026-08-29T14:00:00-03:00",
  "endsAt": "2026-08-29T14:30:00-03:00",
  "timezone": "America/Sao_Paulo",
  "status": "confirmed",
  "reminderSent": false,
  "cancelledAt": null,
  "cancelledBy": null
}
```

---

## 🔒 Segurança

### Regras do Firestore
- ✅ **Dados privados** (`users`, `subscriptions`): apenas dono autenticado
- ✅ **Dados públicos** (`publicProfiles`, `services`): leitura aberta
- ✅ **Agendamentos**: criação **BLOQUEADA** diretamente; apenas via API `/api/book`
- ✅ **Transações atômicas**: prevenção de race conditions e dupla reserva
- ✅ **Separação público/privado**: nenhum dado sensível exposto

### API Segura `/api/book`
```
POST /api/book
{
  "userId": "profissional-id",
  "serviceId": "servico-id",
  "clientName": "João",
  "clientPhone": "+5511988888888",
  "startsAt": "2026-08-29T14:00:00-03:00"
}
```

Validações:
- ✅ Disponibilidade do horário
- ✅ Conflito com agendamentos existentes
- ✅ Conflito com bloqueios (scheduleBlocks)
- ✅ Operação atômica (transação Firestore)
- ✅ Prevenção de dupla reserva

---

## 💳 Stripe - Ciclo Completo

| Evento | Ação | Status |
|--------|------|--------|
| `checkout.session.completed` | Criar subscription, ativar plano | ✅ |
| `invoice.payment_succeeded` | Renovar período, manter ativo | ✅ |
| `invoice.payment_failed` | Marcar past_due, notificar usuário | ✅ |
| `customer.subscription.deleted` | Reverter para Free | ✅ |
| `customer.subscription.updated` | Atualizar plano (upgrade/downgrade) | ✅ |

**Fonte oficial da verdade:** `subscriptions` (não `users.plan`)

---

## 📱 Planos e Limites

| Plano | Preço | Agendamentos | WhatsApp | Profissionais | Trial |
|-------|-------|-------------|----------|---------------|-------|
| **Free** | R$ 0 | 10/mês | ❌ | 1 | — |
| **Pro** | R$ 39/mês | Ilimitado | ✅ | 1 | 14 dias |
| **Pro Anual** | R$ 348/ano | Ilimitado | ✅ | 1 | — |
| **Studio** | R$ 79/mês | Ilimitado | ✅ | Múltiplos | — |

**Trial:** 14 dias (tratado como Pro automaticamente)

**Downgrade automático:**
- Trial expirado → Free
- Assinatura cancelada → Free
- Falha de pagamento → alerta + 3 dias de tolerância → Free

---

## 🤖 Automações (Make)

| Cenário | Trigger | Ação |
|---------|---------|------|
| **Novo agendamento** | Webhook Firestore | WhatsApp cliente + profissional |
| **Lembrete** | Schedule diário 09:00 | WhatsApp no dia anterior |
| **Trial expirando** | Schedule diário 10:00 | E-mail 4 dias antes |
| **Falha de pagamento** | Webhook Stripe | WhatsApp + e-mail de alerta |
| **Cancelamento** | Link seguro | Notificação ao profissional |

---

## 🎨 Telas do FlutterFlow (8 telas)

1. **Onboarding Step 1** - Cadastro (nome, e-mail, WhatsApp, negócio)
2. **Onboarding Step 2** - Serviços (seleção + personalização)
3. **Onboarding Step 3** - Horários (dias da semana + pausas)
4. **Onboarding Success** - Link gerado + copiar
5. **Booking Page** - Página pública (serviço → data → horário → dados)
6. **Booking Success** - Confirmação + add ao calendário
7. **Dashboard** - Painel do profissional (agendamentos, stats, ações)
8. **Add Appointment** - Adicionar manualmente

**Fluxo vertical slice:** Cadastro → Serviços → Horários → Link → Cliente reserva → Profissional visualiza

**Tempo total do cadastro ao primeiro agendamento: < 2 minutos**

---

## 🚀 Deploy Passo a Passo

### 1. Setup Firebase
```bash
# Clone o repositório
git clone https://github.com/jfmidon-commits/agendafacil-pro.git
cd agendafacil-pro

# Instalar dependências
pip install firebase-admin

# Configurar Service Account
# Coloque o arquivo .json na pasta e execute:
python backend/setup_firebase.py
```

### 2. Configurar Regras de Segurança
1. Acesse: https://console.firebase.google.com/project/agendafacil-pro/firestore/rules
2. Cole o conteúdo de `config/firestore_rules.txt`
3. Clique em "Publicar"

### 3. Deploy Cloud Functions
```bash
# API de agendamento
gcloud functions deploy api_book \
  --source=backend/api_book.py \
  --runtime python311 --trigger-http --allow-unauthenticated

# Webhooks Stripe
gcloud functions deploy stripe_webhooks \
  --source=backend/stripe_webhooks.py \
  --runtime python311 --trigger-http --allow-unauthenticated

# Checkout Stripe
gcloud functions deploy create_checkout \
  --source=backend/stripe_checkout.py \
  --runtime python311 --trigger-http --allow-unauthenticated

# Verificador de limites
gcloud functions deploy check_limits \
  --source=backend/check_limits_api.py \
  --runtime python311 --trigger-http --allow-unauthenticated

# Gerenciador de trial
gcloud functions deploy trial_manager \
  --source=backend/trial_manager.py \
  --runtime python311 --trigger-http --allow-unauthenticated

# Agendador diário (Cloud Scheduler)
gcloud scheduler jobs create http trial-check \
  --schedule="0 9 * * *" \
  --uri="https://sua-regiao.cloudfunctions.net/trial_manager" \
  --http-method=POST
```

### 4. Configurar Stripe
1. Criar produtos no Stripe Dashboard:
   - Pro Mensal: R$ 39/mês
   - Pro Anual: R$ 348/ano
   - Studio: R$ 79/mês
2. Configurar webhook URL: `https://sua-funcao.cloudfunctions.net/stripe_webhooks`
3. Adicionar `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` nas variáveis de ambiente

### 5. FlutterFlow
1. Acesse: https://app.flutterflow.io
2. Conectar ao Firebase (usar firebaseConfig)
3. Seguir guia em `docs/flutterflow_sprint1.md`
4. Publicar no Firebase Hosting

### 6. Make (Automações)
1. Acesse: https://make.com
2. Seguir guia em `docs/make_automation_sprint2.md`
3. Configurar webhooks e WhatsApp API

### 7. Landing Page
1. Acesse: https://carrd.co
2. Importar `landing/landing_page.html`
3. Configurar domínio personalizado (opcional)

---

## 📋 Backlog Completo (14 Issues)

Todas as issues estão organizadas em milestones no GitHub:

| # | Issue | Sprint | Status |
|---|-------|--------|--------|
| 1 | Separar dados públicos/privados | Sprint 0 | ✅ |
| 2 | Corrigir regras de segurança | Sprint 0 | ✅ |
| 3 | Adicionar availabilityRules e scheduleBlocks | Sprint 0 | ✅ |
| 4 | Ajustar appointments para startsAt/endsAt | Sprint 0 | ✅ |
| 5 | Implementar API /api/book | Sprint 1 | ✅ |
| 6 | Motor de disponibilidade com buffers | Sprint 1 | ✅ |
| 7 | Fluxo vertical slice completo | Sprint 1 | ✅ |
| 8 | Painel do profissional | Sprint 1 | ✅ |
| 9 | Webhook Firestore → Make → WhatsApp | Sprint 2 | ✅ |
| 10 | Ciclo completo Stripe | Sprint 2 | ✅ |
| 11 | Separar plan/trialStatus/trialEndsAt | Sprint 3 | ✅ |
| 12 | Downgrade automático | Sprint 3 | ✅ |
| 13 | Landing page no Carrd | Sprint 4 | ✅ |
| 14 | Teste beta com 5 profissionais | Sprint 4 | ✅ |

---

## 📈 Métricas de Sucesso

| Métrica | Meta M1 | Meta M3 | Meta M6 |
|---------|---------|---------|---------|
| Visitantes Landing Page | 500 | 3.000 | 10.000 |
| Cadastros (trial) | 50 | 300 | 1.000 |
| Taxa de conversão | 10% | 15% | 20% |
| MRR | R$ 195 | R$ 1.755 | R$ 7.800 |
| Churn mensal | < 8% | < 5% | < 3% |

---

## 📝 Licença

Proprietário - AgendaFácil Pro

---

**Feito com ❤️ para profissionais autônomos do Brasil.**

> *"Seus clientes marcam sozinhos. Você só confirma."*
