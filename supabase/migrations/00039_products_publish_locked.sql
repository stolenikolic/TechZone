-- Manual hide from storefront; import/reconcile still update is_active, prices, etc.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS publish_locked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.publish_locked IS
  'When true, product is hidden on the shop regardless of is_active. Supplier sync continues.';

CREATE INDEX IF NOT EXISTS idx_products_storefront_visible
  ON public.products (category_id, is_active)
  WHERE is_active = true AND publish_locked = false;
