create unique index if not exists integration_events_appointment_event_key
on public.integration_events (appointment_id, event_type);
