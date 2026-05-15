-- 00031_enrichment_refactor.sql
-- Enrichment pipeline refactor:
--   1. Add spec_snapshot to supplier_products (normalized per-supplier spec data)
--   2. Add enrichment_priority to suppliers (cross-supplier waterfall order)
--   3. Drop source_jsonld family from products (moved to supplier_products.spec_snapshot)
--
-- spec_snapshot format: { mpn, ean, factory_link, specs: [{name, value}] }
--   factory_link is only populated by iPon; PCX omits it.
--   specs mirrors additionalProperty from JSON-LD Product nodes.
--
-- Idempotency: spec_snapshot IS NOT NULL means "already scraped, skip HTTP".
-- Re-enrichment (new attributes) only requires re-running the enrichment job,
-- not new HTTP requests to suppliers.

-- 1. supplier_products: normalized spec snapshot
ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS spec_snapshot jsonb;

COMMENT ON COLUMN public.supplier_products.spec_snapshot IS
  'Normalized spec snapshot: {mpn, ean, factory_link?, specs: [{name,value}]}. '
  'NULL = not yet scraped. IS NOT NULL = skip HTTP re-scrape. '
  'iPon: set once from detail page JSON-LD. PCX: set once at import time.';

CREATE INDEX IF NOT EXISTS idx_supplier_products_spec_snapshot
  ON public.supplier_products (supplier_id, product_id)
  WHERE spec_snapshot IS NOT NULL;

-- 2. suppliers: cross-supplier enrichment priority (lower = higher priority)
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS enrichment_priority integer NOT NULL DEFAULT 100;

COMMENT ON COLUMN public.suppliers.enrichment_priority IS
  'Cross-supplier waterfall order for enrichment job. Lower value wins. '
  'Default 100; set iPon to 10, PCX to 50.';

UPDATE public.suppliers SET enrichment_priority = 10  WHERE code = 'ipon';
UPDATE public.suppliers SET enrichment_priority = 50  WHERE code = 'pcx';

-- 3. products: drop source_jsonld columns (data not migrated; iPon scrape queue
--    will re-populate spec_snapshot for affected products via normal scrape cycle)
DROP INDEX IF EXISTS public.idx_products_jsonld_supplier;
DROP INDEX IF EXISTS public.idx_products_jsonld_fetched;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS source_jsonld,
  DROP COLUMN IF EXISTS source_jsonld_hash,
  DROP COLUMN IF EXISTS source_jsonld_fetched_at,
  DROP COLUMN IF EXISTS source_jsonld_supplier_id,
  DROP COLUMN IF EXISTS source_jsonld_supplier_product_id;
