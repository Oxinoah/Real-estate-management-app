-- Accepting a rental application (same idea as accept_offer in schema_02):
-- accept it, reject the other pending applications on the same property and
-- mark the property as rented, all in one transaction.
-- Run once in the Supabase SQL Editor. Needed by the Agent "Requests" tab.
create or replace function public.accept_rental_application(p_application_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property bigint;
begin
  select property_id into v_property
    from public.rental_applications where application_id = p_application_id;
  if v_property is null then
    raise exception 'Application not found';
  end if;
  if not public.can_manage_property(v_property) then
    raise exception 'Not allowed';
  end if;

  update public.rental_applications set status = 'accepted'
    where application_id = p_application_id;
  update public.rental_applications set status = 'rejected'
    where property_id = v_property and application_id <> p_application_id and status = 'pending';
  update public.properties set status = 'rented' where property_id = v_property;
end;
$$;

revoke all on function public.accept_rental_application(bigint) from public, anon;
grant execute on function public.accept_rental_application(bigint) to authenticated;
