import test from 'node:test';
import assert from 'node:assert/strict';
import { canEditProperty, computeStats, propertyTransitions, validateProperty } from '../../src/utils/agent/rules.js';
import { createAgentService } from '../../src/services/agent/agentService.js';

const base = { title: ' House ', description: 'd', price: '1200,50', transaction_type: 'rent', property_type: 'House', location: ' London ' };

test('validation trims fields, accepts a decimal comma and drops ownership fields', () => {
  const result = validateProperty({ ...base, seller_id: 'x', agent_id: 'y', status: 'sold' });
  assert.deepEqual(result.errors, []);
  assert.equal(result.values.price, 1200.5);
  assert.equal(result.values.title, 'House');
  for (const key of ['seller_id', 'agent_id', 'status']) assert.equal(key in result.values, false);
});

test('invalid prices and empty fields are refused', () => {
  for (const price of ['', '0', '-1', 'abc', '1.123', '10000000000']) {
    assert.ok(validateProperty({ ...base, price }).errors.length, `price ${price}`);
  }
  assert.ok(validateProperty({ ...base, title: '  ' }).errors.length);
});

test('status moves follow the listing rules', () => {
  assert.deepEqual(propertyTransitions({ status: 'draft', transaction_type: 'sale' }).map((t) => t.status), ['active']);
  assert.deepEqual(propertyTransitions({ status: 'active', transaction_type: 'sale' }).map((t) => t.status), ['draft']);
  assert.deepEqual(propertyTransitions({ status: 'active', transaction_type: 'rent' }).map((t) => t.status), ['draft', 'rented']);
  assert.deepEqual(propertyTransitions({ status: 'under_offer', transaction_type: 'sale' }).map((t) => t.status), ['sold']);
  for (const status of ['sold', 'rented']) assert.deepEqual(propertyTransitions({ status, transaction_type: 'sale' }), []);
  assert.equal(canEditProperty({ status: 'under_offer' }), false);
});

test('statistics: active listings per seller, average price, offers per property', () => {
  const properties = [
    { property_id: 1, title: 'A', seller_id: 's1', seller: { full_name: 'Sam' }, status: 'active', transaction_type: 'sale', price: 100000 },
    { property_id: 2, title: 'B', seller_id: 's1', seller: { full_name: 'Sam' }, status: 'draft', transaction_type: 'sale', price: 300000 },
    { property_id: 3, title: 'C', seller_id: 's2', seller: null, status: 'active', transaction_type: 'rent', price: 900 },
  ];
  const stats = computeStats(properties, [{ property_id: 1 }, { property_id: 1 }, { property_id: 3 }]);
  assert.equal(stats.property_count, 3);
  assert.deepEqual(stats.sale, { count: 2, average: 200000 });
  assert.deepEqual(stats.rent, { count: 1, average: 900 });
  assert.deepEqual(stats.active_by_seller.map((s) => [s.seller_id, s.active_count]), [['s1', 1], ['s2', 1]]);
  assert.deepEqual(stats.offers_by_property.map((p) => p.offer_count), [2, 0, 1]);
  assert.deepEqual(computeStats([], []).sale, { count: 0, average: null });
});

// A tiny chainable fake of the Supabase query builder, recording the calls.
function fakeClient(result) {
  const calls = [];
  const builder = new Proxy({}, {
    get(_, name) {
      if (name === 'then') return (resolve) => resolve(result);
      return (...args) => { calls.push([name, ...args]); return builder; };
    },
  });
  return { calls, from: (table) => { calls.push(['from', table]); return builder; }, rpc: (...a) => { calls.push(['rpc', ...a]); return Promise.resolve(result); } };
}

test('"mine" filters on the agent id, "all" does not', async () => {
  const mine = fakeClient({ data: [], error: null });
  await createAgentService(mine, 'agent-1').loadPortfolio('mine');
  assert.ok(mine.calls.some((c) => c[0] === 'eq' && c[1] === 'agent_id' && c[2] === 'agent-1'));
  const all = fakeClient({ data: [], error: null });
  await createAgentService(all, 'agent-1').loadPortfolio('all');
  assert.equal(all.calls.some((c) => c[0] === 'eq'), false);
});

test('accepting an offer uses the accept_offer function; rejecting only touches pending offers', async () => {
  const accept = fakeClient({ data: null, error: null });
  await createAgentService(accept, 'a').decideOffer(7, 'accepted');
  assert.deepEqual(accept.calls[0], ['rpc', 'accept_offer', { p_offer_id: 7 }]);
  const reject = fakeClient({ data: { offer_id: 7 }, error: null });
  await createAgentService(reject, 'a').decideOffer(7, 'rejected');
  assert.ok(reject.calls.some((c) => c[0] === 'in' && c[1] === 'status' && c[2][0] === 'pending'));
});

test('a stale edit is refused instead of overwriting newer data', async () => {
  const client = fakeClient({ data: null, error: null });
  await assert.rejects(
    createAgentService(client, 'a').changeStatus({ property_id: 1, updated_at: 't0' }, 'active'),
    /changed or is no longer available/,
  );
});

test('an empty reply is refused before any request', async () => {
  const client = fakeClient({ data: null, error: null });
  await assert.rejects(createAgentService(client, 'a').reply({ enquiry_id: 1 }, '   '), /non-empty/);
  assert.equal(client.calls.length, 0);
});
