-- Phase A: MPN/EAN identity, enrichment tracking, master match workflow (multi-supplier plan)

-- Master products: manufacturer part number + European article number (GTIN-13)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS mpn text,
  ADD COLUMN IF NOT EXISTS ean text;

COMMENT ON COLUMN public.products.mpn IS 'Manufacturer part number; normalized on write (trim).';
COMMENT ON COLUMN public.products.ean IS 'EAN-13 / GTIN-13; normalized on write (digits, typically uppercase).';

CREATE INDEX IF NOT EXISTS idx_products_mpn ON public.products (mpn) WHERE mpn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_ean ON public.products (ean) WHERE ean IS NOT NULL;

-- Per-supplier offer row: identifiers from supplier or enrichment, plus one-shot JSON-LD/spec pipeline
ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS mpn text,
  ADD COLUMN IF NOT EXISTS ean text,
  ADD COLUMN IF NOT EXISTS specs_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS enrichment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS master_match_status text NOT NULL DEFAULT 'linked';

COMMENT ON COLUMN public.supplier_products.mpn IS 'MPN as reported by this supplier or scraped detail page.';
COMMENT ON COLUMN public.supplier_products.ean IS 'EAN/GTIN as reported by this supplier or scraped detail page.';
COMMENT ON COLUMN public.supplier_products.specs_fetched_at IS 'When JSON-LD/specs were last successfully pulled for this row (iPon).';
COMMENT ON COLUMN public.supplier_products.enrichment_status IS 'pending | complete | failed — idempotent enrichment pipeline.';
COMMENT ON COLUMN public.supplier_products.master_match_status IS 'linked | pending_review | rejected — non–primary suppliers need approval before new master.';

ALTER TABLE public.supplier_products
  DROP CONSTRAINT IF EXISTS supplier_products_enrichment_status_check;
ALTER TABLE public.supplier_products
  ADD CONSTRAINT supplier_products_enrichment_status_check
  CHECK (enrichment_status IN ('pending', 'complete', 'failed'));

ALTER TABLE public.supplier_products
  DROP CONSTRAINT IF EXISTS supplier_products_master_match_status_check;
ALTER TABLE public.supplier_products
  ADD CONSTRAINT supplier_products_master_match_status_check
  CHECK (master_match_status IN ('linked', 'pending_review', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_supplier_products_pending_review
  ON public.supplier_products (master_match_status)
  WHERE master_match_status = 'pending_review';

CREATE INDEX IF NOT EXISTS idx_supplier_products_enrichment_pending
  ON public.supplier_products (supplier_id, enrichment_status)
  WHERE enrichment_status = 'pending';
