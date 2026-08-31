alter table public.subscriptions
add column billing_interval text
check (billing_interval in ('month', 'year'));

comment on column public.subscriptions.billing_interval is
'Billing cadence reported by Stripe price.recurring.interval; null for legacy/unknown rows.';
