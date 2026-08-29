# 🤖 MAKE AUTOMATION GUIDE (SPRINT 2)

## Pré-requisitos
- Conta Make: https://make.com (plano Free = 1.000 ops/mês)
- WhatsApp API: Z-API (https://z-api.io) ou Evolution API
- Stripe: Webhooks configurados

---

## CENÁRIO 1: NOTIFICAÇÃO DE NOVO AGENDAMENTO

### Trigger: Webhook (Firestore → Make)

**Configuração no Make:**
1. Módulo: **Webhooks** → **Custom webhook**
2. Name: `Novo Agendamento - AgendaFácil`
3. URL: `https://hook.make.com/SEU_WEBHOOK_ID`

**Conectar ao Firebase (via Cloud Function ou n8n):**
```python
# Cloud Function: notify_make_on_new_appointment
def notify_make(request):
    appointment = request.get_json()

    # Enviar para Make
    requests.post(
        'https://hook.make.com/SEU_WEBHOOK_ID',
        json={
            'event': 'appointment.created',
            'appointmentId': appointment['id'],
            'clientName': appointment['clientName'],
            'clientPhone': appointment['clientPhone'],
            'serviceName': appointment['serviceName'],
            'startsAt': appointment['startsAt'].isoformat(),
            'professionalName': appointment['professionalName'],
            'professionalPhone': appointment['professionalPhone'],
            'slug': appointment['slug']
        }
    )
    return 'OK'
```

### Ação 1: WhatsApp para CLIENTE

**Módulo:** HTTP → Make a request

```
Method: POST
URL: https://api.z-api.io/instances/SUA_INSTANCE/token/SUA_TOKEN/send-text
Headers: Content-Type: application/json
Body:
{
  "phone": "{{clientPhone}}",
  "message": "✅ *Agendamento Confirmado!*\n\nOlá {{clientName}}!\n\n📅 Data: {{formatDate(startsAt; 'DD/MM/YYYY')}}\n⏰ Horário: {{formatDate(startsAt; 'HH:mm')}}\n💈 Serviço: {{serviceName}}\n📍 Local: {{professionalName}}\n\n⏰ Você receberá um lembrete um dia antes.\n\nPara cancelar, acesse: agendafacil.pro/cancel/{{appointmentId}}"
}
```

> ⚠️ **Cancelamento via link seguro** (não mais por resposta de mensagem)

### Ação 2: WhatsApp para PROFISSIONAL

```
Method: POST
URL: https://api.z-api.io/instances/SUA_INSTANCE/token/SUA_TOKEN/send-text
Body:
{
  "phone": "{{professionalPhone}}",
  "message": "🆕 *Novo Agendamento!*\n\nCliente: {{clientName}}\nServiço: {{serviceName}}\nData: {{formatDate(startsAt; 'DD/MM/YYYY')}} às {{formatDate(startsAt; 'HH:mm')}}\n📱 {{clientPhone}}\n\nAcesse seu painel: agendafacil.pro/dashboard"
}
```

---

## CENÁRIO 2: LEMBRETE (DIA ANTERIOR)

### Trigger: Schedule (Agendado)

**Configuração:**
1. Módulo: **Schedule** → **Run on a schedule**
2. Configure: **Todos os dias às 09:00** (horário de Brasília)

### Ação 1: Buscar agendamentos de amanhã

**Módulo:** Firebase → Search Documents

```
Collection: appointments
Filter 1: startsAt >= {{addDays(now; 1).setHours(0;0;0;0)}}
Filter 2: startsAt < {{addDays(now; 2).setHours(0;0;0;0)}}
Filter 3: status == confirmed
Filter 4: reminderSent == false
```

### Ação 2: Iterar e enviar lembretes

**Módulo:** Flow Control → Iterator

### Ação 3: Enviar lembrete WhatsApp

```
Method: POST
URL: https://api.z-api.io/instances/SUA_INSTANCE/token/SUA_TOKEN/send-text
Body:
{
  "phone": "{{appointment.clientPhone}}",
  "message": "⏰ *Lembrete de Agendamento*\n\nOlá {{appointment.clientName}}!\n\nPassando para lembrar que você tem agendamento *amanhã*:\n\n📅 {{formatDate(appointment.startsAt; 'DD/MM/YYYY')}}\n⏰ {{formatDate(appointment.startsAt; 'HH:mm')}}\n💈 {{appointment.serviceName}}\n📍 {{appointment.professionalName}}\n\nNos vemos lá! 😊"
}
```

### Ação 4: Marcar lembrete como enviado

**Módulo:** Firebase → Update a Document

```
Collection: appointments
Document ID: {{appointment.id}}
Fields:
  reminderSent: true
  reminderSentAt: {{now}}
```

---

## CENÁRIO 3: ALERTA DE TRIAL EXPIRANDO

### Trigger: Schedule (Diário às 10:00)

### Ação 1: Buscar trials que expiram em 4 dias

**Módulo:** Firebase → Search Documents

```
Collection: users
Filter 1: trialStatus == active
Filter 2: trialEndsAt >= {{addDays(now; 4).setHours(0;0;0;0)}}
Filter 3: trialEndsAt < {{addDays(now; 5).setHours(0;0;0;0)}}
```

### Ação 2: Enviar e-mail de conversão

**Módulo:** Mailchimp (ou HTTP para SendGrid/Resend)

**Assunto:** "Seu trial do AgendaFácil Pro acaba em 4 dias 🚀"

**Corpo:**
```html
<h2>Olá {{user.name}}!</h2>
<p>Seu período de testes gratuito do <strong>AgendaFácil Pro</strong> acaba em <strong>4 dias</strong>.</p>
<p>Não perca os benefícios:</p>
<ul>
  <li>✅ Agendamentos ilimitados</li>
  <li>✅ Confirmação automática por WhatsApp</li>
  <li>✅ Lembretes para seus clientes</li>
  <li>✅ Zero no-shows</li>
</ul>
<p><strong>Oferta especial:</strong> Assine agora e ganhe 20% de desconto no primeiro mês!</p>
<a href="https://agendafacil.pro/upgrade?user={{user.id}}&discount=START20" 
   style="background:#10B981;color:white;padding:16px 32px;border-radius:12px;text-decoration:none;">
   Assinar Pro por R$ 31/mês
</a>
```

---

## CENÁRIO 4: FALHA DE COBRANÇA (Stripe)

### Trigger: Webhook Stripe → Make

**URL do webhook no Make:** Configure no Stripe Dashboard

### Ação 1: Receber evento `invoice.payment_failed`

### Ação 2: Buscar usuário

**Módulo:** Firebase → Search Documents

```
Collection: users
Filter: stripeCustomerId == {{stripeEvent.data.object.customer}}
```

### Ação 3: Enviar alerta WhatsApp

```
Method: POST
URL: https://api.z-api.io/instances/SUA_INSTANCE/token/SUA_TOKEN/send-text
Body:
{
  "phone": "{{user.phone}}",
  "message": "⚠️ *Falha no Pagamento*\n\nOlá {{user.name}}!\n\nIdentificamos uma falha na cobrança do seu plano AgendaFácil Pro.\n\nPara não perder o acesso aos recursos premium, atualize seu cartão:\n\n👉 agendafacil.pro/billing\n\nSe precisar de ajuda, responda esta mensagem."
}
```

### Ação 4: Enviar e-mail de alerta

**Assunto:** "⚠️ Falha no pagamento - atualize seu cartão"

---

## CENÁRIO 5: CANCELAMENTO VIA LINK

### Trigger: Webhook (Cloud Function → Make)

Quando o cliente acessa `agendafacil.pro/cancel/{appointmentId}`

### Ação 1: Validar cancelamento

- Verificar se o agendamento existe
- Verificar se está dentro do prazo (ex: até 2h antes)

### Ação 2: Atualizar agendamento

**Módulo:** Firebase → Update a Document

```
Collection: appointments
Document ID: {{appointmentId}}
Fields:
  status: cancelled
  cancelledAt: {{now}}
  cancelledBy: client
```

### Ação 3: Notificar profissional

```
Method: POST
URL: https://api.z-api.io/instances/SUA_INSTANCE/token/SUA_TOKEN/send-text
Body:
{
  "phone": "{{professionalPhone}}",
  "message": "❌ *Agendamento Cancelado*\n\nCliente: {{clientName}}\nServiço: {{serviceName}}\nData: {{formatDate(startsAt; 'DD/MM/YYYY')}} às {{formatDate(startsAt; 'HH:mm')}}\n\nO horário foi liberado para novos agendamentos."
}
```

---

## 📊 Dashboard de Métricas (Make)

Crie um cenário agendado (semanal) para enviar métricas por e-mail:

```
Schedule: Toda segunda-feira às 08:00

Ação 1: Buscar métricas do Firestore
  - Total de agendamentos na semana
  - Taxa de no-shows
  - Faturamento estimado
  - Novos cadastros

Ação 2: Enviar e-mail para você
  Assunto: "📊 Relatório Semanal - AgendaFácil Pro"
```

---

## 🔗 URLs Úteis

| Serviço | URL |
|---------|-----|
| Make | https://make.com |
| Z-API (WhatsApp) | https://z-api.io |
| Evolution API | https://evolution-api.com |
| Stripe Webhooks | https://dashboard.stripe.com/webhooks |
| Mailchimp | https://mailchimp.com |
| Resend (e-mail) | https://resend.com |
