const STATUS_LABELS = {
  draft: 'Draft',
  active: 'Active',
  under_offer: 'Under offer',
  sold: 'Sold',
  rented: 'Rented',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function withThousands(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatPrice(property) {
  const amount = `€${withThousands(property.price)}`;
  return property.transaction_type === 'rent' ? `${amount} / month` : amount;
}

export function transactionLabel(transactionType) {
  return transactionType === 'rent' ? 'For rent' : 'For sale';
}
