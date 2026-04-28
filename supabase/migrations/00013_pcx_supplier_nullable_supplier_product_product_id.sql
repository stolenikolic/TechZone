-- PCX and other non-primary suppliers: offers may exist before a master `products` row (MPN match).
-- Seed PCX with stable id for app code; insert only if missing.

ALTER TABLE public.supplier_products
  ALTER COLUMN product_id DROP NOT NULL;

INSERT INTO public.suppliers (id, name, code, base_url, is_active)
SELECT
  'f4a8b2c0-9d1e-4f3a-bc5d-6e7f8091a2b3'::uuid,
  'PCX',
  'pcx',
  'https://www.pcx.hu',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.suppliers s WHERE s.code = 'pcx');
