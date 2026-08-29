# Make + WhatsApp — integração v2

Na arquitetura Next.js + Supabase, o Firestore deixa de ser o gatilho principal. O app cria um evento em `integration_events` na mesma transação do booking e tenta entregá-lo ao Make. Falhas ficam no outbox e são repetidas pelo cron `/api/cron/integrations`.

## Webhooks

Configure no Vercel:

- `MAKE_APPOINTMENT_WEBHOOK_URL`: confirmação, cancelamento e fallback de lembrete
- `MAKE_REMINDER_WEBHOOK_URL`: opcional, dedicado a lembretes
- `MAKE_BILLING_WEBHOOK_URL`: falha de cobrança Stripe

### `appointment.created`

O Make recebe:

```json
{
  "event": "appointment.created",
  "appointment": {
    "id": "uuid",
    "service": "Corte",
    "startsAt": "2026-09-01T13:00:00Z",
    "endsAt": "2026-09-01T13:30:00Z",
    "timezone": "America/Sao_Paulo",
    "client": {"name":"João","phone":"+5551999999999","email":"..."},
    "cancelUrl": "https://app.exemplo/cancel/..."
  },
  "professional": {"name":"Maria","phone":"+5551...","businessName":"Studio Maria"}
}
```

No Make:

1. enviar confirmação ao cliente;
2. enviar aviso ao profissional;
3. incluir **link de cancelamento** na mensagem;
4. não instruir o cliente a responder "CANCELAR" enquanto não existir parser seguro de mensagens recebidas.

## Lembrete

`/api/cron/reminders` roda a cada 15 minutos e procura agendamentos entre 23h45 e 24h15 à frente. Isso implementa o requisito de aproximadamente **24 horas antes**, sem depender de horário fixo do dia.

O campo `reminder_sent_at` só é preenchido após confirmação HTTP 2xx do Make, evitando marcar lembrete como enviado quando a integração falha.

## Retry

`integration_events` guarda `attempts`, `last_error` e `delivered_at`. O cron repete eventos pendentes até 10 tentativas.

## WhatsApp API

A credencial do provedor (Meta Cloud API, Evolution API, Z-API etc.) fica **somente no Make**, nunca no frontend ou no GitHub. O cenário deve normalizar telefone no formato E.164 antes do envio.
