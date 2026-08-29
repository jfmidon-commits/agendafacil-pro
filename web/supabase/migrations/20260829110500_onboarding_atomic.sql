-- AgendaFácil Pro - atomic onboarding configuration

create or replace function public.save_onboarding_config(
  p_business_name text,
  p_slug text,
  p_service_name text,
  p_duration_minutes integer,
  p_price_cents integer,
  p_slot_interval_minutes integer,
  p_schedule jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_service_id uuid;
  v_group jsonb;
  v_day_text text;
  v_day smallint;
  v_start time;
  v_end time;
  v_seen text[] := array[]::text[];
  v_key text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  p_business_name := btrim(coalesce(p_business_name, ''));
  p_slug := lower(btrim(coalesce(p_slug, '')));
  p_service_name := btrim(coalesce(p_service_name, ''));

  if length(p_business_name) < 2 or length(p_business_name) > 120 then
    raise exception using errcode = 'P0001', message = 'invalid_business_name';
  end if;
  if p_slug !~ '^[a-z0-9][a-z0-9-]{2,49}$' then
    raise exception using errcode = 'P0001', message = 'invalid_slug';
  end if;
  if length(p_service_name) < 2 or length(p_service_name) > 120 then
    raise exception using errcode = 'P0001', message = 'invalid_service_name';
  end if;
  if p_duration_minutes < 5 or p_duration_minutes > 720 then
    raise exception using errcode = 'P0001', message = 'invalid_duration';
  end if;
  if p_price_cents < 0 then
    raise exception using errcode = 'P0001', message = 'invalid_price';
  end if;
  if p_slot_interval_minutes < 5 or p_slot_interval_minutes > 240 then
    raise exception using errcode = 'P0001', message = 'invalid_slot_interval';
  end if;
  if jsonb_typeof(p_schedule) <> 'array' or jsonb_array_length(p_schedule) = 0 then
    raise exception using errcode = 'P0001', message = 'invalid_schedule';
  end if;

  if exists (
    select 1
    from public.public_profiles pp
    where lower(pp.slug) = p_slug
      and pp.user_id <> v_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'slug_unavailable';
  end if;

  insert into public.public_profiles (user_id, business_name, slug, active)
  values (v_user_id, p_business_name, p_slug, true)
  on conflict (user_id) do update
  set business_name = excluded.business_name,
      slug = excluded.slug,
      active = true;

  select s.id into v_service_id
  from public.services s
  where s.user_id = v_user_id
    and s.active = true
  order by s.created_at asc
  limit 1;

  if v_service_id is null then
    insert into public.services (
      user_id, name, duration_minutes, price_cents,
      buffer_before, buffer_after, active
    ) values (
      v_user_id, p_service_name, p_duration_minutes, p_price_cents,
      0, 0, true
    ) returning id into v_service_id;
  else
    update public.services
    set name = p_service_name,
        duration_minutes = p_duration_minutes,
        price_cents = p_price_cents,
        active = true
    where id = v_service_id
      and user_id = v_user_id;
  end if;

  delete from public.availability_rules
  where user_id = v_user_id;

  for v_group in
    select value from jsonb_array_elements(p_schedule)
  loop
    if jsonb_typeof(v_group -> 'days') <> 'array'
       or jsonb_array_length(v_group -> 'days') = 0 then
      raise exception using errcode = 'P0001', message = 'invalid_schedule_days';
    end if;

    begin
      v_start := (v_group ->> 'startTime')::time;
      v_end := (v_group ->> 'endTime')::time;
    exception when others then
      raise exception using errcode = 'P0001', message = 'invalid_schedule_time';
    end;

    if v_end <= v_start then
      raise exception using errcode = 'P0001', message = 'invalid_schedule_window';
    end if;

    for v_day_text in
      select value from jsonb_array_elements_text(v_group -> 'days')
    loop
      begin
        v_day := v_day_text::smallint;
      exception when others then
        raise exception using errcode = 'P0001', message = 'invalid_schedule_day';
      end;

      if v_day < 0 or v_day > 6 then
        raise exception using errcode = 'P0001', message = 'invalid_schedule_day';
      end if;

      v_key := v_day::text || '|' || v_start::text || '|' || v_end::text;
      if v_key = any(v_seen) then
        raise exception using errcode = 'P0001', message = 'duplicate_schedule_rule';
      end if;
      v_seen := array_append(v_seen, v_key);

      insert into public.availability_rules (
        user_id, day_of_week, start_time, end_time,
        slot_interval_minutes, active
      ) values (
        v_user_id, v_day, v_start, v_end,
        p_slot_interval_minutes, true
      );
    end loop;
  end loop;

  return v_service_id;
end;
$$;

revoke all on function public.save_onboarding_config(text, text, text, integer, integer, integer, jsonb)
from public, anon;
grant execute on function public.save_onboarding_config(text, text, text, integer, integer, integer, jsonb)
to authenticated;
