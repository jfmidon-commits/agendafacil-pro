═══════════════════════════════════════════════════════════════
  AGENDAFÁCIL PRO - GUIA DE AUTOMAÇÃO NO MAKE (ex-Integromat)
═══════════════════════════════════════════════════════════════

📋 PRÉ-REQUISITOS
───────────────────────────────────────────────────────────────
- Conta no Make: https://make.com (plano Free = 1.000 ops/mês)
- WhatsApp API: Z-API (https://z-api.io) ou Evolution API
- Webhook URL do Make (gerado automaticamente)


═══════════════════════════════════════════════════════════════
CENÁRIO 1: NOTIFICAÇÃO DE NOVO AGENDAMENTO
═══════════════════════════════════════════════════════════════

Trigger: Webhook (HTTP)
───────────────────────
1. No Make, crie um novo cenário
2. Adicione o módulo "Webhooks" → "Custom webhook"
3. Clique em "Add" → Name: "Novo Agendamento - AgendaFácil"
4. Copie a URL do webhook (ex: https://hook.make.com/abc123...)

Ação 1: Enviar WhatsApp para o CLIENTE
───────────────────────────────────────
Módulo: HTTP → Make a request

Method: POST
URL: https://api.z-api.io/instances/SUA_INSTANCE/token/SUA_TOKEN/send-text
Headers: Content-Type: application/json
Body (JSON):
{
  "phone": "{{clientPhone}}",
  "message": "✅ *Agendamento Confirmado!*\n\nOlá {{clientName}}! Seu agendamento foi confirmado:\n\n📅 Data: {{date}}\n⏰ Horário: {{time}}\n💈 Serviço: {{serviceName}}\n\n📍 {{professionalName}}\n\n⏰ Você receberá um lembrete 24h antes.\n\nPara cancelar, responda CANCELAR."
}

Ação 2: Enviar WhatsApp para o PROFISSIONAL
────────────────────────────────────────────
Módulo: HTTP → Make a request

Method: POST
URL: https://api.z-api.io/instances/SUA_INSTANCE/token/SUA_TOKEN/send-text
Headers: Content-Type: application/json
Body (JSON):
{
  "phone": "{{professionalPhone}}",
  "message": "🆕 *Novo Agendamento!*\n\nCliente: {{clientName}}\nServiço: {{serviceName}}\nData: {{date}} às {{time}}\n\nAcesse seu painel: agendafacil.pro/dashboard"
}


═══════════════════════════════════════════════════════════════
CENÁRIO 2: LEMBRETE 24H ANTES DO AGENDAMENTO
═══════════════════════════════════════════════════════════════

Trigger: Schedule (Agendado)
────────────────────────────
1. Adicione módulo "Schedule" → "Run on a schedule"
2. Configure: Todos os dias às 09:00

Ação 1: Buscar agendamentos de amanhã
──────────────────────────────────────
Módulo: Firebase → Search Documents

Collection: appointments
Filter 1: date is equal to → tomorrow (use addDays(now; 1))
Filter 2: reminderSent is equal to → false
Filter 3: status is equal to → confirmed

Ação 2: Iterar sobre agendamentos
──────────────────────────────────
Módulo: Flow Control → Iterator

Ação 3: Enviar lembrete WhatsApp
────────────────────────────────
Módulo: HTTP → Make a request

Method: POST
URL: https://api.z-api.io/instances/SUA_INSTANCE/token/SUA_TOKEN/send-text
Body:
{
  "phone": "{{clientPhone}}",
  "message": "⏰ *Lembrete de Agendamento*\n\nOlá {{clientName}}! Passando para lembrar que você tem agendamento amanhã:\n\n📅 {{date}}\n⏰ {{time}}\n💈 {{serviceName}}\n\n📍 {{professionalName}}\n\nNos vemos lá! 😊"
}

Ação 4: Marcar lembrete como enviado
────────────────────────────────────
Módulo: Firebase → Update a Document

Collection: appointments
Document ID: {{appointmentId}}
Fields to update:
  reminderSent: true


═══════════════════════════════════════════════════════════════
CENÁRIO 3: ALERTA DE TRIAL EXPIRANDO
═══════════════════════════════════════════════════════════════

Trigger: Schedule (Agendado)
────────────────────────────
Todos os dias às 10:00

Ação 1: Buscar trials que expiram em 4 dias
────────────────────────────────────────────
Módulo: Firebase → Search Documents

Collection: users
Filter 1: plan is equal to → free
Filter 2: trialEndsAt is equal to → addDays(now; 4)

Ação 2: Enviar e-mail de conversão
──────────────────────────────────
Módulo: Mailchimp (ou HTTP para API de e-mail)

Assunto: "Seu trial do AgendaFácil Pro acaba em 4 dias"
Corpo: E-mail persuasivo com CTA para assinar


═══════════════════════════════════════════════════════════════
CENÁRIO 4: WEBHOOK STRIPE → ATUALIZAR ASSINATURA
═══════════════════════════════════════════════════════════════

Trigger: Webhook (HTTP)
───────────────────────
URL do webhook: (configure no Stripe Dashboard)

Ação 1: Verificar tipo de evento
────────────────────────────────
Módulo: Tools → Set variable
Condition: {{event.type}} == "checkout.session.completed"

Ação 2: Atualizar assinatura no Firestore
─────────────────────────────────────────
Módulo: Firebase → Update a Document

Collection: users
Document ID: {{customer.metadata.userId}}
Fields:
  plan: {{subscription.metadata.plan}}
  subscriptionStatus: "active"
  trialEndsAt: null


═══════════════════════════════════════════════════════════════
  ✅ AUTOMAÇÕES CONFIGURADAS!
═══════════════════════════════════════════════════════════════
