create index if not exists appointments_service_id_idx
on public.appointments(service_id);

drop index if exists public.integration_events_appointment_event_key;

alter policy profiles_owner_select on public.profiles
using (id = (select auth.uid()));

alter policy profiles_owner_update on public.profiles
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

alter policy public_profiles_public_read on public.public_profiles
using (active or user_id = (select auth.uid()));

alter policy public_profiles_owner_insert on public.public_profiles
with check (user_id = (select auth.uid()));

alter policy public_profiles_owner_update on public.public_profiles
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter policy public_profiles_owner_delete on public.public_profiles
using (user_id = (select auth.uid()));

alter policy services_public_read on public.services
using (active or user_id = (select auth.uid()));

alter policy services_owner_insert on public.services
with check (user_id = (select auth.uid()));

alter policy services_owner_update on public.services
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter policy services_owner_delete on public.services
using (user_id = (select auth.uid()));

alter policy availability_owner_all on public.availability_rules
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter policy blocks_owner_all on public.schedule_blocks
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter policy appointments_owner_select on public.appointments
using (user_id = (select auth.uid()));

alter policy appointments_owner_update on public.appointments
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

alter policy subscriptions_owner_select on public.subscriptions
using (user_id = (select auth.uid()));
