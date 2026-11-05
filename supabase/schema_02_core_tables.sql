-- Run this ONCE in the Supabase SQL editor, AFTER supabase/schema.sql
-- (which creates `profiles`). It adds the rest of the Week 1 schema:
-- properties, property_images, offers, rental_applications, enquiries,
-- favourites, status_history, viewings — plus Row Level Security rules.
--
-- Differences from the Week 1 (SQLite) schema:
--   * user ids are uuids (Supabase Auth) and `users` is replaced by `profiles`
--   * statuses are enforced with CHECK constraints
--   * status_history is filled automatically by a trigger
--   * accepting an offer is one function call: select accept_offer(<offer_id>)

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.properties (
  property_id bigint generated always as identity primary key,
  seller_id uuid not null references public.profiles (id),
  agent_id uuid references public.profiles (id),
  title text not null,
  description text,
  price numeric(12, 2) not null check (price > 0),
  transaction_type text not null check (transaction_type in ('sale', 'rent')),
  property_type text not null,
  location text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'under_offer', 'sold', 'rented')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_images (
  image_id bigint generated always as identity primary key,
  property_id bigint not null references public.properties (property_id) on delete cascade,
  url text not null
);

create table public.offers (
  offer_id bigint generated always as identity primary key,
  property_id bigint not null references public.properties (property_id) on delete cascade,
  buyer_id uuid not null references public.profiles (id),
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.rental_applications (
  application_id bigint generated always as identity primary key,
  property_id bigint not null references public.properties (property_id) on delete cascade,
  buyer_id uuid not null references public.profiles (id),
  move_in_date date not null,
  notes text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.enquiries (
  enquiry_id bigint generated always as identity primary key,
  property_id bigint not null references public.properties (property_id) on delete cascade,
  buyer_id uuid not null references public.profiles (id),
  message text not null,
  response text,
  created_at timestamptz not null default now()
);

create table public.favourites (
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  property_id bigint not null references public.properties (property_id) on delete cascade,
  primary key (buyer_id, property_id)
);

create table public.status_history (
  history_id bigint generated always as identity primary key,
  property_id bigint not null references public.properties (property_id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid not null references public.profiles (id),
  changed_at timestamptz not null default now()
);

create table public.viewings (
  viewing_id bigint generated always as identity primary key,
  property_id bigint not null references public.properties (property_id) on delete cascade,
  buyer_id uuid not null references public.profiles (id),
  requested_datetime timestamptz not null,
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'declined')),
  created_by uuid not null references public.profiles (id)
);

-- ---------------------------------------------------------------------------
-- Helper functions (used by the security rules below)
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- A user can manage a property if they are its seller, or if they are an agent.
create or replace function public.can_manage_property(p_property_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'agent'
    or exists (
      select 1 from public.properties
      where property_id = p_property_id and seller_id = auth.uid()
    )
$$;

-- ---------------------------------------------------------------------------
-- Triggers: updated_at, status history, status rules
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute procedure public.set_updated_at();

-- Logs every status change into status_history and blocks changes once a
-- property is sold or rented (e.g. Sold -> Active is rejected).
create or replace function public.log_property_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.status_history (property_id, old_status, new_status, changed_by)
    values (new.property_id, null, new.status, coalesce(auth.uid(), new.seller_id));
  elsif new.status is distinct from old.status then
    if old.status in ('sold', 'rented') then
      raise exception 'A % property cannot change status anymore', old.status;
    end if;
    insert into public.status_history (property_id, old_status, new_status, changed_by)
    values (new.property_id, old.status, new.status, coalesce(auth.uid(), new.seller_id));
  end if;
  return new;
end;
$$;

create trigger properties_log_status
  after insert or update on public.properties
  for each row execute procedure public.log_property_status();

-- Accepting an offer: accept it, reject the other pending offers on the same
-- property, and move the property to 'under_offer' — all in one transaction.
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

  update public.offers set status = 'accepted' where offer_id = p_offer_id;
  update public.offers set status = 'rejected'
    where property_id = v_property and offer_id <> p_offer_id and status = 'pending';
  update public.properties set status = 'under_offer' where property_id = v_property;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.properties enable row level security;
alter table public.property_images enable row level security;
alter table public.offers enable row level security;
alter table public.rental_applications enable row level security;
alter table public.enquiries enable row level security;
alter table public.favourites enable row level security;
alter table public.status_history enable row level security;
alter table public.viewings enable row level security;

-- Any signed-in user can read profiles (names are shown next to offers,
-- enquiries and listings). Note: this includes the phone column.
create policy "Signed-in users can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

-- properties: everyone sees published listings; drafts only for the seller
-- and agents. Sellers create/edit/delete their own; agents manage all.
create policy "Read properties"
  on public.properties for select
  to authenticated
  using (status <> 'draft' or seller_id = auth.uid() or public.current_user_role() = 'agent');

create policy "Create properties"
  on public.properties for insert
  to authenticated
  with check (
    public.current_user_role() in ('seller', 'agent')
    and (seller_id = auth.uid() or public.current_user_role() = 'agent')
  );

create policy "Update properties"
  on public.properties for update
  to authenticated
  using (public.can_manage_property(property_id));

create policy "Delete properties"
  on public.properties for delete
  to authenticated
  using (public.can_manage_property(property_id));

-- property_images: visible with the property, editable by whoever manages it.
create policy "Read property images"
  on public.property_images for select
  to authenticated
  using (exists (select 1 from public.properties p where p.property_id = property_images.property_id));

create policy "Manage property images"
  on public.property_images for all
  to authenticated
  using (public.can_manage_property(property_id))
  with check (public.can_manage_property(property_id));

-- offers: a buyer sees and creates their own; sellers/agents see and answer
-- offers on the properties they manage.
create policy "Read offers"
  on public.offers for select
  to authenticated
  using (buyer_id = auth.uid() or public.can_manage_property(property_id));

create policy "Create offers"
  on public.offers for insert
  to authenticated
  with check (buyer_id = auth.uid() and public.current_user_role() = 'buyer');

create policy "Update offers"
  on public.offers for update
  to authenticated
  using (public.can_manage_property(property_id));

-- rental_applications: same rules as offers.
create policy "Read rental applications"
  on public.rental_applications for select
  to authenticated
  using (buyer_id = auth.uid() or public.can_manage_property(property_id));

create policy "Create rental applications"
  on public.rental_applications for insert
  to authenticated
  with check (buyer_id = auth.uid() and public.current_user_role() = 'buyer');

create policy "Update rental applications"
  on public.rental_applications for update
  to authenticated
  using (public.can_manage_property(property_id));

-- enquiries: a buyer writes; sellers/agents read and fill in `response`.
create policy "Read enquiries"
  on public.enquiries for select
  to authenticated
  using (buyer_id = auth.uid() or public.can_manage_property(property_id));

create policy "Create enquiries"
  on public.enquiries for insert
  to authenticated
  with check (buyer_id = auth.uid() and public.current_user_role() = 'buyer');

create policy "Respond to enquiries"
  on public.enquiries for update
  to authenticated
  using (public.can_manage_property(property_id));

-- favourites: private to the buyer.
create policy "Manage own favourites"
  on public.favourites for all
  to authenticated
  using (buyer_id = auth.uid())
  with check (buyer_id = auth.uid());

-- status_history: readable by whoever manages the property; only written by
-- the trigger above (no insert policy on purpose).
create policy "Read status history"
  on public.status_history for select
  to authenticated
  using (public.can_manage_property(property_id));

-- viewings: a buyer requests and sees their own; sellers/agents confirm or
-- decline requests on the properties they manage.
create policy "Read viewings"
  on public.viewings for select
  to authenticated
  using (buyer_id = auth.uid() or public.can_manage_property(property_id));

create policy "Request viewings"
  on public.viewings for insert
  to authenticated
  with check (
    buyer_id = auth.uid()
    and created_by = auth.uid()
    and public.current_user_role() = 'buyer'
  );

create policy "Answer viewings"
  on public.viewings for update
  to authenticated
  using (public.can_manage_property(property_id));
