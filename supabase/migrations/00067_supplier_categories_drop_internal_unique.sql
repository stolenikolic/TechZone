-- 00067_supplier_categories_drop_internal_unique.sql
-- Dozvoli više supplier source keyeva na istu internu kategoriju
-- (npr. CT SLUSALICE + MOBILPHEAR → slusalice).
-- Ne stavljamo UNIQUE(supplier_id, supplier_category_key): iPon namjerno
-- dijeli isti category id na više internih preko različitih listing_url filtera.

ALTER TABLE public.supplier_categories
  DROP CONSTRAINT IF EXISTS supplier_categories_unique;

-- Preostale jasne ComTrade grupe (isti internal kao već mapirane grupe).
INSERT INTO public.supplier_categories (
  supplier_id,
  internal_category_id,
  supplier_category_key,
  listing_url,
  is_active,
  sort_order
)
VALUES
  -- slušalice (mobilne) → slusalice
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '7f6d1ef7-eb55-4159-900c-00f2df15fb12', 'MOBILPHEAR', NULL, true, 131),
  -- printeri → stampaci
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '248478ef-a4f0-41d6-a01a-146c707b69e2', 'PRINTERIJ', NULL, true, 171),
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '248478ef-a4f0-41d6-a01a-146c707b69e2', 'PRINTERL', NULL, true, 172),
  -- foto opcije → foto-i-video-pribor
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '3fbfd442-fe5d-4437-ac5d-619dfddf74db', 'PHOTOOPT', NULL, true, 271),
  -- fiksni telefoni → klasicni-telefoni
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '350cdf42-1872-4f54-8a49-c5c1899d1487', 'TELEFONFIX', NULL, true, 331),
  -- smart band → pametni-satovi-i-narukvice
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '00c412ca-7622-45c2-9a69-d8dc041f99fc', 'SMARTBAND', NULL, true, 351),
  -- mreža wireless → mrezni-dodaci
  ('e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b', '6d790079-7b33-40f6-a80c-7e56f3900874', 'NETWORKWRL', NULL, true, 411);
