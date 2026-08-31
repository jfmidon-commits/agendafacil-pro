# Make + WhatsApp — integração v2

Na arquitetura Next.js + Supabase, o Firestore deixa de ser o gatilho principal. O app cria um evento em `integration_events` na mesma transação do booking e tenta entregá-lo ao Make. Falhas ficam no outbox e são repetidas pelo cron `/api/cron/integrations`.

## Webhooks

O runtime aceita configuração por variável de ambiente e, no staging, também por configuração privada server-only do Supabase:

- `MAKE_APPOINTMENT_WEBHOOK_URL`: confirmação, cancelamento e fallback de lembrete
- `MAKE_REMINDER_WEBHOOK_URL`: opcional, dedicado a lembretes
- `MAKE_BILLING_WEBHOOK_URL`: falha de cobrança Stripe

### `appointment.created`

O Make recebe os dados canônicos do agendamento e também um bloco `whatsapp` pronto para mapear em um módulo do provedor:

```json
{
  "event": "appointment.created",
  "eventType": "appointment_created",
  "appointment": {
    "id": "uuid",
    "service": "Corte",
    "startsAt": "2026-09-01T13:00:00Z",
    "endsAt": "2026-09-01T13:30:00Z",
    "timezone": "America/Sao_Paulo",
    "client": {"name":"João","phone":"(51) 99999-9999","email":"..."},
    "cancelUrl": "https://app.exemplo/cancel/..."
  },
  "professional": {
    "name":"Maria",
    "phone":"51 98888-7777",
    "businessName":"Studio Maria"
  },
  "whatsapp": {
    "client": {
      "to": "+5551999999999",
      "message": "✅ *Agendamento confirmado!* ..."
    },
    "professional": {
      "to": "+5551988887777",
      "message": "🆕 *Novo agendamento!* ..."
    }
  }
}
```

No Make, o cenário não precisa mais remontar texto ou normalizar telefone. Ele deve apenas:

1. rotear por `eventType`;
2. enviar `whatsapp.client.message` para `whatsapp.client.to` quando `client` não for nulo;
3. enviar `whatsapp.professional.message` para `whatsapp.professional.to` quando `professional` não for nulo;
4. manter a credencial do provedor exclusivamente dentro do Make.

O link seguro de cancelamento já vem incorporado na mensagem de confirmação quando ainda é válido. Não instruir o cliente a responder "CANCELAR" enquanto não existir parser seguro de mensagens recebidas.

## Lembrete

`/api/cron/reminders` roda a cada 15 minutos e procura agendamentos entre 23h45 e 24h15 à frente. Isso implementa o requisito de aproximadamente **24 horas antes**, sem depender de horário fixo do dia.

Para `appointment.reminder_due`, o bloco `whatsapp` contém somente o destino do cliente; `professional` fica `null`.

O campo `reminder_sent_at` só é preenchido após confirmação HTTP 2xx do Make, evitando marcar lembrete como enviado quando a integração falha.

## Retry

`integration_events` guarda `attempts`, `last_error` e `delivered_at`. O cron repete eventos pendentes até 10 tentativas.

## WhatsApp API

A credencial do provedor (Meta Cloud API, Evolution API, Z-API etc.) fica **somente no Make**, nunca no frontend ou no GitHub.

O AgendaFácil normaliza números brasileiros para E.164 antes de enviar o bloco `whatsapp`. Números já recebidos com `+` são preservados quando válidos. Se um telefone não puder ser normalizado, o campo `to` será `null`, permitindo que o cenário trate a ausência sem tentar uma entrega inválida.

### Estado de staging em 31/08/2026

- AgendaFácil → Make: validado por E2E real para criação e lembrete.
- Webhook/router/resposta do Make: funcional.
- Payload pronto para WhatsApp: implementado e coberto por testes.
- Provedor de WhatsApp: **ainda não configurado no Make**. Nenhuma credencial Meta/Twilio/Z-API/Evolution foi encontrada nos ambientes existentes; este é o bloqueio externo restante para provar a entrega de mensagem no WhatsApp.
