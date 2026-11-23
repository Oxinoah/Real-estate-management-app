import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPortfolio, neighbours, pendingWork, portfolioSummary } from '../../src/utils/agent/rules.js';

const flat = {
  property_id: 1, title: 'Canal flat', location: 'London W9', status: 'active', seller: { full_name: 'Sam' },
  offers: [{ status: 'pending' }, { status: 'rejected' }],
  rental_applications: [],
  viewings: [{ status: 'requested' }, { status: 'confirmed' }],
  enquiries: [{ response: null }, { response: 'Yes' }, { response: '  ' }],
};
const house = { property_id: 2, title: 'Family house', location: 'Leeds', status: 'under_offer', seller: { full_name: 'Tom' } };
const studio = {
  property_id: 3, title: 'Studio', location: 'London NW1', status: 'active', seller: { full_name: 'Tom' },
  rental_applications: [{ status: 'pending' }, { status: 'pending' }],
};

test('pending work counts only what still needs an answer', () => {
  assert.deepEqual(pendingWork(flat), { offers: 1, applications: 0, viewings: 1, enquiries: 2, total: 4 });
  assert.equal(pendingWork(house).total, 0);
});

test('portfolio summary counts listings by status and all waiting requests', () => {
  const summary = portfolioSummary([flat, house, studio]);
  assert.equal(summary.count, 3);
  assert.equal(summary.byStatus.active, 2);
  assert.equal(summary.byStatus.under_offer, 1);
  assert.equal(summary.waiting, 6);
});

test('filter by status, search title / location / seller, sort by attention', () => {
  const all = [flat, house, studio];
  assert.deepEqual(filterPortfolio(all, { status: 'active' }).map((p) => p.property_id), [1, 3]);
  assert.deepEqual(filterPortfolio(all, { search: 'london' }).map((p) => p.property_id), [1, 3]);
  assert.deepEqual(filterPortfolio(all, { search: 'tom house' }).map((p) => p.property_id), [2]);
  assert.deepEqual(filterPortfolio(all, { sort: 'attention' }).map((p) => p.property_id), [1, 3, 2]);
  assert.deepEqual(filterPortfolio(all).map((p) => p.property_id), [1, 2, 3]);
});

test('previous / next follow the list the agent came from', () => {
  assert.deepEqual(neighbours([4, 8, 2], 8), { index: 1, total: 3, previous: 4, next: 2 });
  assert.deepEqual(neighbours([4, 8, 2], 4), { index: 0, total: 3, previous: null, next: 8 });
  assert.equal(neighbours([4, 8, 2], 99).index, -1);
});
