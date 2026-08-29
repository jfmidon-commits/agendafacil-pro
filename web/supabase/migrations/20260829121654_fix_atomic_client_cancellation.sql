create or replace function public.cancel_appointment_by_client(p_appointment_id uuid)
returns table (
  appointment_id uuid,
  integration_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.appointment_status;
  v_starts_at timestamptz;
  v_event_id uuid;
begin
  select a.status, a.starts_at
    into v_status, v_starts_at
  from public.appointments a
  where a.id = p_appointment_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'appointment_not_found';
  end if;

  if v_status <> 'confirmed' then
    raise exception using errcode = 'P0001', message = 'appointment_not_active';
  end if;

  if v_starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'appointment_already_started';
  end if;

  update public.appointments
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = 'client'
  where id = p_appointment_id;

  -- The row lock above serializes cancellation attempts. The second caller
  -- observes the updated status and exits before this insert, so no ON CONFLICT
  -- clause is needed here.
  insert into public.integration_events (appointment_id, event_type)
  values (p_appointment_id, 'appointment.cancelled')
  returning id into v_event_id;

  return query select p_appointment_id, v_event_id;
end;
$$;

revoke all on function public.cancel_appointment_by_client(uuid) from public, anon, authenticated;
grant execute on function public.cancel_appointment_by_client(uuid) to service_role;
