-- AGENT INTEGRATION: team review required BEFORE applying to a test database.
-- Prerequisites: schema.sql and schema_02_core_tables.sql already installed.
-- This file is NOT executed by the app. No existing rows are deleted or reset.
-- Shared fixes preserve Buyer submissions and Seller ownership/decision rights.
-- Assignment and role provisioning remain trusted SQL/dashboard operations.
-- Rental acceptance and post-Under-Offer content edits require a team decision.
begin;

-- Abort instead of silently repairing legacy decisions or deleting team data.
do $$
begin
  if exists (select 1 from public.offers where status = 'accepted' group by property_id having count(*) > 1) then
    raise exception 'Agent prerequisite: review multiple accepted offers per property before retrying';
  end if;
  if exists (
    select 1 from public.offers o join public.properties p using (property_id)
    where o.status = 'accepted' and (p.transaction_type <> 'sale' or p.status not in ('under_offer', 'sold'))
  ) then
    raise exception 'Agent prerequisite: review accepted offers inconsistent with their property before retrying';
  end if;
end;
$$;

create unique index if not exists agent_one_accepted_offer_per_property
  on public.offers (property_id) where status = 'accepted';

-- Return false, never NULL, for missing/unauthenticated profiles.
create or replace function public.can_manage_property(p_property_id bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(exists (
    select 1 from public.properties p join public.profiles u on u.id = auth.uid()
    where p.property_id = p_property_id and (
      (u.role = 'seller' and p.seller_id = u.id)
      or (u.role = 'agent' and p.agent_id = u.id)
    )
  ), false)
$$;

-- An untrusted signup cannot choose a privileged role through metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), 'buyer');
  return new;
end;
$$;

create or replace function public.agent_guard_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and
    (new.id is distinct from old.id or new.role is distinct from old.role or new.created_at is distinct from old.created_at) then
    raise exception 'Role and identity must be provisioned by a trusted administrator' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger agent_protect_profile before update on public.profiles
  for each row execute function public.agent_guard_profile();

-- Keep published catalogue access for Buyers/Sellers; Agent reads are assigned only.
drop policy "Read properties" on public.properties;
create policy "Read properties" on public.properties for select to authenticated using (
  case when public.current_user_role() = 'agent' then agent_id = auth.uid()
    else status <> 'draft' or seller_id = auth.uid() end
);
drop policy "Create properties" on public.properties;
create policy "Create properties" on public.properties for insert to authenticated
  with check (public.current_user_role() = 'seller' and seller_id = auth.uid() and agent_id is null);
drop policy "Delete properties" on public.properties;
create policy "Delete properties" on public.properties for delete to authenticated
  using (public.current_user_role() = 'seller' and seller_id = auth.uid());

-- A single guard also protects direct REST writes, not only Agent RPCs.
create or replace function public.agent_guard_property()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.agent_id is not null and not exists (
    select 1 from public.profiles where id = new.agent_id and role = 'agent'
  ) then
    raise exception 'The assigned profile must be an agent' using errcode = '23514';
  end if;
  -- SQL/dashboard operators and service roles are trusted; none is used in the app.
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then return new; end if;
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if btrim(new.title) = '' or btrim(new.location) = '' or btrim(new.property_type) = ''
    or new.price::text in ('NaN', 'Infinity', '-Infinity') or new.price <= 0 or new.price > 9999999999.99 then
    raise exception 'Invalid listing fields' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if public.current_user_role() is distinct from 'seller' or new.seller_id <> auth.uid()
      or new.agent_id is not null or new.status not in ('draft', 'active') then
      raise exception 'Seller ownership and initial status required' using errcode = '42501';
    end if;
    return new;
  end if;
  if not public.can_manage_property(old.property_id) then
    raise exception 'Property is not managed by this account' using errcode = '42501';
  end if;
  if (to_jsonb(new) - array['title','description','price','transaction_type','property_type','location','status','updated_at'])
    is distinct from (to_jsonb(old) - array['title','description','price','transaction_type','property_type','location','status','updated_at']) then
    raise exception 'Identity, owner and assignment are protected' using errcode = '42501';
  end if;
  if old.status not in ('draft', 'active') and
    (to_jsonb(new) - array['status','updated_at']) is distinct from (to_jsonb(old) - array['status','updated_at']) then
    raise exception 'Content editing is locked from Under Offer onwards' using errcode = '23514';
  end if;
  if new.transaction_type is distinct from old.transaction_type and (
    exists (select 1 from public.offers where property_id = old.property_id)
    or exists (select 1 from public.rental_applications where property_id = old.property_id)
  ) then
    raise exception 'Cannot change sale/rent after a decision record exists' using errcode = '23514';
  end if;
  if new.status is distinct from old.status and not (
    (old.status = 'draft' and new.status = 'active') or
    (old.status = 'active' and new.status = 'under_offer' and new.transaction_type = 'sale'
      and (select count(*) from public.offers where property_id = old.property_id and status = 'accepted') = 1) or
    (old.status = 'under_offer' and new.status = 'sold' and new.transaction_type = 'sale'
      and (select count(*) from public.offers where property_id = old.property_id and status = 'accepted') = 1)
  ) then
    raise exception 'Transition unavailable or rental completion not defined' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger agent_protect_property before insert or update on public.properties
  for each row execute function public.agent_guard_property();

-- Lock the property before each decision; concurrent accepts/inserts serialize.
create or replace function public.agent_guard_decision()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  p public.properties;
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then return new; end if;
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception 'Only the decision status may be changed' using errcode = '42501';
  end if;
  select * into p from public.properties where property_id = new.property_id for update;
  if not found then raise exception 'Property unavailable' using errcode = '23514'; end if;
  if tg_op = 'INSERT' then
    if public.current_user_role() is distinct from 'buyer' or new.buyer_id <> auth.uid() or new.status <> 'pending' then
      raise exception 'A buyer may only submit their own pending request' using errcode = '42501';
    end if;
  else
    if not public.can_manage_property(p.property_id) then
      raise exception 'Assignment or ownership required' using errcode = '42501';
    end if;
    if new.status = old.status then return new; end if;
    if old.status <> 'pending' or new.status not in ('accepted', 'rejected') then
      raise exception 'Only pending decisions may be processed' using errcode = '23514';
    end if;
    if tg_table_name = 'rental_applications' and new.status = 'accepted' then
      raise exception 'Rental acceptance awaits an agreed listing-status rule' using errcode = '23514';
    end if;
  end if;
  if p.status <> 'active'
    or (tg_table_name = 'offers' and p.transaction_type <> 'sale')
    or (tg_table_name = 'rental_applications' and p.transaction_type <> 'rent') then
    raise exception 'Request type or listing status is incompatible' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger agent_protect_offer before insert or update on public.offers
  for each row execute function public.agent_guard_decision();
create trigger agent_protect_application before insert or update on public.rental_applications
  for each row execute function public.agent_guard_decision();

-- Trigger writes belong to the SAME transaction, including direct Seller updates.
create or replace function public.agent_apply_offer_acceptance()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'accepted' and old.status is distinct from new.status then
    update public.offers set status = 'rejected'
      where property_id = new.property_id and offer_id <> new.offer_id and status = 'pending';
    update public.properties set status = 'under_offer' where property_id = new.property_id;
  end if;
  return new;
end;
$$;
create trigger agent_apply_acceptance after update of status on public.offers
  for each row execute function public.agent_apply_offer_acceptance();

-- Keep the existing signature for Seller callers; remove its NULL-auth bypass.
create or replace function public.accept_offer(p_offer_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_property bigint;
begin
  select property_id into v_property from public.offers where offer_id = p_offer_id;
  perform 1 from public.properties where property_id = v_property for update;
  if auth.uid() is null or not public.can_manage_property(v_property) then
    raise exception 'Ownership or assignment required' using errcode = '42501';
  end if;
  update public.offers set status = 'accepted' where offer_id = p_offer_id and status = 'pending';
  if not found then raise exception 'Pending offer required' using errcode = '23514'; end if;
  -- The acceptance trigger rejects other offers and updates the property once.
end;
$$;

create or replace function public.agent_guard_enquiry()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  p public.properties;
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then return new; end if;
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'response') is distinct from (to_jsonb(old) - 'response') then
    raise exception 'Only the response may be changed' using errcode = '42501';
  end if;
  select * into p from public.properties where property_id = new.property_id for update;
  if not found then raise exception 'Property unavailable' using errcode = '23514'; end if;
  if tg_op = 'INSERT' then
    if public.current_user_role() is distinct from 'buyer' or new.buyer_id <> auth.uid()
      or new.response is not null or btrim(new.message) = '' or p.status = 'draft' then
      raise exception 'Invalid buyer enquiry' using errcode = '42501';
    end if;
  elsif not public.can_manage_property(new.property_id) then
    raise exception 'Ownership or assignment required' using errcode = '42501';
  elsif new.response is null or btrim(new.response) = '' then
    raise exception 'A non-empty response is required' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger agent_protect_enquiry before insert or update on public.enquiries
  for each row execute function public.agent_guard_enquiry();

-- Internal helper: callers cannot invoke this locking function through REST.
create or replace function public.agent_assigned_property(p_property_id bigint)
returns public.properties language plpgsql security definer set search_path = '' as $$
declare
  p public.properties;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'agent' then
    raise exception 'Agent authentication required' using errcode = '42501';
  end if;
  select * into p from public.properties where property_id = p_property_id for update;
  if not found or p.agent_id is distinct from auth.uid() then
    raise exception 'Property is not assigned to this agent' using errcode = '42501';
  end if;
  return p;
end;
$$;

create or replace function public.agent_integration_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'agent' then
    raise exception 'Agent authentication required' using errcode = '42501';
  end if;
  return jsonb_build_object('version', 1, 'agent_id', auth.uid(), 'rental_acceptance', false);
end;
$$;

create or replace function public.agent_update_property(p_property_id bigint, p_expected_updated_at timestamptz, p_values jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p public.properties;
begin
  p := public.agent_assigned_property(p_property_id);
  if p.updated_at is distinct from p_expected_updated_at then
    raise exception 'Listing changed; refresh first' using errcode = '40001';
  end if;
  if p.status not in ('draft', 'active') then raise exception 'Listing content is locked' using errcode = '23514'; end if;
  if jsonb_typeof(p_values) is distinct from 'object'
    or not (p_values ?& array['title','description','price','transaction_type','property_type','location'])
    or (p_values - array['title','description','price','transaction_type','property_type','location']) <> '{}'::jsonb then
    raise exception 'Unexpected or missing listing fields' using errcode = '23514';
  end if;
  update public.properties set title = btrim(p_values ->> 'title'), description = p_values ->> 'description',
    price = (p_values ->> 'price')::numeric, transaction_type = p_values ->> 'transaction_type',
    property_type = btrim(p_values ->> 'property_type'), location = btrim(p_values ->> 'location')
    where property_id = p_property_id returning * into p;
  return to_jsonb(p);
end;
$$;

create or replace function public.agent_change_property_status(p_property_id bigint, p_expected_updated_at timestamptz, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  p public.properties;
begin
  p := public.agent_assigned_property(p_property_id);
  if p.updated_at is distinct from p_expected_updated_at then
    raise exception 'Listing changed; refresh first' using errcode = '40001';
  end if;
  if p_status is null or not ((p.status = 'draft' and p_status = 'active') or
    (p.status = 'under_offer' and p.transaction_type = 'sale' and p_status = 'sold')) then
    raise exception 'Unsupported manual transition' using errcode = '23514';
  end if;
  update public.properties set status = p_status where property_id = p_property_id returning * into p;
  -- Existing properties_log_status is the ONLY history writer.
  return to_jsonb(p);
end;
$$;

create or replace function public.agent_reply_enquiry(p_enquiry_id bigint, p_response text, p_expected_response text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e public.enquiries;
  v_property bigint;
begin
  select property_id into v_property from public.enquiries where enquiry_id = p_enquiry_id;
  perform public.agent_assigned_property(v_property);
  select * into e from public.enquiries where enquiry_id = p_enquiry_id for update;
  if e.response is distinct from p_expected_response then
    raise exception 'Response changed; refresh first' using errcode = '40001';
  end if;
  if p_response is null or btrim(p_response) = '' then raise exception 'Response required' using errcode = '23514'; end if;
  update public.enquiries set response = btrim(p_response) where enquiry_id = p_enquiry_id returning * into e;
  return to_jsonb(e);
end;
$$;

create or replace function public.agent_decide_offer(p_offer_id bigint, p_decision text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o public.offers;
  v_property bigint;
begin
  select property_id into v_property from public.offers where offer_id = p_offer_id;
  perform public.agent_assigned_property(v_property);
  if p_decision = 'accepted' then
    perform public.accept_offer(p_offer_id);
  elsif p_decision = 'rejected' then
    update public.offers set status = 'rejected' where offer_id = p_offer_id and status = 'pending';
    if not found then raise exception 'Pending offer required' using errcode = '23514'; end if;
  else
    raise exception 'Unsupported decision' using errcode = '23514';
  end if;
  select * into o from public.offers where offer_id = p_offer_id;
  return to_jsonb(o);
end;
$$;

create or replace function public.agent_reject_application(p_application_id bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a public.rental_applications;
  v_property bigint;
begin
  select property_id into v_property from public.rental_applications where application_id = p_application_id;
  perform public.agent_assigned_property(v_property);
  update public.rental_applications set status = 'rejected' where application_id = p_application_id and status = 'pending'
    returning * into a;
  if not found then raise exception 'Pending application required' using errcode = '23514'; end if;
  -- Rejection does not reserve or rent a property.
  return to_jsonb(a);
end;
$$;

create or replace function public.agent_portfolio_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.agent_integration_status();
  -- One aggregate statement, one snapshot, no REST pagination limit.
  return (
    with owned as materialized (
      select * from public.properties where agent_id = auth.uid()
    ), sellers as (
      select p.seller_id, max(u.full_name) as full_name, count(*) filter (where p.status = 'active') as active_count
      from owned p join public.profiles u on u.id = p.seller_id group by p.seller_id
    ), offer_counts as (
      select p.property_id, p.title, p.transaction_type, count(o.offer_id) as offer_count
      from owned p left join public.offers o on o.property_id = p.property_id
      group by p.property_id, p.title, p.transaction_type
    )
    select jsonb_build_object(
      'generated_at', statement_timestamp(), 'property_count', count(*),
      'sale', jsonb_build_object('count', count(*) filter (where transaction_type = 'sale'),
        'average', round(avg(price) filter (where transaction_type = 'sale'), 2)),
      'rent', jsonb_build_object('count', count(*) filter (where transaction_type = 'rent'),
        'average', round(avg(price) filter (where transaction_type = 'rent'), 2)),
      'active_by_seller', coalesce((select jsonb_agg(to_jsonb(s) order by s.seller_id) from sellers s), '[]'::jsonb),
      'offers_by_property', coalesce((select jsonb_agg(to_jsonb(o) order by o.property_id) from offer_counts o), '[]'::jsonb)
    ) from owned
  );
end;
$$;

-- Trigger-only/internal functions must not become public REST RPCs.
revoke all on function public.agent_guard_profile() from public, anon, authenticated;
revoke all on function public.agent_guard_property() from public, anon, authenticated;
revoke all on function public.agent_guard_decision() from public, anon, authenticated;
revoke all on function public.agent_apply_offer_acceptance() from public, anon, authenticated;
revoke all on function public.agent_guard_enquiry() from public, anon, authenticated;
revoke all on function public.agent_assigned_property(bigint) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.can_manage_property(bigint) from public, anon;
grant execute on function public.can_manage_property(bigint) to authenticated;
revoke all on function public.accept_offer(bigint) from public, anon;
grant execute on function public.accept_offer(bigint) to authenticated;

revoke all on function public.agent_integration_status() from public, anon;
revoke all on function public.agent_update_property(bigint,timestamptz,jsonb) from public, anon;
revoke all on function public.agent_change_property_status(bigint,timestamptz,text) from public, anon;
revoke all on function public.agent_reply_enquiry(bigint,text,text) from public, anon;
revoke all on function public.agent_decide_offer(bigint,text) from public, anon;
revoke all on function public.agent_reject_application(bigint) from public, anon;
revoke all on function public.agent_portfolio_stats() from public, anon;
grant execute on function public.agent_integration_status() to authenticated;
grant execute on function public.agent_update_property(bigint,timestamptz,jsonb) to authenticated;
grant execute on function public.agent_change_property_status(bigint,timestamptz,text) to authenticated;
grant execute on function public.agent_reply_enquiry(bigint,text,text) to authenticated;
grant execute on function public.agent_decide_offer(bigint,text) to authenticated;
grant execute on function public.agent_reject_application(bigint) to authenticated;
grant execute on function public.agent_portfolio_stats() to authenticated;

commit;
