-- Adds 3 sample photos to each sample listing (picsum.photos placeholders —
-- replace the urls with real photos whenever you like).
-- Safe to run more than once: listings that already have images are skipped.
insert into public.property_images (property_id, url)
select p.property_id, 'https://picsum.photos/seed/' || p.property_id || '-' || n || '/800/500'
from public.properties p
cross join generate_series(1, 3) as n
where not exists (select 1 from public.property_images i where i.property_id = p.property_id);
