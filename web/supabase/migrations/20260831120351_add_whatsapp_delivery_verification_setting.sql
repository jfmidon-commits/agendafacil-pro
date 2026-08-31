alter table public.integration_settings
  drop constraint integration_settings_allowed_key;

alter table public.integration_settings
  add constraint integration_settings_allowed_key check (
    key in (
      'make_appointment_webhook_url',
      'make_reminder_webhook_url',
      'make_billing_webhook_url',
      'whatsapp_delivery_verified_at'
    )
  );
