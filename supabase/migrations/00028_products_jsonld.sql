-- 00028_products_jsonld.sql
-- Master products keep a permanent snapshot of the parsed Product JSON-LD that
-- was successfully scraped (currently only iPon). With it we can re-extract new
-- attributes (e.g. after admin adds a new category attribute) without firing
-- another iPon HTTP request and risking the Cloudflare challenge.
--
-- Hash-based update strategy keeps the column stable when nothing changed.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source_jsonld jsonb,
  ADD COLUMN IF NOT EXISTS source_jsonld_hash text,
  ADD COLUMN IF NOT EXISTS source_jsonld_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_jsonld_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_jsonld_supplier_product_id text;

CREATE INDEX IF NOT EXISTS idx_products_jsonld_supplier
  ON public.products (source_jsonld_supplier_id)
  WHERE source_jsonld IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_jsonld_fetched
  ON public.products (source_jsonld_fetched_at DESC)
  WHERE source_jsonld IS NOT NULL;
