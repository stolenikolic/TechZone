-- 00060_olx_feed.sql
-- OLX JSON feed: price source region on products, batch RPC, private storage bucket, job schedule.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS price_source_region text,
  ADD COLUMN IF NOT EXISTS price_source_supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.products.price_source_region IS
  'HU | BA | custom — region of winning supplier offer used for shop pricing context (OLX feed).';

COMMENT ON COLUMN public.products.price_source_supplier_id IS
  'Supplier id of the cheapest active offer when price_source_region is HU or BA.';

CREATE INDEX IF NOT EXISTS idx_products_price_source_region
  ON public.products (price_source_region)
  WHERE price_source_region IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_products_price_sources(entries jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE products p
  SET
    price_source_region = elem->>'price_source_region',
    price_source_supplier_id = NULLIF(elem->>'price_source_supplier_id', '')::uuid,
    updated_at = now()
  FROM jsonb_array_elements(entries) AS elem
  WHERE p.id = (elem->>'id')::uuid;
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feeds',
  'feeds',
  false,
  104857600,
  ARRAY['application/json']::text[]
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.job_schedules (job_type, is_paused)
VALUES ('olx_feed_export', false)
ON CONFLICT (job_type) DO NOTHING;
