-- Custom UI price override (does not affect pricing engine aggregate into products.price).
-- If set, shop/category/product page/cart should show custom_price instead of products.price.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS custom_price numeric;

COMMENT ON COLUMN public.products.custom_price IS
  'Optional UI-only price override. When set, UI shows this value instead of products.price (pricing engine computed price).';

