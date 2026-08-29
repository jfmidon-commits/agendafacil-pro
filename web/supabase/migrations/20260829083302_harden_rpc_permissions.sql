-- Harden privileged scheduling functions after routing public booking/availability through Next.js server APIs.

alter function public.set_appointment_occupied_range() set search_path = public;
alter function public.set_updated_at() set search_path = public;

revoke all on function public.set_appointment_occupied_range() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

revoke all on function public.get_available_slots(text, uuid, date) from public, anon, authenticated;
grant execute on function public.get_available_slots(text, uuid, date) to service_role;

revoke all on function public.book_appointment(text, uuid, timestamptz, text, text, text, text) from public, anon, authenticated;
grant execute on function public.book_appointment(text, uuid, timestamptz, text, text, text, text) to service_role;
