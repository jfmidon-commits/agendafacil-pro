-- Ensure retried cron executions do not create duplicate outbox events.
create unique index integration_events_appointment_type_unique
on public.integration_events(appointment_id, event_type);

create index subscriptions_status_idx on public.subscriptions(status, current_period_end);
