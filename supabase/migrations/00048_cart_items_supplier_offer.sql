-- Cart lines keyed by product + supplier offer (Najjeftinije vs Najbrza dostava).

ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS supplier_product_id uuid REFERENCES public.supplier_products (id) ON DELETE CASCADE;

-- Backfill existing rows to cheapest active supplier offer per product.
UPDATE public.cart_items ci
SET supplier_product_id = sub.cheapest_id
FROM (
  SELECT
    ci2.id AS cart_row_id,
    (
      SELECT sp.id
      FROM public.supplier_products sp
      WHERE sp.product_id = ci2.product_id
        AND sp.is_active = true
        AND sp.price_amount IS NOT NULL
      ORDER BY sp.price_amount ASC NULLS LAST
      LIMIT 1
    ) AS cheapest_id
  FROM public.cart_items ci2
  WHERE ci2.supplier_product_id IS NULL
) sub
WHERE ci.id = sub.cart_row_id
  AND sub.cheapest_id IS NOT NULL;

-- Drop rows that could not be mapped (no active offers).
DELETE FROM public.cart_items
WHERE supplier_product_id IS NULL;

ALTER TABLE public.cart_items
  ALTER COLUMN supplier_product_id SET NOT NULL;

ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_user_id_product_id_key;

ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_user_id_product_id_supplier_product_id_key;

ALTER TABLE public.cart_items
  ADD CONSTRAINT cart_items_user_id_product_id_supplier_product_id_key
  UNIQUE (user_id, product_id, supplier_product_id);

CREATE INDEX IF NOT EXISTS idx_cart_items_supplier_product_id
  ON public.cart_items (supplier_product_id);
