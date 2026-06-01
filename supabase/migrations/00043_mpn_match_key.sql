-- Deterministic MPN match key (same rules as app normalizeMpnForMatchCompare).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS mpn_match_key text;

ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS mpn_match_key text;

COMMENT ON COLUMN public.products.mpn_match_key IS
  'Lowercase MPN compare key (hyphens as spaces). Indexed for exact auto-match lookup.';
COMMENT ON COLUMN public.supplier_products.mpn_match_key IS
  'Same as products.mpn_match_key; set from supplier mpn on import/update.';

CREATE OR REPLACE FUNCTION public.compute_mpn_match_key(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    lower(
      regexp_replace(
        regexp_replace(trim(both from coalesce(raw, '')), '[-–—]', ' ', 'g'),
        '\s+',
        ' ',
        'g'
      )
    ),
    ''
  );
$$;

UPDATE public.products
SET mpn_match_key = public.compute_mpn_match_key(mpn)
WHERE mpn IS NOT NULL AND trim(mpn) <> '';

UPDATE public.supplier_products
SET mpn_match_key = public.compute_mpn_match_key(mpn)
WHERE mpn IS NOT NULL AND trim(mpn) <> '';

CREATE INDEX IF NOT EXISTS idx_products_mpn_match_key
  ON public.products (mpn_match_key)
  WHERE mpn_match_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_products_mpn_match_key_linked
  ON public.supplier_products (mpn_match_key)
  WHERE mpn_match_key IS NOT NULL AND product_id IS NOT NULL;
