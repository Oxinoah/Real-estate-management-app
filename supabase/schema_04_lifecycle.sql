-- Listing lifecycle rules, enforced by the database (run once in the Supabase
-- SQL Editor, AFTER schema_02_core_tables.sql and schema_03_accept_rental.sql).
-- Safe to re-run: every object is created with "create or replace" / "drop if exists".
--
--   Draft -> Active -> Under offer -> Sold (sale) / Rented (rent)
--   * Active -> Draft (withdraw) and Under offer -> Active (deal fell through)
--   * Sold and Rented are final
--   * price, sale/rent, property type and location are locked after Under offer
--   * offers / rental applications are only accepted on active listings
--   * the seller of a listing never changes

-- ---------------------------------------------------------------------------
-- 1. Valid status transitions + locked fields
-- ---------------------------------------------------------------------------
create or replace function public.check_property_update()
returns trigger
language plpgsql
as $$
begin
  if new.seller_id is distinct from old.seller_id then
    raise exception 'The seller of a listing cannot be changed';
  end if;

  if new.status is distinct from old.status then
    if not (
         (old.status = 'draft'       and new.status = 'active')
      or (old.status = 'active'      and new.status in ('draft', 'under_offer'))
      or (old.status = 'under_offer' and new.status = 'active')
      or (old.status = 'under_offer' and new.status = 'sold'   and new.transaction_type = 'sale')
      or (old.status = 'under_offer' and new.status = 'rented' and new.transaction_type = 'rent')
    ) then
      raise exception 'Invalid status change: % -> %', old.status, new.status;
    end if;
  end if;

  if old.status in ('under_offer', 'sold', 'rented') and (
       new.price is distinct from old.price
    or new.transaction_type is distinct from old.transaction_type
    or new.property_type is distinct from old.property_type
    or new.location is distinct from old.location
  ) then
    raise exception 'Price, type and location cannot be changed once the property is %', old.status;
  end if;

  return new;
end;
$$;

drop trigger if exists properties_check_update on public.properties;
create trigger properties_check_update
  before update on public.properties
  for each row execute procedure public.check_property_update();

-- New listings always start as a draft or as an active listing.
create or replace function public.check_property_insert()
returns trigger
language plpgsql
as $$
begin
  if new.status not in ('draft', 'active') then
    raise exception 'A new listing must be a draft or active';
  end if;
  return new;
end;
$$;

drop trigger if exists properties_check_insert on public.properties;
create trigger properties_check_insert
  before insert on public.properties
  for each row execute procedure public.check_property_insert();

-- ---------------------------------------------------------------------------
-- 2. "Deal fell through": when a property goes back from Under offer to
--    Active, the accepted offer / application is cancelled (set to rejected)
--    so another one can be accepted.
-- ---------------------------------------------------------------------------
create or replace function public.reopen_property_requests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'under_offer' and new.status = 'active' then
    update public.offers set status = 'rejected'
      where property_id = new.property_id and status = 'accepted';
    update public.rental_applications set status = 'rejected'
      where property_id = new.property_id and status = 'accepted';
  end if;
  return new;
end;
$$;

drop trigger if exists properties_reopen_requests on public.properties;
create trigger properties_reopen_requests
  after update on public.properties
  for each row execute procedure public.reopen_property_requests();

-- ---------------------------------------------------------------------------
-- 3. Accepting a rental application now follows the same path as a sale:
--    the property goes to Under offer; the seller/agent then completes the
--    rental ("Rented") from the property screen.
--    Replaces the version in schema_03_accept_rental.sql.
-- ---------------------------------------------------------------------------
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
  if (select status from public.properties where property_id = v_property) <> 'active' then
    raise exception 'Only an active listing can accept an application';
  end if;

  update public.rental_applications set status = 'accepted'
    where application_id = p_application_id;
  update public.rental_applications set status = 'rejected'
    where property_id = v_property and application_id <> p_application_id and status = 'pending';
  update public.properties set status = 'under_offer' where property_id = v_property;
end;
$$;

revoke all on function public.accept_rental_application(bigint) from public, anon;
grant execute on function public.accept_rental_application(bigint) to authenticated;

-- Same check for offers: only an active listing can accept one.
create or replace function public.accept_offer(p_offer_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_property bigint;
begin
  select property_id into v_property from public.offers where offer_id = p_offer_id;
  if v_property is null then
    raise exception 'Offer not found';
  end if;
  if not public.can_manage_property(v_property) then
    raise exception 'Not allowed';
  end if;
  if (select status from public.properties where property_id = v_property) <> 'active' then
    raise exception 'Only an active listing can accept an offer';
  end if;

  update public.offers set status = 'accepted' where offer_id = p_offer_id;
  update public.offers set status = 'rejected'
    where property_id = v_property and offer_id <> p_offer_id and status = 'pending';
  update public.properties set status = 'under_offer' where property_id = v_property;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Buyers can only send offers / applications on active listings
--    (offers on sale listings, applications on rent listings).
-- ---------------------------------------------------------------------------
drop policy if exists "Create offers" on public.offers;
create policy "Create offers"
  on public.offers for insert
  to authenticated
  with check (
    buyer_id = auth.uid()
    and public.current_user_role() = 'buyer'
    and exists (
      select 1 from public.properties p
      where p.property_id = offers.property_id
        and p.status = 'active' and p.transaction_type = 'sale'
    )
  );

drop policy if exists "Create rental applications" on public.rental_applications;
create policy "Create rental applications"
  on public.rental_applications for insert
  to authenticated
  with check (
    buyer_id = auth.uid()
    and public.current_user_role() = 'buyer'
    and exists (
      select 1 from public.properties p
      where p.property_id = rental_applications.property_id
        and p.status = 'active' and p.transaction_type = 'rent'
    )
  );
