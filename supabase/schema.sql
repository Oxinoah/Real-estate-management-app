-- Run this in the Supabase SQL editor (Project > SQL Editor > New query).
-- Supabase Auth already handles password hashing + the `auth.users` table,
-- so we don't need our own `users` table with a password_hash column
-- (that part of the Week 1 Database Schema deliverable is superseded by
-- this — the rest of it, properties/offers/etc., still applies and should
-- be ported here the same way as this file).

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  role text not null check (role in ('buyer', 'seller', 'agent')),
  phone text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by their owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever someone signs up via Supabase Auth.
-- Pass full_name and role in the signUp() call's `options.data`, e.g.:
--   supabase.auth.signUp({
--     email, password,
--     options: { data: { full_name: 'Noah Faelens', role: 'buyer' } }
--   })
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'buyer')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
