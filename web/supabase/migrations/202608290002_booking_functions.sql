-- AgendaFácil Pro - availability + transactional booking RPCs

create or replace function public.effective_plan(p_user_id uuid)
returns public.plan_code
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_plan public.plan_code;
  v_trial public.profiles%rowtype;
begin
  select s.plan into v_plan
  from public.subscriptions s
  where s.user_id = p_user_id
    and s.status in ('active', 'trialing')
    and (s.current_period_end is null or s.current_period_end > now())
  limit 1;

  if v_plan is not null then
    return v_plan;
  end if;

  select * into v_trial from public.profiles where id = p_user_id;
  if v_trial.trial_status = 'active'
     and v_trial.trial_ends_at is not null
     and v_trial.trial_ends_at > now() then
    return 'pro';
  end if;

  return 'free';
end;
$$;

revoke all on function public.effective_plan(uuid) from public, anon, authenticated;
grant execute on function public.effective_plan(uuid) to service_role;

create or replace function public.get_available_slots(
  p_slug text,
  p_service_id uuid,
  p_date date
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz,
  label text,
  timezone text
)
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_timezone text;
  v_service public.services%rowtype;
begin
  select pp.user_id, pr.timezone
    into v_user_id, v_timezone
  from public.public_profiles pp
  join public.profiles pr on pr.id = pp.user_id
  where lower(pp.slug) = lower(p_slug)
    and pp.active = true;

  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id
    and user_id = v_user_id
    and active = true;

  if v_service.id is null then
    raise exception using errcode = 'P0001', message = 'service_not_found';
  end if;

  return query
  with rule_windows as (
    select
      (p_date + ar.start_time)::timestamp as local_open,
      (p_date + ar.end_time)::timestamp as local_close,
      ar.slot_interval_minutes
    from public.availability_rules ar
    where ar.user_id = v_user_id
      and ar.day_of_week = extract(dow from p_date)::smallint
      and ar.active = true
  ),
  candidates as (
    select gs as local_start
    from rule_windows rw
    cross join lateral generate_series(
      rw.local_open + make_interval(mins => v_service.buffer_before),
      rw.local_close - make_interval(mins => v_service.duration_minutes + v_service.buffer_after),
      make_interval(mins => rw.slot_interval_minutes)
    ) gs
  ),
  normalized as (
    select
      c.local_start,
      c.local_start at time zone v_timezone as start_utc,
      (c.local_start + make_interval(mins => v_service.duration_minutes)) at time zone v_timezone as end_utc
    from candidates c
  )
  select
    n.start_utc,
    n.end_utc,
    to_char(n.local_start, 'HH24:MI'),
    v_timezone
  from normalized n
  where n.start_utc > now()
    and not exists (
      select 1
      from public.schedule_blocks b
      where b.user_id = v_user_id
        and tstzrange(b.starts_at, b.ends_at, '[)') &&
          tstzrange(
            n.start_utc - make_interval(mins => v_service.buffer_before),
            n.end_utc + make_interval(mins => v_service.buffer_after),
            '[)'
          )
    )
    and not exists (
      select 1
      from public.appointments a
      where a.user_id = v_user_id
        and a.status = 'confirmed'
        and a.occupied_range &&
          tstzrange(
            n.start_utc - make_interval(mins => v_service.buffer_before),
            n.end_utc + make_interval(mins => v_service.buffer_after),
            '[)'
          )
    )
  order by n.start_utc;
end;
$$;

revoke all on function public.get_available_slots(text, uuid, date) from public;
grant execute on function public.get_available_slots(text, uuid, date) to anon, authenticated;

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
security definer set search_path = public
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

  select pp.user_id, pr.timezone
    into v_user_id, v_timezone
  from public.public_profiles pp
  join public.profiles pr on pr.id = pp.user_id
  where lower(pp.slug) = lower(p_slug)
    and pp.active = true;

  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;

  -- Serialize all bookings for a professional. This also makes the Free monthly limit atomic.
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

revoke all on function public.book_appointment(text, uuid, timestamptz, text, text, text, text) from public;
grant execute on function public.book_appointment(text, uuid, timestamptz, text, text, text, text) to anon, authenticated;
