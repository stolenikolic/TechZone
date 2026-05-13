-- Offer-level visibility: inactive offers excluded from price aggregation.
-- Reconcile master products.is_active from linked supplier_products (any active = master active;
-- all inactive among linked rows = master inactive; products with zero supplier rows unchanged).
-- One-time: remove PCX offers keyed by URL before importer switches to Cikkszám as supplier_product_id.

ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_supplier_products_product_active
  ON public.supplier_products (product_id, is_active)
  WHERE product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_active
  ON public.supplier_products (supplier_id, is_active);

CREATE OR REPLACE FUNCTION public.reconcile_products_is_active_from_supplier_offers()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE products p
  SET is_active = agg.active_any,
      updated_at = now()
  FROM (
    SELECT product_id, bool_or(is_active) AS active_any
    FROM supplier_products
    WHERE product_id IS NOT NULL
    GROUP BY product_id
  ) agg
  WHERE p.id = agg.product_id
    AND p.is_active IS DISTINCT FROM agg.active_any;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_products_is_active_from_supplier_offers() TO service_role;

-- PCX supplier UUID (seed + src/lib/suppliers/pcx/importProducts.ts)
DELETE FROM public.supplier_products
WHERE supplier_id = 'f4a8b2c0-9d1e-4f3a-bc5d-6e7f8091a2b3'::uuid;
