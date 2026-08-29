create or replace function public.update_business_settings(
  p_name text,
  p_phone text,
  p_business_name text,
  p_slug text,
  p_description text,
  p_city text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  v_business_name text := btrim(coalesce(p_business_name, ''));
  v_slug text := lower(btrim(coalesce(p_slug, '')));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_city text := nullif(btrim(coalesce(p_city, '')), '');
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'unauthenticated';
  end if;

  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception using errcode = 'P0001', message = 'invalid_name';
  end if;
  if length(v_phone) < 10 or length(v_phone) > 15 then
    raise exception using errcode = 'P0001', message = 'invalid_phone';
  end if;
  if length(v_business_name) < 2 or length(v_business_name) > 120 then
    raise exception using errcode = 'P0001', message = 'invalid_business_name';
  end if;
  if v_slug !~ '^[a-z0-9][a-z0-9-]{2,49}$' then
    raise exception using errcode = 'P0001', message = 'invalid_slug';
  end if;
  if v_description is not null and length(v_description) > 500 then
    raise exception using errcode = 'P0001', message = 'invalid_description';
  end if;
  if v_city is not null and length(v_city) > 120 then
    raise exception using errcode = 'P0001', message = 'invalid_city';
  end if;

  if not exists (
    select 1 from public.public_profiles pp where pp.user_id = v_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'profile_not_configured';
  end if;

  if exists (
    select 1
    from public.public_profiles pp
    where lower(pp.slug) = v_slug
      and pp.user_id <> v_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'slug_unavailable';
  end if;

  update public.profiles
  set name = v_name,
      phone = v_phone
  where id = v_user_id;

  update public.public_profiles
  set business_name = v_business_name,
      slug = v_slug,
      description = v_description,
      city = v_city
  where user_id = v_user_id;
end;
$$;

revoke all on function public.update_business_settings(text, text, text, text, text, text)
from public, anon;
grant execute on function public.update_business_settings(text, text, text, text, text, text)
to authenticated;
