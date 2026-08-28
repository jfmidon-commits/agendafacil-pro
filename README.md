# 🚀 AgendaFácil Pro v2.0

> **Micro-SaaS de agendamentos para profissionais autônomos.**
> Seu link de agendamento profissional em 2 minutos. Clientes marcam sozinhos, você só confirma.

---

## 📁 Estrutura do Repositório

```
agendafacil-pro/
├── README.md                    # Este arquivo
├── .gitignore                   # Ignora credenciais e arquivos sensíveis
├── setup_firebase.py            # Script de setup do banco de dados
├── firestore_rules.txt          # Regras de segurança do Firestore
├── data_structure.json          # Documentação da estrutura de dados
├── api_book.py                  # Cloud Function: API de agendamento segura
├── availability_engine.py       # Motor de disponibilidade
├── stripe_webhooks.py           # Handler de webhooks do Stripe
├── plan_limits.py               # Verificador de limites de plano
├── flutterflow_guide.md         # Guia de configuração do FlutterFlow
└── make_automation_guide.md     # Guia de automações no Make
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

### Decisão de Arquitetura
> **FlutterFlow para MVP rápido** (Sprints 0-4). Avaliação de migração para **Next.js + Supabase** após validação do produto.

**Prós do FlutterFlow:**
- ✅ Desenvolvimento rápido (sem código)
- ✅ Integração nativa com Firebase
- ✅ Deploy automático

**Contras (documentados para migração futura):**
- ⚠️ Controle limitado de versão
- ⚠️ Dificuldade em testes automatizados
- ⚠️ Lock-in na plataforma
- ⚠️ Customizações complexas exigem código nativo

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

### Campos Principais

**appointments (v2.0):**
- `startsAt` / `endsAt` (timestamps com timezone)
- `serviceDuration` + `bufferBefore` + `bufferAfter` = `totalDuration`
- `timezone`: `'America/Sao_Paulo'`
- `cancelledAt` / `cancelledBy`: rastreamento de cancelamentos

---

## 🔒 Segurança

### Regras do Firestore
- **Dados privados** (`users`, `subscriptions`): apenas dono autenticado
- **Dados públicos** (`publicProfiles`, `services`): leitura aberta
- **Agendamentos**: criação **BLOQUEADA** diretamente; apenas via API `/api/book`
- **Transações atômicas**: prevenção de race conditions e dupla reserva

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
2. Configurar webhook URL: `https://sua-regiao-sua-funcao.cloudfunctions.net/stripe_webhooks`
3. Adicionar `STRIPE_WEBHOOK_SECRET` nas variáveis de ambiente

### 4. FlutterFlow
1. Conectar ao Firebase
2. Importar tema e componentes
3. Publicar no Firebase Hosting

---

## 📋 Backlog por Sprints

| Sprint | Foco | Status |
|--------|------|--------|
| **Sprint 0** | Segurança + Banco de Dados | 🚧 Em andamento |
| **Sprint 1** | Motor de Disponibilidade + Fluxo | ⏳ Pendente |
| **Sprint 2** | WhatsApp + Stripe | ⏳ Pendente |
| **Sprint 3** | Planos + Trial | ⏳ Pendente |
| **Sprint 4** | Landing Page + Beta | ⏳ Pendente |

---

## 📝 Licença

Proprietário - AgendaFácil Pro

---

**Feito com ❤️ para profissionais autônomos do Brasil.**
