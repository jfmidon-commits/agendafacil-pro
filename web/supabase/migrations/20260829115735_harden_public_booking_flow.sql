-- Harden public booking invariants and make client cancellation atomic.

create or replace function public.book_appointment(
  p_slug text,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_client_name text,
  p_client_phone text,
  p_client_email text default null,
  p_notes text default null
)
returns table (
  appointment_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  timezone text,
  integration_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_timezone text;
  v_service public.services%rowtype;
  v_ends_at timestamptz;
  v_busy_start timestamptz;
  v_busy_end timestamptz;
  v_local_busy_start timestamp;
  v_local_busy_end timestamp;
  v_effective_plan public.plan_code;
  v_month_count integer;
  v_appointment_id uuid;
  v_event_id uuid;
begin
  if p_starts_at <= now() then
    raise exception using errcode = 'P0001', message = 'start_must_be_in_future';
  end if;

  if length(trim(p_client_name)) < 2 or length(trim(p_client_name)) > 120 then
    raise exception using errcode = 'P0001', message = 'invalid_client_name';
  end if;
  if length(trim(p_client_phone)) < 8 or length(trim(p_client_phone)) > 30 then
    raise exception using errcode = 'P0001', message = 'invalid_client_phone';
  end if;
  if p_client_email is not null and length(trim(p_client_email)) > 200 then
    raise exception using errcode = 'P0001', message = 'invalid_client_email';
  end if;
  if p_notes is not null and length(p_notes) > 500 then
    raise exception using errcode = 'P0001', message = 'invalid_notes';
  end if;

  select pp.user_id, pr.timezone
    into v_user_id, v_timezone
  from public.public_profiles pp
  join public.profiles pr on pr.id = pp.user_id
  where lower(pp.slug) = lower(p_slug)
    and pp.active = true;

  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select * into v_service
  from public.services
  where id = p_service_id
    and user_id = v_user_id
    and active = true;

  if v_service.id is null then
    raise exception using errcode = 'P0001', message = 'service_not_found';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_busy_start := p_starts_at - make_interval(mins => v_service.buffer_before);
  v_busy_end := v_ends_at + make_interval(mins => v_service.buffer_after);
  v_local_busy_start := v_busy_start at time zone v_timezone;
  v_local_busy_end := v_busy_end at time zone v_timezone;

  if v_local_busy_start::date <> v_local_busy_end::date then
    raise exception using errcode = 'P0001', message = 'booking_crosses_day_boundary';
  end if;

  if not exists (
    select 1
    from public.availability_rules ar
    where ar.user_id = v_user_id
      and ar.day_of_week = extract(dow from v_local_busy_start)::smallint
      and ar.active = true
      and ar.start_time <= v_local_busy_start::time
      and ar.end_time >= v_local_busy_end::time
  ) then
    raise exception using errcode = 'P0001', message = 'outside_availability';
  end if;

  -- Direct callers must choose an exact slot generated from the rule start + interval.
  if not exists (
    select 1
    from public.availability_rules ar
    where ar.user_id = v_user_id
      and ar.day_of_week = extract(dow from v_local_busy_start)::smallint
      and ar.active = true
      and ar.start_time <= v_local_busy_start::time
      and ar.end_time >= v_local_busy_end::time
      and mod(
        extract(epoch from (
          v_local_busy_start - ((v_local_busy_start::date + ar.start_time)::timestamp)
        )),
        ar.slot_interval_minutes * 60
      ) = 0
  ) then
    raise exception using errcode = 'P0001', message = 'slot_not_aligned';
  end if;

  if exists (
    select 1 from public.schedule_blocks b
    where b.user_id = v_user_id
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(v_busy_start, v_busy_end, '[)')
  ) then
    raise exception using errcode = 'P0001', message = 'schedule_block_conflict';
  end if;

  if exists (
    select 1 from public.appointments a
    where a.user_id = v_user_id
      and a.status = 'confirmed'
      and a.occupied_range && tstzrange(v_busy_start, v_busy_end, '[)')
  ) then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end if;

  v_effective_plan := public.effective_plan(v_user_id);
  if v_effective_plan = 'free' then
    select count(*) into v_month_count
    from public.appointments a
    where a.user_id = v_user_id
      and a.created_at >= date_trunc('month', now())
      and a.created_at < date_trunc('month', now()) + interval '1 month';

    if v_month_count >= 10 then
      raise exception using errcode = 'P0001', message = 'free_plan_limit_reached';
    end if;
  end if;

  begin
    insert into public.appointments (
      user_id, service_id, service_name_snapshot,
      service_duration_minutes, buffer_before, buffer_after,
      starts_at, ends_at, timezone,
      client_name, client_phone, client_email, notes
    ) values (
      v_user_id, v_service.id, v_service.name,
      v_service.duration_minutes, v_service.buffer_before, v_service.buffer_after,
      p_starts_at, v_ends_at, v_timezone,
      trim(p_client_name), trim(p_client_phone), nullif(trim(p_client_email), ''), nullif(trim(p_notes), '')
    ) returning id into v_appointment_id;
  exception when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'slot_unavailable';
  end;

  insert into public.integration_events (appointment_id, event_type)
  values (v_appointment_id, 'appointment.created')
  returning id into v_event_id;

  return query select v_appointment_id, p_starts_at, v_ends_at, v_timezone, v_event_id;
end;
$$;

revoke all on function public.book_appointment(text, uuid, timestamptz, text, text, text, text) from public, anon, authenticated;
grant execute on function public.book_appointment(text, uuid, timestamptz, text, text, text, text) to service_role;

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

  insert into public.integration_events (appointment_id, event_type)
  values (p_appointment_id, 'appointment.cancelled')
  on conflict (appointment_id, event_type)
  do update set appointment_id = excluded.appointment_id
  returning id into v_event_id;

  return query select p_appointment_id, v_event_id;
end;
$$;

revoke all on function public.cancel_appointment_by_client(uuid) from public, anon, authenticated;
grant execute on function public.cancel_appointment_by_client(uuid) to service_role;
