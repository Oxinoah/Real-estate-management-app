import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentService, readAllPages } from '../../src/services/agent/agentService.js';

const identity = 'agent-a';
const ready = { version: 1, agent_id: identity, rental_acceptance: false };

function fakeClient(options = {}) {
  const calls = [];
  return {
    calls,
    async rpc(name, args) {
      calls.push({ name, args });
      if (options.respond) return options.respond(name, args);
      const data = {
        agent_integration_status: ready,
        agent_update_property: { ...args?.p_values, property_id: args?.p_property_id, agent_id: identity },
        agent_change_property_status: { property_id: args?.p_property_id, agent_id: identity, status: args?.p_status },
        agent_reply_enquiry: { enquiry_id: args?.p_enquiry_id, response: args?.p_response },
        agent_decide_offer: { offer_id: args?.p_offer_id, status: args?.p_decision },
        agent_reject_application: { application_id: args?.p_application_id, status: 'rejected' },
      };
      return { data: data[name], error: null };
    },
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      const query = {
        select(fields, settings) { call.fields = fields; call.settings = settings; return query; },
        eq(key, value) { call.filters.push([key, value]); return query; },
        order(key, settings) { call.order = [key, settings]; return query; },
        async single() { return options.single || { data: null }; },
        async range(start, end) {
          call.range = [start, end];
          if (options.tableErrors?.[table]) return { error: options.tableErrors[table] };
          return { data: options.rows || [], count: options.rows?.length || 0, error: null };
        },
      };
      return query;
    },
  };
}

test('all pages are fetched even if the server caps pages below 200 records', async () => {
  const rows = Array.from({ length: 7 }, (_, id) => ({ id }));
  const ranges = [];
  const result = await readAllPages(() => ({ range: async (start, end) => {
    ranges.push([start, end]);
    return { data: rows.slice(start, Math.min(start + 2, end + 1)), count: rows.length, error: null };
  } }), 'id');
  assert.deepEqual(result, rows);
  assert.deepEqual(ranges.map(([start]) => start), [0, 2, 4, 6]);
});

test('empty counted results are distinct from failed or truncated results', async () => {
  assert.deepEqual(await readAllPages(() => ({ range: async () => ({ data: [], count: 0 }) }), 'id'), []);
  await assert.rejects(readAllPages(() => ({ range: async () => ({ data: [], count: 3 }) }), 'id'), /truncated/);
  await assert.rejects(readAllPages(() => ({ range: async () => ({ data: [], count: null }) }), 'id'), /counted result/);
});

test('pagination rejects concurrent count changes and duplicate records', async () => {
  let page = 0;
  await assert.rejects(readAllPages(() => ({ range: async () => (++page === 1
    ? { data: [{ id: 1 }], count: 3 } : { data: [{ id: 2 }], count: 2 }) }), 'id'), /changed/);
  await assert.rejects(readAllPages(() => ({ range: async () => ({ data: [{ id: 1 }, { id: 1 }], count: 2 }) }), 'id'), /changed/);
});

test('permission errors do not become empty lists or expose arbitrary server details', async () => {
  await assert.rejects(readAllPages(() => ({ range: async () => ({ error: { code: '42501', message: 'untrusted server detail' } }) }), 'id'), (error) => {
    assert.match(error.message, /Access denied/);
    assert.doesNotMatch(error.message, /untrusted server detail/);
    return true;
  });
});

test('portfolio and related queries use the real agent identity and counted stable ordering', async () => {
  const client = fakeClient();
  const service = createAgentService(client, identity);
  await service.loadPortfolio();
  await service.loadOffers();
  await service.loadApplications();
  await service.loadEnquiries();
  assert.deepEqual(client.calls[0].filters, [['agent_id', identity]]);
  for (const query of client.calls) assert.equal(query.settings.count, 'exact');
  assert.deepEqual(client.calls[1].filters, [['properties.agent_id', identity], ['properties.transaction_type', 'sale']]);
  assert.deepEqual(client.calls[2].filters, [['properties.agent_id', identity], ['properties.transaction_type', 'rent']]);
  assert.match(client.calls[3].fields, /properties!inner/);
});

test('unavailable history does not hide an otherwise readable assigned property', async () => {
  const property = { property_id: 9, agent_id: identity };
  const client = fakeClient({ single: { data: property }, tableErrors: { status_history: { code: '42501' } } });
  const result = await createAgentService(client, identity).loadProperty(9);
  assert.deepEqual(result.property, property);
  assert.equal(result.history.status, 'rejected');
  assert.equal(result.images.status, 'fulfilled');
  assert.deepEqual(client.calls[0].filters, [['agent_id', identity], ['property_id', 9]]);
});

test('a missing or mismatched backend contract blocks writes', async () => {
  for (const response of [{ error: { code: 'PGRST202' } }, { data: { ...ready, agent_id: 'agent-b' } }, { data: { ...ready, version: 2 } }]) {
    const client = fakeClient({ respond: () => response });
    await assert.rejects(createAgentService(client, identity).decideOffer(1, 'accepted'));
    assert.equal(client.calls.length, 1);
    assert.equal(client.calls[0].name, 'agent_integration_status');
  }
});

test('listing updates send only allowed fields and an optimistic version', async () => {
  const client = fakeClient();
  await createAgentService(client, identity).updateProperty({ property_id: 9, updated_at: 'version-a' }, {
    title: 'Title', description: '', location: 'London', price: '100.50', property_type: 'Flat', transaction_type: 'sale', agent_id: 'agent-b', seller_id: 'seller-b', status: 'sold',
  });
  assert.equal(client.calls[1].name, 'agent_update_property');
  assert.equal(client.calls[1].args.p_expected_updated_at, 'version-a');
  assert.equal(client.calls[1].args.p_values.price, 100.5);
  assert.deepEqual(Object.keys(client.calls[1].args.p_values).sort(), ['description', 'location', 'price', 'property_type', 'title', 'transaction_type']);
});

test('reply uses the response RPC and expected value, never an author or property update', async () => {
  const client = fakeClient();
  await createAgentService(client, identity).reply({ enquiry_id: 3, response: null, buyer_id: 'buyer-a', property_id: 9 }, ' A response ');
  assert.deepEqual(client.calls[1], { name: 'agent_reply_enquiry', args: { p_enquiry_id: 3, p_response: 'A response', p_expected_response: null } });
});

test('offer acceptance uses one decision RPC rather than independent client updates', async () => {
  const client = fakeClient();
  await createAgentService(client, identity).decideOffer(5, 'accepted');
  assert.deepEqual(client.calls.map((call) => call.name), ['agent_integration_status', 'agent_decide_offer']);
  assert.deepEqual(client.calls[1].args, { p_offer_id: 5, p_decision: 'accepted' });
});

test('undefined rental acceptance and empty responses are blocked without network requests', () => {
  const client = fakeClient();
  const service = createAgentService(client, identity);
  assert.throws(() => service.decideApplication(1, 'accepted'), /unavailable/);
  assert.throws(() => service.reply({ enquiry_id: 1 }, ' '), /non-empty/);
  assert.equal(client.calls.length, 0);
});

test('no successful acknowledgement is invented for a null or failed mutation', async () => {
  for (const mutation of [{ data: null }, { data: false }, { data: {} }, { data: { offer_id: 2, status: 'accepted' } }, { data: { offer_id: 1, status: 'pending' } }, { error: { code: '40001' } }]) {
    const client = fakeClient({ respond: (name) => name === 'agent_integration_status' ? { data: ready } : mutation });
    await assert.rejects(createAgentService(client, identity).decideOffer(1, 'accepted'));
  }
});

test('rental rejection and publication use their own confirmed RPC results', async () => {
  const client = fakeClient();
  const service = createAgentService(client, identity);
  assert.equal((await service.decideApplication(7, 'rejected')).status, 'rejected');
  assert.equal((await service.changeStatus({ property_id: 9, updated_at: 'version-a' }, 'active')).status, 'active');
  assert.deepEqual(client.calls.filter((call) => call.name !== 'agent_integration_status').map((call) => call.name), ['agent_reject_application', 'agent_change_property_status']);
});

test('thrown transport errors are reported without exposing their arbitrary details', async () => {
  const client = fakeClient({ respond: () => { throw new Error('untrusted transport detail'); } });
  await assert.rejects(createAgentService(client, identity).readiness(), (error) => {
    assert.doesNotMatch(error.message, /untrusted transport detail/);
    assert.match(error.message, /request failed/);
    return true;
  });
});

test('statistics use a server aggregate and refuse truncated aggregate payloads', async () => {
  const client = fakeClient({ respond: () => ({ data: { property_count: 2, sale: { count: 2, average: 100 }, rent: { count: 0, average: null }, active_by_seller: [{ seller_id: 'seller-a', active_count: 1 }], offers_by_property: [{ property_id: 1, offer_count: 0 }] } }) });
  await assert.rejects(createAgentService(client, identity).loadStats(), /incomplete statistics/);
  assert.equal(client.calls[0].name, 'agent_portfolio_stats');
});
