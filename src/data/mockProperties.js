// Sample data for the Week 2 screens. Field names match the `properties`
// table (supabase/schema_02_core_tables.sql), so these screens can switch to
// real Supabase queries in Week 3 without changing their markup.
export const MOCK_PROPERTIES = [
  {
    property_id: 1,
    title: 'Bright 2-bedroom apartment',
    location: 'Paris 11e',
    property_type: 'Apartment',
    transaction_type: 'sale',
    price: 485000,
    status: 'active',
    description:
      'Second-floor apartment with a south-facing living room, two bedrooms and a renovated kitchen. Close to the metro and local shops.',
  },
  {
    property_id: 2,
    title: 'Family house with garden',
    location: 'Versailles',
    property_type: 'House',
    transaction_type: 'sale',
    price: 890000,
    status: 'under_offer',
    description:
      'Four-bedroom house on a quiet street with a private garden, garage and a finished attic. Walking distance to schools.',
  },
  {
    property_id: 3,
    title: 'Furnished studio near campus',
    location: 'Paris 13e',
    property_type: 'Studio',
    transaction_type: 'rent',
    price: 950,
    status: 'active',
    description:
      'Compact furnished studio with a separate kitchenette, ideal for a student or a young professional. Charges included.',
  },
  {
    property_id: 4,
    title: 'Loft with city view',
    location: 'Lyon 2e',
    property_type: 'Apartment',
    transaction_type: 'rent',
    price: 1800,
    status: 'active',
    description:
      'Open-plan loft on the top floor with large windows, a mezzanine bedroom and a lift in the building.',
  },
];
