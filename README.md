# Real Estate Management Application

React Native (Expo SDK 58) mobile app with Supabase (Postgres + Auth) as the backend.
Three roles: **Buyer**, **Seller** and **Agent**.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the Supabase project's URL and anon key
   (Supabase dashboard → Project Settings → API). `.env` is not committed.
3. In the Supabase SQL Editor, run these files **once, in this order**:
   1. `supabase/schema.sql` — `profiles` table (role buyer / seller / agent) + trigger that fills it on sign up
   2. `supabase/schema_02_core_tables.sql` — properties, photos, offers, rental applications, enquiries,
      favourites, viewings, status history + security rules
   3. `supabase/schema_03_accept_rental.sql` — accepting a rental application
   4. `supabase/schema_04_lifecycle.sql` — listing lifecycle rules enforced by the database
   5. optional sample data: `supabase/seed_properties.sql`, then `supabase/seed_images.sql`
4. `npx expo start`, then scan the QR code with Expo Go (phone and computer on the same Wi-Fi).
   Without an Expo account: `npx expo start --offline`.
5. Tests (no network needed): `npm test`

## Accounts

Create an account from the app (**Sign up** on the login screen, choose Buyer, Seller or Agent).
If e-mail confirmation is switched on in Supabase (Authentication → Providers → Email), confirm the
e-mail first, then log in. The session is kept on the phone, so the app reopens signed in.

## What each role can do (Week 3)

| Role | Tabs | Features |
|---|---|---|
| Buyer | Browse · Favourites · My Activity · Profile | Search and filter (keyword / location, sale or rent, property type, price range), favourites, enquiries, viewing requests, offers (sale) and rental applications with move-in date and notes (active listings only), follow everything with its status in My Activity, pull to refresh |
| Seller | Properties · Requests · Enquiries · Profile | My properties with status filter, create a listing (draft or published, sample photos), edit, delete (draft / active only), publish / withdraw, complete the sale or rental, "deal fell through", status history, accept / reject offers and rental applications, confirm / decline viewings, answer enquiries |
| Agent | Properties · Enquiries · Requests · Stats | My / all properties, take a listing on or release it, edit and change status, status history, answer enquiries, accept / reject offers, applications and viewings, statistics (active listings per seller, average sale price and rent, offers per property) — see `docs/agent/README.md` |

## Listing lifecycle

```
Draft ──publish──▶ Active ──accept an offer / application──▶ Under offer ──▶ Sold (sale) / Rented (rent)
  ◀──withdraw──       ◀────────── deal fell through ──────────
```

- Accepting one offer (or application) rejects the other pending ones and moves the listing to Under offer.
- Sold and Rented are final (Sold → Active is refused).
- From Under offer, price, sale / rent, property type and location are locked; title, description and
  photos can still be edited.
- Every status change is written to `status_history` by a database trigger.
- The rules are checked in the app (`src/utils/agent/rules.js`) **and** in the database
  (`supabase/schema_04_lifecycle.sql`).

## Structure

```
App.js                                role-based routing, sign up, session restore
src/lib/                              Supabase client, profile lookup
src/screens/LoginScreen.js            log in, forgot password
src/screens/SignUpScreen.js           create an account with a role
src/screens/BuyerHomeScreen.js        Buyer tabs (PropertyList, PropertyDetail, BuyerActivity, BuyerProfile)
src/screens/SellerHomeScreen.js       Seller tabs (seller/*, CreatePropertyScreen, shared Requests / Enquiries)
src/screens/AgentHomeScreen.js        Agent tabs (agent/*)
src/services/seller/sellerService.js  Seller data access (Supabase)
src/services/agent/agentService.js    Agent data access (Supabase)
src/utils/agent/rules.js              lifecycle rules, validation, statistics
src/components/, src/hooks/           shared UI pieces
supabase/                             SQL to run in the Supabase SQL Editor
tests/                                unit tests with a fake Supabase client (npm test)
```

## Team

Noah Faelens · Viet Duy Le Derenne · Tristan
