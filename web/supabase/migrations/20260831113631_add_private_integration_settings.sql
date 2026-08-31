create table public.integration_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  constraint integration_settings_allowed_key check (
    key in (
      'make_appointment_webhook_url',
      'make_reminder_webhook_url',
      'make_billing_webhook_url'
    )
  )
);

alter table public.integration_settings enable row level security;

comment on table public.integration_settings is
'Internal integration configuration. Intentionally has RLS enabled with no client policies; accessed only with service_role.';

comment on column public.integration_settings.value is
'Sensitive integration capability value. Never expose through public/client APIs.';
