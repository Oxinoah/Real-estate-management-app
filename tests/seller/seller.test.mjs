import test from 'node:test';
import assert from 'node:assert/strict';
import { createSellerService, pendingCount } from '../../src/services/seller/sellerService.js';

// A tiny chainable fake of the Supabase query builder, recording the calls.
function fakeClient(...results) {
  const calls = [];
  let i = 0;
  const next = () => results[Math.min(i++, results.length - 1)];
  const builder = new Proxy({}, {
    get(_, name) {
      if (name === 'then') return (resolve) => resolve(next());
      return (...args) => { calls.push([name, ...args]); return builder; };
    },
  });
  return {
    calls,
    from: (table) => { calls.push(['from', table]); return builder; },
    rpc: (...a) => { calls.push(['rpc', ...a]); return Promise.resolve(next()); },
  };
}

const ok = (data) => ({ data, error: null });
const values = { title: 'Flat', description: '', price: '250000', transaction_type: 'sale', property_type: 'Apartment', location: 'London' };
const has = (calls, ...expected) => calls.some((c) => expected.every((v, k) => JSON.stringify(c[k]) === JSON.stringify(v)));

test('a seller only loads their own properties', async () => {
  const client = fakeClient(ok([]));
  await createSellerService(client, 'seller-1').loadPortfolio();
  assert.ok(has(client.calls, 'eq', 'seller_id', 'seller-1'));
});

test('creating a listing sets the seller, the status and saves the mocked photos', async () => {
  const client = fakeClient(ok({ property_id: 9 }), ok(null), ok(null));
  await createSellerService(client, 'seller-1').createProperty(values, 'draft', ['https://img/1.jpg']);
  const insert = client.calls.find((c) => c[0] === 'insert');
  assert.equal(insert[1].seller_id, 'seller-1');
  assert.equal(insert[1].status, 'draft');
  assert.equal(insert[1].price, 250000);
  assert.ok(has(client.calls, 'insert', [{ property_id: 9, url: 'https://img/1.jpg' }]));
});

test('invalid listings and statuses are refused before any request', async () => {
  const client = fakeClient(ok(null));
  const service = createSellerService(client, 's');
  await assert.rejects(service.createProperty({ ...values, title: ' ' }, 'draft'), /Title is required/);
  await assert.rejects(service.createProperty(values, 'sold'), /draft or active/);
  assert.equal(client.calls.length, 0);
});

test('price, type and location are locked once the property is under offer', async () => {
  const property = { property_id: 1, status: 'under_offer', updated_at: 't', ...values, price: 250000 };
  const client = fakeClient(ok({ property_id: 1 }));
  const service = createSellerService(client, 's');
  await assert.rejects(service.updateProperty(property, { ...values, price: '260000' }), /cannot be changed/);
  await assert.rejects(service.updateProperty(property, { ...values, location: 'Leeds' }), /cannot be changed/);
  assert.equal(client.calls.length, 0);
  // The title and the description can still be improved.
  await service.updateProperty(property, { ...values, title: 'Renovated flat' });
  assert.ok(has(client.calls, 'eq', 'seller_id', 's'));
  await assert.rejects(service.updateProperty({ ...property, status: 'sold' }, values), /no longer be edited/);
});

test('only draft or active listings can be deleted', async () => {
  const client = fakeClient(ok([{ property_id: 1 }]));
  const service = createSellerService(client, 's');
  await assert.rejects(service.deleteProperty({ property_id: 1, status: 'under_offer' }), /draft or active/);
  assert.equal(client.calls.length, 0);
  assert.equal(await service.deleteProperty({ property_id: 1, status: 'active' }), true);
  assert.ok(has(client.calls, 'in', 'status', ['draft', 'active']));
});

test('requests are limited to the seller\'s properties; accepting uses the database functions', async () => {
  const client = fakeClient(ok([]));
  const service = createSellerService(client, 's');
  await service.loadOffers('all');
  assert.ok(has(client.calls, 'eq', 'properties.seller_id', 's'));
  await service.decideOffer(7, 'accepted');
  await service.decideApplication(8, 'accepted');
  assert.ok(has(client.calls, 'rpc', 'accept_offer', { p_offer_id: 7 }));
  assert.ok(has(client.calls, 'rpc', 'accept_rental_application', { p_application_id: 8 }));
});

test('a stale status change is refused instead of overwriting newer data', async () => {
  const client = fakeClient(ok(null));
  await assert.rejects(
    createSellerService(client, 's').changeStatus({ property_id: 1, updated_at: 't0' }, 'active'),
    /changed or is no longer available/,
  );
});

test('pending count adds offers and applications still waiting', () => {
  assert.equal(pendingCount({ offers: [{ status: 'pending' }, { status: 'rejected' }], rental_applications: [{ status: 'pending' }] }), 2);
  assert.equal(pendingCount({}), 0);
});
