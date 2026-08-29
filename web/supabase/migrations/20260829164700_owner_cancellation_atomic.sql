create or replace function public.cancel_appointment_by_owner(
  p_appointment_id uuid,
  p_user_id uuid
)
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
  v_event_id uuid;
begin
  select a.status
    into v_status
  from public.appointments a
  where a.id = p_appointment_id
    and a.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'appointment_not_found';
  end if;

  if v_status <> 'confirmed' then
    raise exception using errcode = 'P0001', message = 'appointment_not_active';
  end if;

  update public.appointments
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = 'owner'
  where id = p_appointment_id
    and user_id = p_user_id;

  insert into public.integration_events (appointment_id, event_type)
  values (p_appointment_id, 'appointment.cancelled')
  returning id into v_event_id;

  return query select p_appointment_id, v_event_id;
end;
$$;

revoke all on function public.cancel_appointment_by_owner(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_appointment_by_owner(uuid, uuid) to service_role;
