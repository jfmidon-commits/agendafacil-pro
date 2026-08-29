-- AgendaFácil Pro - Supabase schema
-- Security model: private profile data is never publicly readable.

create extension if not exists btree_gist with schema extensions;

create type public.trial_status as enum ('active', 'ended', 'never');
create type public.plan_code as enum ('free', 'pro', 'studio');
create type public.appointment_status as enum ('confirmed', 'cancelled', 'completed', 'no_show');
create type public.block_type as enum ('break', 'timeoff', 'blocked');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  phone text,
  timezone text not null default 'America/Sao_Paulo',
  trial_status public.trial_status not null default 'active',
  trial_ends_at timestamptz,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.public_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,49}$'),
  business_name text not null,
  description text,
  avatar_url text,
  city text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index public_profiles_slug_unique on public.public_profiles (lower(slug));

create table public.services (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes between 5 and 720),
  buffer_before integer not null default 0 check (buffer_before between 0 and 240),
  buffer_after integer not null default 0 check (buffer_after between 0 and 240),
  price_cents integer not null default 0 check (price_cents >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_user_id_idx on public.services(user_id);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0=Sunday
  start_time time not null,
  end_time time not null,
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes between 5 and 240),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint availability_same_day check (end_time > start_time)
);
create index availability_rules_user_day_idx on public.availability_rules(user_id, day_of_week) where active;

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  type public.block_type not null default 'blocked',
  reason text,
  created_at timestamptz not null default now(),
  constraint schedule_blocks_valid_range check (ends_at > starts_at)
);
create index schedule_blocks_user_start_idx on public.schedule_blocks(user_id, starts_at);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid not null references public.services(id),
  service_name_snapshot text not null,
  service_duration_minutes integer not null check (service_duration_minutes > 0),
  buffer_before integer not null default 0 check (buffer_before >= 0),
  buffer_after integer not null default 0 check (buffer_after >= 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  client_name text not null,
  client_phone text not null,
  client_email text,
  notes text,
  status public.appointment_status not null default 'confirmed',
  reminder_sent_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  occupied_range tstzrange not null,
  constraint appointments_valid_range check (ends_at > starts_at),
  constraint appointments_no_double_booking exclude using gist (
    user_id with =,
    occupied_range with &&
  ) where (status = 'confirmed')
);
create index appointments_user_starts_idx on public.appointments(user_id, starts_at);
create index appointments_user_created_idx on public.appointments(user_id, created_at);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  stripe_price_id text not null,
  plan public.plan_code not null check (plan <> 'free'),
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.integration_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  event_type text not null,
  attempts integer not null default 0,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index integration_events_pending_idx on public.integration_events(created_at) where delivered_at is null;

create table public.stripe_events (
  id text primary key,
  type text not null,
  status text not null default 'processing' check (status in ('processing','processed','error')),
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.set_appointment_occupied_range()
returns trigger language plpgsql as $$
begin
  new.occupied_range := tstzrange(
    new.starts_at - make_interval(mins => new.buffer_before),
    new.ends_at + make_interval(mins => new.buffer_after),
    '[)'
  );
  return new;
end;
$$;

create trigger appointments_set_occupied_range
before insert or update of starts_at, ends_at, buffer_before, buffer_after on public.appointments
for each row execute function public.set_appointment_occupied_range();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger public_profiles_updated_at before update on public.public_profiles
for each row execute function public.set_updated_at();
create trigger services_updated_at before update on public.services
for each row execute function public.set_updated_at();
create trigger appointments_updated_at before update on public.appointments
for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone, trial_status, trial_ends_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    'active',
    now() + interval '14 days'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.public_profiles enable row level security;
alter table public.services enable row level security;
alter table public.availability_rules enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.appointments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.integration_events enable row level security;
alter table public.stripe_events enable row level security;

create policy "profiles_owner_select" on public.profiles for select to authenticated
using (id = auth.uid());
create policy "profiles_owner_update" on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy "public_profiles_public_read" on public.public_profiles for select to anon, authenticated
using (active or user_id = auth.uid());
create policy "public_profiles_owner_insert" on public.public_profiles for insert to authenticated
with check (user_id = auth.uid());
create policy "public_profiles_owner_update" on public.public_profiles for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "public_profiles_owner_delete" on public.public_profiles for delete to authenticated
using (user_id = auth.uid());

create policy "services_public_read" on public.services for select to anon, authenticated
using (active or user_id = auth.uid());
create policy "services_owner_insert" on public.services for insert to authenticated
with check (user_id = auth.uid());
create policy "services_owner_update" on public.services for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "services_owner_delete" on public.services for delete to authenticated
using (user_id = auth.uid());

create policy "availability_owner_all" on public.availability_rules for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "blocks_owner_all" on public.schedule_blocks for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "appointments_owner_select" on public.appointments for select to authenticated
using (user_id = auth.uid());
create policy "appointments_owner_update" on public.appointments for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "subscriptions_owner_select" on public.subscriptions for select to authenticated
using (user_id = auth.uid());

-- Direct appointment creation is intentionally unavailable to anon/authenticated.
revoke insert, delete on public.appointments from anon, authenticated;
revoke update on public.appointments from anon, authenticated;
grant select on public.appointments to authenticated;
grant update(status, notes) on public.appointments to authenticated;

-- Private scheduling data is not exposed to anonymous visitors.
revoke all on public.availability_rules from anon;
revoke all on public.schedule_blocks from anon;
revoke all on public.profiles from anon;
revoke all on public.subscriptions from anon;
revoke all on public.integration_events from anon, authenticated;
revoke all on public.stripe_events from anon, authenticated;
