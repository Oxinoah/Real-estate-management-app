-- Sample photos for the sample listings (Unsplash). Run it in the Supabase
-- SQL Editor; it replaces any previous sample images, so it is safe to re-run.
-- Replace the urls with your own photos whenever you like.
delete from public.property_images;

insert into public.property_images (property_id, url)
select p.property_id, v.url
from public.properties p
join (values
  ('Bright 2-bedroom apartment', 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80'),
  ('Bright 2-bedroom apartment', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80'),
  ('Family house with garden',   'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80'),
  ('Family house with garden',   'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&q=80'),
  ('Furnished studio near campus','https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80'),
  ('Loft with city view',        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80'),
  ('Loft with city view',        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80')
) as v(title, url) on v.title = p.title;
