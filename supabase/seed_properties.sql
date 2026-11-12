-- Sample listings so the Buyer screens have real data to show.
-- Run once in the Supabase SQL Editor. Properties are owned by the 'seller'
-- user if one exists, otherwise by the first profile.
insert into public.properties (seller_id, title, description, price, transaction_type, property_type, location, status)
select s.id, v.title, v.description, v.price, v.transaction_type, v.property_type, v.location, v.status
from (
  select coalesce(
    (select id from public.profiles where role = 'seller' limit 1),
    (select id from public.profiles order by created_at limit 1)
  ) as id
) s,
(values
  ('Bright 2-bedroom apartment', 'Second-floor apartment with a south-facing living room, two bedrooms and a renovated kitchen. Close to the metro and local shops.', 485000, 'sale', 'Apartment', 'Paris 11e', 'active'),
  ('Family house with garden', 'Four-bedroom house on a quiet street with a private garden, garage and a finished attic. Walking distance to schools.', 890000, 'sale', 'House', 'Versailles', 'active'),
  ('Furnished studio near campus', 'Compact furnished studio with a separate kitchenette, ideal for a student or a young professional. Charges included.', 950, 'rent', 'Studio', 'Paris 13e', 'active'),
  ('Loft with city view', 'Open-plan loft on the top floor with large windows, a mezzanine bedroom and a lift in the building.', 1800, 'rent', 'Apartment', 'Lyon 2e', 'active')
) as v(title, description, price, transaction_type, property_type, location, status);
