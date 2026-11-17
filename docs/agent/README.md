# Agent part

Built by Tristan, then adapted to run on the shared database and the same look
as the Buyer and Seller screens. Entry point: `src/screens/AgentHomeScreen.js`
(same props as the other homes: `session`, `onLogout`).

## What an agent can do

| Tab | Features |
|---|---|
| **Properties** | List the properties they manage ("My properties" or "All properties"), open one, edit it, publish / withdraw it, complete the sale / rental (or "deal fell through"), take it on ("Assign to me") or release it, see its status history |
| **Enquiries** | Read buyer enquiries and send a reply (the buyer sees it in My Activity) |
| **Requests** | Accept or reject purchase offers, rental applications and viewing requests |
| **Stats** | Active listings per seller, average sale price / monthly rent, number of offers per property |

## Rules

- "My properties" = `properties.agent_id` is the agent. At first launch, an
  agent with nothing assigned starts on "All properties".
- Accepting an offer calls `accept_offer` (schema_02): it rejects the other
  pending offers and sets the property to *Under offer*.
- Accepting a rental application calls `accept_rental_application`
  (`supabase/schema_03_accept_rental.sql`): it rejects the other pending
  applications and sets the property to *Under offer* (once
  `supabase/schema_04_lifecycle.sql` has been run); the rental is then
  completed from the property screen ("Complete rental").
- From *Under offer*, "Deal fell through" puts the listing back to *Active*.
- Once a property is sold or rented, the database refuses any status change.
- Edits use the listing's `updated_at` to refuse a change made on stale data.

## Files

```text
src/screens/AgentHomeScreen.js          tabs, My/All properties switch
src/screens/agent/                      list, detail, enquiries, requests, stats
src/components/agent/AgentUI.js         buttons, fields, cards
src/hooks/agent/useAgentResource.js     loading / action state
src/services/agent/agentService.js      Supabase queries (client injected)
src/utils/agent/rules.js                transitions, validation, statistics
supabase/schema_03_accept_rental.sql    rental acceptance function
tests/agent/agent.test.mjs              rules, statistics and service tests
```

Run the tests with `node --test tests/agent/agent.test.mjs`.

## Manual check

1. Sign in as an agent (`profiles.role = 'agent'`). Open a property and tap
   "Assign to me": it appears under "My properties".
2. As a buyer, send an enquiry, an offer and a viewing request on it.
3. As the agent, answer the enquiry, accept the offer, confirm the viewing.
4. As the buyer, check My Activity: the answer and the new statuses show up.
