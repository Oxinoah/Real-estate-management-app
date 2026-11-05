# Real Estate Management Application

React Native (Expo) mobile app with Supabase (Postgres + Auth) as the backend.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your Supabase project's URL and anon key (Supabase dashboard → Project Settings → API).
3. In the Supabase SQL editor, run `supabase/schema.sql` to create the `profiles` table (stores each user's role: buyer / seller / agent) and the trigger that auto-fills it on signup.
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
src/screens/BuyerHomeScreen.js    placeholder, Week 3
src/screens/SellerHomeScreen.js   placeholder, Week 3
src/screens/AgentHomeScreen.js    placeholder, Week 3
supabase/schema.sql           profiles table + auto-create trigger
```

## Team

Noah Faelens · Viet Duy Le Derenne · Tristan
