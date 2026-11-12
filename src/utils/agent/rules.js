// Conservative rules until the team defines protected fields and rental completion.
export const AGENT_TABS = [
  { key: 'properties', label: 'Properties' },
  { key: 'enquiries', label: 'Enquiries' },
  { key: 'offers', label: 'Offers' },
  { key: 'applications', label: 'Rentals' },
  { key: 'stats', label: 'Stats' },
];

export const RENTAL_ACCEPTANCE_NOTICE =
  'Acceptance is unavailable until the team defines its effect on the listing status.';

export function canEditProperty(property) {
  return ['draft', 'active'].includes(property.status);
}

export function propertyTransitions(property) {
  if (property.status === 'draft') return [{ status: 'active', label: 'Publish listing' }];
  if (property.status === 'under_offer' && property.transaction_type === 'sale') {
    return [{ status: 'sold', label: 'Complete sale' }];
  }
  return [];
}

export function validateProperty(values) {
  const priceText = String(values.price ?? '').trim().replace(',', '.');
  const errors = [];
  for (const [key, label] of [['title', 'Title'], ['location', 'Location'], ['property_type', 'Property type']]) {
    if (!String(values[key] ?? '').trim()) errors.push(`${label} is required.`);
  }
  const price = Number(priceText);
  if (!/^\d+(\.\d{1,2})?$/.test(priceText) || !Number.isFinite(price) || price <= 0 || price > 9999999999.99) {
    errors.push('Enter a positive price with at most two decimal places (maximum 9,999,999,999.99).');
  }
  if (!['sale', 'rent'].includes(values.transaction_type)) errors.push('Choose sale or rent.');
  return {
    errors,
    // Only these fields may be sent to the update RPC.
    values: {
      title: String(values.title ?? '').trim(),
      description: String(values.description ?? '').trim(),
      price,
      transaction_type: values.transaction_type,
      property_type: String(values.property_type ?? '').trim(),
      location: String(values.location ?? '').trim(),
    },
  };
}

export function money(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? `€${number.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'Unavailable';
}

export function dateTime(value) {
  const date = new Date(value);
  return value && !Number.isNaN(date.getTime()) ? date.toLocaleString('en-GB') : 'Unknown date';
}

export function validateStats(stats) {
  const isCount = (n) => Number.isSafeInteger(n) && n >= 0;
  const validAverage = (group) => group && isCount(group.count) &&
    (group.count === 0 ? group.average === null : group.average != null && Number.isFinite(Number(group.average)) && Number(group.average) > 0);
  if (!stats || !isCount(stats.property_count) || !validAverage(stats.sale) || !validAverage(stats.rent) ||
    stats.sale.count + stats.rent.count !== stats.property_count ||
    !Array.isArray(stats.active_by_seller) || !Array.isArray(stats.offers_by_property) ||
    stats.offers_by_property.length !== stats.property_count ||
    stats.offers_by_property.some((p) => p.property_id == null || !isCount(p.offer_count)) ||
    new Set(stats.offers_by_property.map((p) => String(p.property_id))).size !== stats.property_count ||
    stats.active_by_seller.some((s) => !s.seller_id || !isCount(s.active_count)) ||
    stats.active_by_seller.reduce((sum, s) => sum + s.active_count, 0) > stats.property_count ||
    (stats.property_count > 0 && stats.active_by_seller.length === 0)) {
    throw new Error('The database returned incomplete statistics. No totals are displayed. Refresh or check the Agent integration.');
  }
  return stats;
}
