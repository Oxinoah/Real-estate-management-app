import test from 'node:test';
import assert from 'node:assert/strict';
import { canEditProperty, propertyTransitions, validateProperty, validateStats, money } from '../../src/utils/agent/rules.js';

const values = { title: ' House ', description: ' Description ', price: '1200,50', transaction_type: 'rent', property_type: 'House', location: ' London ' };
const stats = () => ({
  property_count: 2, sale: { count: 1, average: 100000 }, rent: { count: 1, average: 900 },
  active_by_seller: [{ seller_id: 'seller-a', active_count: 1 }],
  offers_by_property: [{ property_id: 1, offer_count: 2 }, { property_id: 2, offer_count: 0 }],
});

test('listing validation trims fields, accepts decimal comma and strips ownership fields', () => {
  const result = validateProperty({ ...values, seller_id: 'other', agent_id: 'other', status: 'sold' });
  assert.deepEqual(result.errors, []);
  assert.equal(result.values.price, 1200.5);
  assert.equal(result.values.title, 'House');
  assert.equal(result.values.location, 'London');
  assert.equal('seller_id' in result.values, false);
  assert.equal('agent_id' in result.values, false);
  assert.equal('status' in result.values, false);
});

test('invalid or out-of-range prices cannot reach the service', () => {
  for (const price of ['', '0', '-1', 'NaN', 'Infinity', '1e4', '1.123', '10000000000', '1,000.50']) {
    assert.ok(validateProperty({ ...values, price }).errors.length, `price ${price} should fail`);
  }
  assert.deepEqual(validateProperty({ ...values, price: '9999999999.99' }).errors, []);
});

test('required fields and sale/rent are validated', () => {
  assert.equal(validateProperty({ ...values, title: ' ', location: '', property_type: '', transaction_type: 'other' }).errors.length, 4);
});

test('editing and manual transitions stay conservative', () => {
  for (const status of ['draft', 'active']) assert.equal(canEditProperty({ status }), true);
  for (const status of ['under_offer', 'sold', 'rented', 'unknown']) assert.equal(canEditProperty({ status }), false);
  assert.deepEqual(propertyTransitions({ status: 'draft', transaction_type: 'rent' }).map((r) => r.status), ['active']);
  assert.deepEqual(propertyTransitions({ status: 'under_offer', transaction_type: 'sale' }).map((r) => r.status), ['sold']);
  for (const property of [{ status: 'active' }, { status: 'sold' }, { status: 'under_offer', transaction_type: 'rent' }]) {
    assert.deepEqual(propertyTransitions(property), []);
  }
});

test('statistics retain zero-offer properties and separate sales and rents', () => {
  const result = validateStats(stats());
  assert.equal(result.offers_by_property[1].offer_count, 0);
  assert.notEqual(result.sale.average, result.rent.average);
  assert.equal(money('950.25'), '€950.25');
});

test('an empty portfolio has no invented average', () => {
  assert.doesNotThrow(() => validateStats({ property_count: 0, sale: { count: 0, average: null }, rent: { count: 0, average: null }, active_by_seller: [], offers_by_property: [] }));
});

test('incomplete or inconsistent statistics are refused rather than displayed as totals', () => {
  const truncated = stats(); truncated.offers_by_property.pop();
  const wrongCount = stats(); wrongCount.sale.count = 3;
  const duplicate = stats(); duplicate.offers_by_property[1].property_id = 1;
  const invalid = stats(); invalid.rent.average = 'NaN';
  for (const value of [null, {}, truncated, wrongCount, duplicate, invalid]) {
    assert.throws(() => validateStats(value), /incomplete statistics/);
  }
});
