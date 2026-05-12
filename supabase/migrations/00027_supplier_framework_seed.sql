-- 00027_supplier_framework_seed.sql
-- Populates the framework tables from the existing hardcoded values so the DB
-- mirrors the codebase. After this migration the registry adapter (5c) will
-- read identical data from DB. The hardcoded fallback in code stays for safety.
-- Strangler pattern: idempotent INSERTs / UPDATEs only.

-- ---------------------------------------------------------------------------
-- 1) Backfill supplier metadata
-- ---------------------------------------------------------------------------
UPDATE public.suppliers
SET kind = 'ipon_api',
    base_url = COALESCE(base_url, 'https://iponcomp.com'),
    default_currency = 'HUF',
    creates_master_products = true,
    is_active = true
WHERE id = 'a10f40b1-1c98-462d-81e8-47c1bef989db';

UPDATE public.suppliers
SET kind = 'pcx_html',
    base_url = COALESCE(base_url, 'https://www.pcx.hu'),
    default_currency = 'HUF',
    creates_master_products = false,
    is_active = true
WHERE id = 'f4a8b2c0-9d1e-4f3a-bc5d-6e7f8091a2b3';

-- ---------------------------------------------------------------------------
-- 2) iPon categories (from src/lib/suppliers/ipon/categories.ts)
-- ---------------------------------------------------------------------------
INSERT INTO public.supplier_categories
  (supplier_id, internal_category_id, supplier_category_key, listing_url, is_active, sort_order)
VALUES
  ('a10f40b1-1c98-462d-81e8-47c1bef989db', 'b7acf048-472c-4d15-af63-a9c78883ba15',
   '98', 'https://iponcomp.com/shop/group/pc-accessories/cpu/98', true, 10),
  ('a10f40b1-1c98-462d-81e8-47c1bef989db', 'bc6b63f8-ac4e-44cc-82e6-030cebee187d',
   '79', 'https://iponcomp.com/shop/group/pc-accessories/motherboard/79', true, 20)
ON CONFLICT (supplier_id, internal_category_id) DO UPDATE
SET supplier_category_key = EXCLUDED.supplier_category_key,
    listing_url = EXCLUDED.listing_url,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- 3) PCX categories (from src/lib/suppliers/pcx/categories.ts)
--    Internal category for "procesori" matches the iPon row above.
-- ---------------------------------------------------------------------------
INSERT INTO public.supplier_categories
  (supplier_id, internal_category_id, supplier_category_key, listing_url, is_active, sort_order)
VALUES
  ('f4a8b2c0-9d1e-4f3a-bc5d-6e7f8091a2b3', 'b7acf048-472c-4d15-af63-a9c78883ba15',
   'processzor', 'https://www.pcx.hu/processzor', true, 10)
ON CONFLICT (supplier_id, internal_category_id) DO UPDATE
SET supplier_category_key = EXCLUDED.supplier_category_key,
    listing_url = EXCLUDED.listing_url,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();

-- ---------------------------------------------------------------------------
-- 4) iPon attribute mappings (from mapSpecNameToSlug in scrapeDetails.ts)
--    `match_mode = 'contains'` mirrors `n.includes(...)` semantics.
--    `priority` is "lower = earlier"; the registry picks the first match.
--    More specific rules (e.g. "memory" + "socket" -> memory_sockets) must beat
--    generic rules (e.g. "socket" -> socket), so they get smaller priority.
-- ---------------------------------------------------------------------------

-- Helper: per-attribute insert via DO block keeps things idempotent without
-- requiring a unique index on (supplier_id, attribute_id, source_field_name).
DO $$
DECLARE
  ipon uuid := 'a10f40b1-1c98-462d-81e8-47c1bef989db';
BEGIN
  -- Memory sockets / slots (must outrank generic "socket")
  PERFORM 1
  FROM public.supplier_attribute_mappings
  WHERE supplier_id = ipon
    AND source_field_name = 'memory sockets'
    AND attribute_id = (SELECT id FROM public.attributes WHERE slug = 'memory_sockets');
  IF NOT FOUND THEN
    INSERT INTO public.supplier_attribute_mappings
      (supplier_id, attribute_id, source_field_name, match_mode, priority)
    SELECT ipon, id, 'memory sockets', 'contains', 10
    FROM public.attributes WHERE slug = 'memory_sockets';
  END IF;

  PERFORM 1
  FROM public.supplier_attribute_mappings
  WHERE supplier_id = ipon
    AND source_field_name = 'memory slots'
    AND attribute_id = (SELECT id FROM public.attributes WHERE slug = 'memory_sockets');
  IF NOT FOUND THEN
    INSERT INTO public.supplier_attribute_mappings
      (supplier_id, attribute_id, source_field_name, match_mode, priority)
    SELECT ipon, id, 'memory slots', 'contains', 10
    FROM public.attributes WHERE slug = 'memory_sockets';
  END IF;

  -- Memory type / standard
  PERFORM 1
  FROM public.supplier_attribute_mappings
  WHERE supplier_id = ipon
    AND source_field_name = 'memory type'
    AND attribute_id = (SELECT id FROM public.attributes WHERE slug = 'memory_type');
  IF NOT FOUND THEN
    INSERT INTO public.supplier_attribute_mappings
      (supplier_id, attribute_id, source_field_name, match_mode, priority)
    SELECT ipon, id, 'memory type', 'contains', 20
    FROM public.attributes WHERE slug = 'memory_type';
  END IF;

  PERFORM 1
  FROM public.supplier_attribute_mappings
  WHERE supplier_id = ipon
    AND source_field_name = 'memory standard'
    AND attribute_id = (SELECT id FROM public.attributes WHERE slug = 'memory_type');
  IF NOT FOUND THEN
    INSERT INTO public.supplier_attribute_mappings
      (supplier_id, attribute_id, source_field_name, match_mode, priority)
    SELECT ipon, id, 'memory standard', 'contains', 20
    FROM public.attributes WHERE slug = 'memory_type';
  END IF;

  -- Generic "socket" (outranked by memory_sockets above due to higher priority)
  PERFORM 1
  FROM public.supplier_attribute_mappings
  WHERE supplier_id = ipon
    AND source_field_name = 'socket'
    AND attribute_id = (SELECT id FROM public.attributes WHERE slug = 'socket');
  IF NOT FOUND THEN
    INSERT INTO public.supplier_attribute_mappings
      (supplier_id, attribute_id, source_field_name, match_mode, priority)
    SELECT ipon, id, 'socket', 'contains', 100
    FROM public.attributes WHERE slug = 'socket';
  END IF;

  -- Boxed
  PERFORM 1
  FROM public.supplier_attribute_mappings
  WHERE supplier_id = ipon
    AND source_field_name = 'boxed'
    AND attribute_id = (SELECT id FROM public.attributes WHERE slug = 'boxed');
  IF NOT FOUND THEN
    INSERT INTO public.supplier_attribute_mappings
      (supplier_id, attribute_id, source_field_name, match_mode, priority)
    SELECT ipon, id, 'boxed', 'contains', 100
    FROM public.attributes WHERE slug = 'boxed';
  END IF;

  -- CPU family
  PERFORM 1
  FROM public.supplier_attribute_mappings
  WHERE supplier_id = ipon
    AND source_field_name = 'cpu family'
    AND attribute_id = (SELECT id FROM public.attributes WHERE slug = 'cpu_family');
  IF NOT FOUND THEN
    INSERT INTO public.supplier_attribute_mappings
      (supplier_id, attribute_id, source_field_name, match_mode, priority)
    SELECT ipon, id, 'cpu family', 'contains', 100
    FROM public.attributes WHERE slug = 'cpu_family';
  END IF;

  PERFORM 1
  FROM public.supplier_attribute_mappings
  WHERE supplier_id = ipon
    AND source_field_name = 'cpu-family'
    AND attribute_id = (SELECT id FROM public.attributes WHERE slug = 'cpu_family');
  IF NOT FOUND THEN
    INSERT INTO public.supplier_attribute_mappings
      (supplier_id, attribute_id, source_field_name, match_mode, priority)
    SELECT ipon, id, 'cpu-family', 'contains', 100
    FROM public.attributes WHERE slug = 'cpu_family';
  END IF;

  -- TDP
  PERFORM 1
  FROM public.supplier_attribute_mappings
  WHERE supplier_id = ipon
    AND source_field_name = 'tdp'
    AND attribute_id = (SELECT id FROM public.attributes WHERE slug = 'tdp');
  IF NOT FOUND THEN
    INSERT INTO public.supplier_attribute_mappings
      (supplier_id, attribute_id, source_field_name, match_mode, priority)
    SELECT ipon, id, 'tdp', 'contains', 100
    FROM public.attributes WHERE slug = 'tdp';
  END IF;

  -- Clock speed
  PERFORM 1
  FROM public.supplier_attribute_mappings
  WHERE supplier_id = ipon
    AND source_field_name = 'clock speed'
    AND attribute_id = (SELECT id FROM public.attributes WHERE slug = 'clock_speed');
  IF NOT FOUND THEN
    INSERT INTO public.supplier_attribute_mappings
      (supplier_id, attribute_id, source_field_name, match_mode, priority)
    SELECT ipon, id, 'clock speed', 'contains', 100
    FROM public.attributes WHERE slug = 'clock_speed';
  END IF;

  -- Turbo frequency (multiple source labels)
  PERFORM 1
  FROM public.supplier_attribute_mappings
  WHERE supplier_id = ipon
    AND source_field_name = 'turbo frequency'
    AND attribute_id = (SELECT id FROM public.attributes WHERE slug = 'turbo_frequency');
  IF NOT FOUND THEN
    INSERT INTO public.supplier_attribute_mappings
      (supplier_id, attribute_id, source_field_name, match_mode, priority)
    SELECT ipon, id, 'turbo frequency', 'contains', 100
    FROM public.attributes WHERE slug = 'turbo_frequency';
  END IF;

  PERFORM 1
  FROM public.supplier_attribute_mappings
  WHERE supplier_id = ipon
    AND source_field_name = 'max frequency'
    AND attribute_id = (SELECT id FROM public.attributes WHERE slug = 'turbo_frequency');
  IF NOT FOUND THEN
    INSERT INTO public.supplier_attribute_mappings
      (supplier_id, attribute_id, source_field_name, match_mode, priority)
    SELECT ipon, id, 'max frequency', 'contains', 100
    FROM public.attributes WHERE slug = 'turbo_frequency';
  END IF;

  PERFORM 1
  FROM public.supplier_attribute_mappings
  WHERE supplier_id = ipon
    AND source_field_name = 'max. frequency'
    AND attribute_id = (SELECT id FROM public.attributes WHERE slug = 'turbo_frequency');
  IF NOT FOUND THEN
    INSERT INTO public.supplier_attribute_mappings
      (supplier_id, attribute_id, source_field_name, match_mode, priority)
    SELECT ipon, id, 'max. frequency', 'contains', 100
    FROM public.attributes WHERE slug = 'turbo_frequency';
  END IF;

  -- Chipset
  PERFORM 1
  FROM public.supplier_attribute_mappings
  WHERE supplier_id = ipon
    AND source_field_name = 'chipset'
    AND attribute_id = (SELECT id FROM public.attributes WHERE slug = 'chipset');
  IF NOT FOUND THEN
    INSERT INTO public.supplier_attribute_mappings
      (supplier_id, attribute_id, source_field_name, match_mode, priority)
    SELECT ipon, id, 'chipset', 'contains', 100
    FROM public.attributes WHERE slug = 'chipset';
  END IF;

  -- M.2 / M2 connectors
  PERFORM 1
  FROM public.supplier_attribute_mappings
  WHERE supplier_id = ipon
    AND source_field_name = 'm.2'
    AND attribute_id = (SELECT id FROM public.attributes WHERE slug = 'm2_connectors');
  IF NOT FOUND THEN
    INSERT INTO public.supplier_attribute_mappings
      (supplier_id, attribute_id, source_field_name, match_mode, priority)
    SELECT ipon, id, 'm.2', 'contains', 100
    FROM public.attributes WHERE slug = 'm2_connectors';
  END IF;

  PERFORM 1
  FROM public.supplier_attribute_mappings
  WHERE supplier_id = ipon
    AND source_field_name = 'm2'
    AND attribute_id = (SELECT id FROM public.attributes WHERE slug = 'm2_connectors');
  IF NOT FOUND THEN
    INSERT INTO public.supplier_attribute_mappings
      (supplier_id, attribute_id, source_field_name, match_mode, priority)
    SELECT ipon, id, 'm2', 'contains', 100
    FROM public.attributes WHERE slug = 'm2_connectors';
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 5) Default scrape config (mirrors current iPon throttling)
-- ---------------------------------------------------------------------------
INSERT INTO public.supplier_scrape_config (supplier_id, key, value, is_active)
VALUES
  ('a10f40b1-1c98-462d-81e8-47c1bef989db', 'detail_batch_size', '20'::jsonb, true),
  ('a10f40b1-1c98-462d-81e8-47c1bef989db', 'detail_delay_ms', '4000'::jsonb, true),
  ('a10f40b1-1c98-462d-81e8-47c1bef989db', 'import_batch_size', '50'::jsonb, true),
  ('f4a8b2c0-9d1e-4f3a-bc5d-6e7f8091a2b3', 'detail_delay_ms', '1500'::jsonb, true)
ON CONFLICT (supplier_id, key) DO UPDATE
SET value = EXCLUDED.value,
    is_active = EXCLUDED.is_active,
    updated_at = now();
