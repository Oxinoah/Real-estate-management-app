// Agent rules shared by the screens (no database access here).
export const AGENT_TABS = [
  { key: 'properties', label: 'Properties' },
  { key: 'enquiries', label: 'Enquiries' },
  { key: 'requests', label: 'Requests' },
  { key: 'stats', label: 'Stats' },
];

// Content can be edited while the listing is still being prepared or live.
export function canEditProperty(property) {
  return ['draft', 'active'].includes(property.status);
}

// Once a property is under offer these fields are frozen (the database
// refuses the change too, see supabase/schema_04_lifecycle.sql).
export const LOCKED_AFTER_OFFER = ['price', 'transaction_type', 'property_type', 'location'];

export function isLocked(property, field) {
  return property.status !== 'draft' && property.status !== 'active' && LOCKED_AFTER_OFFER.includes(field);
}

// A listing can only be deleted before a deal is in progress.
export function canDeleteProperty(property) {
  return ['draft', 'active'].includes(property.status);
}

// Status changes that can be made by hand from a property screen:
//   Draft -> Active -> Under offer -> Sold (sale) / Rented (rent)
// "Under offer" is set by accepting an offer or a rental application, never by
// hand. Sold and Rented are final. The database checks the same rules.
export function propertyTransitions(property) {
  const rent = property.transaction_type === 'rent';
  if (property.status === 'draft') return [{ status: 'active', label: 'Publish listing' }];
  if (property.status === 'active') return [{ status: 'draft', label: 'Withdraw listing (back to draft)' }];
  if (property.status === 'under_offer') {
    return [
      rent ? { status: 'rented', label: 'Complete rental' } : { status: 'sold', label: 'Complete sale' },
      { status: 'active', label: 'Deal fell through (back to active)' },
    ];
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
    errors.push('Enter a positive price with at most two decimal places.');
  }
  if (!['sale', 'rent'].includes(values.transaction_type)) errors.push('Choose sale or rent.');
  return {
    errors,
    // Only these fields are ever sent to the database.
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

// The three statistics asked by the project: active listings per user (seller),
// average price, and number of offers per property.
export function computeStats(properties, offers) {
  const average = (list) =>
    list.length ? Math.round((list.reduce((sum, p) => sum + Number(p.price), 0) / list.length) * 100) / 100 : null;
  const sale = properties.filter((p) => p.transaction_type === 'sale');
  const rent = properties.filter((p) => p.transaction_type === 'rent');

  const bySeller = new Map();
  for (const p of properties) {
    const entry = bySeller.get(p.seller_id) || { seller_id: p.seller_id, full_name: p.seller?.full_name || '', active_count: 0 };
    if (p.status === 'active') entry.active_count += 1;
    bySeller.set(p.seller_id, entry);
  }

  const counts = new Map();
  for (const o of offers) counts.set(o.property_id, (counts.get(o.property_id) || 0) + 1);

  return {
    property_count: properties.length,
    sale: { count: sale.length, average: average(sale) },
    rent: { count: rent.length, average: average(rent) },
    active_by_seller: [...bySeller.values()],
    offers_by_property: properties.map((p) => ({
      property_id: p.property_id,
      title: p.title,
      transaction_type: p.transaction_type,
      offer_count: counts.get(p.property_id) || 0,
    })),
  };
}

// ---------------------------------------------------------------------------
// Several properties at once (Week 4: agent multi-property access)
// ---------------------------------------------------------------------------

// What is still waiting for an answer on one property. Uses the rows loaded
// with it by agentService.loadPortfolio (offers, rental applications,
// viewings and enquiries, with only their status / response).
export function pendingWork(property) {
  const count = (rows, waiting) => (rows || []).filter(waiting).length;
  const offers = count(property.offers, (r) => r.status === 'pending');
  const applications = count(property.rental_applications, (r) => r.status === 'pending');
  const viewings = count(property.viewings, (r) => r.status === 'requested');
  const enquiries = count(property.enquiries, (r) => !String(r.response ?? '').trim());
  return { offers, applications, viewings, enquiries, total: offers + applications + viewings + enquiries };
}

// One line for the top of the Properties tab: how many listings, by status,
// and how many requests are waiting across all of them.
export function portfolioSummary(properties) {
  const byStatus = { draft: 0, active: 0, under_offer: 0, sold: 0, rented: 0 };
  let waiting = 0;
  for (const p of properties) {
    if (p.status in byStatus) byStatus[p.status] += 1;
    waiting += pendingWork(p).total;
  }
  return { count: properties.length, byStatus, waiting };
}

// Status filter + search (title, location or seller) + sort.
// sort: 'recent' (newest first, as loaded) or 'attention' (most requests waiting first).
export function filterPortfolio(properties, { status = 'all', search = '', sort = 'recent' } = {}) {
  const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown = properties.filter((p) => {
    if (status !== 'all' && p.status !== status) return false;
    const text = `${p.title} ${p.location} ${p.seller?.full_name || ''}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
  if (sort === 'attention') {
    return shown
      .map((p, i) => ({ p, i, n: pendingWork(p).total }))
      .sort((a, b) => b.n - a.n || a.i - b.i)
      .map((x) => x.p);
  }
  return shown;
}

// Position of a property in the list the agent came from, for the
// "Previous / Next" buttons of the property screen.
export function neighbours(ids, id) {
  const index = ids.indexOf(id);
  if (index === -1) return { index: -1, total: ids.length, previous: null, next: null };
  return {
    index,
    total: ids.length,
    previous: index > 0 ? ids[index - 1] : null,
    next: index < ids.length - 1 ? ids[index + 1] : null,
  };
}
