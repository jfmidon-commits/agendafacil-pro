# 🚀 AgendaFácil Pro v2.0

> **Micro-SaaS de agendamentos para profissionais autônomos.**
> Seu link de agendamento profissional em 2 minutos. Clientes marcam sozinhos, você só confirma.

---

## 📊 Status dos Sprints

| Sprint | Foco | Status | Progresso |
|--------|------|--------|-----------|
| **Sprint 0** | Segurança + Banco de Dados | ✅ Concluído | 100% |
| **Sprint 1** | Motor de Disponibilidade + Fluxo | 🚧 Em andamento | 80% |
| **Sprint 2** | WhatsApp + Stripe | 🚧 Em andamento | 60% |
| **Sprint 3** | Planos + Trial | ⏳ Pendente | 0% |
| **Sprint 4** | Landing Page + Beta | ⏳ Pendente | 0% |

---

## 📁 Estrutura do Repositório

```
agendafacil-pro/
├── README.md                          # Este arquivo
├── .gitignore                         # Ignora credenciais
├── setup_firebase.py                  # Setup do banco v2.0
├── firestore_rules.txt               # Regras de segurança
├── data_structure.json               # Documentação do banco
├── api_book.py                       # API de agendamento segura
├── availability_engine.py            # Motor de disponibilidade
├── stripe_webhooks.py                # Handler Stripe completo
├── plan_limits.py                    # Verificador de limites
├── flutterflow_guide.md              # Guia FlutterFlow geral
├── make_automation_guide.md          # Guia Make geral
├── docs/
│   ├── flutterflow_sprint1.md       # Telas do fluxo vertical slice
│   └── make_automation_sprint2.md   # Automações WhatsApp/Stripe
└── .github/workflows/
    └── setup-firebase.yml            # CI/CD para setup
```

---

## 🏗️ Arquitetura

### Stack Atual (MVP)
| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | FlutterFlow (No-Code) |
| **Backend** | Firebase (Firestore + Auth + Hosting) |
| **API** | Cloud Functions (Python) |
| **Pagamentos** | Stripe |
| **Automações** | Make (ex-Integromat) + WhatsApp API |
| **Banco de Dados** | Firestore (NoSQL) |

---

## 🗄️ Estrutura de Dados (v2.0)

### Separação de Dados Públicos/Privados

| Coleção | Tipo | Acesso |
|---------|------|--------|
| `users` | Privado | Apenas dono |
| `publicProfiles` | Público | Qualquer um |
| `services` | Público (leitura) | Dono (escrita) |
| `availabilityRules` | Público (leitura) | Dono (escrita) |
| `scheduleBlocks` | Público (leitura) | Dono (escrita) |
| `appointments` | Privado | Apenas via API `/api/book` |
| `subscriptions` | Privado | Apenas webhooks Stripe |

---

## 🔒 Segurança

### Regras do Firestore
- **Dados privados** (`users`, `subscriptions`): apenas dono autenticado
- **Dados públicos** (`publicProfiles`, `services`): leitura aberta
- **Agendamentos**: criação **BLOQUEADA** diretamente; apenas via API `/api/book`
- **Transações atômicas**: prevenção de race conditions e dupla reserva

---

## 💳 Stripe - Ciclo Completo

| Evento | Ação |
|--------|------|
| `checkout.session.completed` | Criar subscription, ativar plano |
| `invoice.payment_succeeded` | Renovar período, manter ativo |
| `invoice.payment_failed` | Marcar past_due, notificar usuário |
| `customer.subscription.deleted` | Reverter para Free |
| `customer.subscription.updated` | Atualizar plano (upgrade/downgrade) |

**Fonte oficial da verdade:** `subscriptions` (não `users.plan`)

---

## 📱 Planos e Limites

| Plano | Preço | Agendamentos | WhatsApp | Profissionais |
|-------|-------|-------------|----------|---------------|
| **Free** | R$ 0 | 10/mês | ❌ | 1 |
| **Pro** | R$ 39/mês | Ilimitado | ✅ | 1 |
| **Pro Anual** | R$ 348/ano | Ilimitado | ✅ | 1 |
| **Studio** | R$ 79/mês | Ilimitado | ✅ | Múltiplos |

**Trial:** 14 dias (tratado como Pro)

---

## 🤖 Automações (Make)

1. **Novo agendamento** → Confirmação WhatsApp (cliente + profissional)
2. **Lembrete** → Dia anterior ao agendamento (calculado a partir de `startsAt`)
3. **Trial expirando** → Alerta por e-mail 4 dias antes
4. **Falha de pagamento** → Alerta WhatsApp para atualizar cartão
5. **Cancelamento** → Notificação ao profissional

---

## 🚀 Deploy

### 1. Setup Firebase
```bash
pip install firebase-admin
python setup_firebase.py
```

### 2. Deploy Cloud Functions
```bash
# API de agendamento
gcloud functions deploy api_book --runtime python311 --trigger-http --allow-unauthenticated

# Webhooks Stripe
gcloud functions deploy stripe_webhooks --runtime python311 --trigger-http --allow-unauthenticated
```

### 3. Configurar Stripe
1. Criar produtos: Pro (R$39/mês), Pro Anual (R$348/ano), Studio (R$79/mês)
2. Configurar webhook URL
3. Adicionar `STRIPE_WEBHOOK_SECRET` nas variáveis de ambiente

### 4. FlutterFlow
1. Conectar ao Firebase
2. Seguir guia em `docs/flutterflow_sprint1.md`
3. Publicar no Firebase Hosting

---

## 📝 Licença

Proprietário - AgendaFácil Pro

---

**Feito com ❤️ para profissionais autônomos do Brasil.**
