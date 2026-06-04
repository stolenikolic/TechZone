-- 00045_product_offers_delivery.sql
-- PDP offer comparison: supplier lead time + Tech Zone delivery schedule per supplier.

ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS delivery_days integer,
  ADD COLUMN IF NOT EXISTS warranty_months integer;

COMMENT ON COLUMN public.supplier_products.delivery_days IS
  'Supplier lead time in days (iPon deliveryDays). 0 = in stock at supplier.';
COMMENT ON COLUMN public.supplier_products.warranty_months IS
  'Warranty length in months when known (scrape or manual).';

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS delivery_policy jsonb;

COMMENT ON COLUMN public.suppliers.delivery_policy IS
  'Tech Zone inbound: weekly weekday (1 = Monday). Lead time per offer is supplier_products.delivery_days.';

-- Svi dobavljači: roba kod nas svakog ponedjeljka (razlika je delivery_days na artiklu).
UPDATE public.suppliers
SET delivery_policy = '{"type":"weekly","weekday":1}'::jsonb
WHERE delivery_policy IS NULL
   OR delivery_policy->>'type' = 'biweekly';
