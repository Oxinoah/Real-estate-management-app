# Real Estate Management Application

React Native (Expo) mobile app with Supabase (Postgres + Auth) as the backend.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your Supabase project's URL and anon key (Supabase dashboard → Project Settings → API).
3. In the Supabase SQL editor, run `supabase/schema.sql` to create the `profiles` table (stores each user's role: buyer / seller / agent) and the trigger that auto-fills it on signup, then run `supabase/schema_02_core_tables.sql` to create the rest of the tables.
4. `npm start` (Expo), then scan the QR code with Expo Go, or press `i` / `a` for a simulator.

## Creating test accounts

Until there's a signup screen, create test users from the Supabase dashboard (Authentication → Users → Add user), then set their role manually:

```sql
update public.profiles set role = 'seller' where id = '<user-uuid>';
```

Or sign up from the app with `options.data` set (see `supabase/schema.sql` for the exact call) so the trigger assigns the role automatically.

## Structure

```
App.js                        role-based routing after login
src/lib/supabase.js           Supabase client (reads .env via react-native-dotenv)
src/screens/LoginScreen.js    Week 2 deliverable — email/password via Supabase Auth
src/screens/PropertyListScreen.js    Week 2 GUI 1/3 - browse list (search, sale/rent filter, favourites)
src/screens/PropertyDetailScreen.js  Week 2 GUI 2/3 - property detail
src/screens/CreatePropertyScreen.js  Week 2 GUI 3/3 - seller's create-property form
src/screens/BuyerHomeScreen.js       list -> detail navigation (sample data for now)
src/screens/SellerHomeScreen.js      "My Properties" + new-property form (sample data for now)
src/screens/AgentHomeScreen.js       placeholder, Week 3
src/components/, src/data/, src/utils/   shared UI pieces, sample properties, formatters
supabase/schema.sql           profiles table + auto-create trigger (run first)
supabase/schema_02_core_tables.sql   properties, offers, rental applications, enquiries,
                              favourites, viewings, status history + security rules (run second)
```

## Team

Noah Faelens · Viet Duy Le Derenne · Tristan
