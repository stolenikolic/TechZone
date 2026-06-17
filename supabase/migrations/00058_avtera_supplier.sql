-- 00058_avtera_supplier.sql
-- Avtera (avtera.ba) XML importer — pilot MS → misevi.

INSERT INTO public.suppliers (
  id,
  name,
  code,
  kind,
  base_url,
  default_currency,
  pricing_formula,
  creates_master_products,
  is_active,
  enrichment_priority,
  delivery_policy,
  inbound_lead_days_default
)
VALUES (
  'a7c3e8f1-2b4d-4e9a-8f6c-1d5a9b2e3f4c',
  'Avtera',
  'avtera',
  'avtera_xml',
  'https://www.avtera.ba',
  'KM',
  NULL,
  false,
  true,
  70,
  '{"type":"daily"}'::jsonb,
  1
)
ON CONFLICT (code) DO UPDATE
SET
  kind = EXCLUDED.kind,
  base_url = EXCLUDED.base_url,
  default_currency = EXCLUDED.default_currency,
  pricing_formula = EXCLUDED.pricing_formula,
  creates_master_products = EXCLUDED.creates_master_products,
  is_active = EXCLUDED.is_active,
  enrichment_priority = EXCLUDED.enrichment_priority,
  delivery_policy = EXCLUDED.delivery_policy,
  inbound_lead_days_default = EXCLUDED.inbound_lead_days_default;

INSERT INTO public.supplier_categories (
  supplier_id,
  internal_category_id,
  supplier_category_key,
  listing_url,
  is_active,
  sort_order
)
SELECT
  'a7c3e8f1-2b4d-4e9a-8f6c-1d5a9b2e3f4c',
  c.id,
  'MS',
  NULL,
  true,
  10
FROM public.categories c
WHERE c.slug = 'misevi'
ON CONFLICT (supplier_id, internal_category_id) DO UPDATE
SET
  supplier_category_key = EXCLUDED.supplier_category_key,
  listing_url = EXCLUDED.listing_url,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.job_schedules (job_type, is_paused)
VALUES
  ('avtera_import', false),
  ('avtera_price_sync', false)
ON CONFLICT (job_type) DO NOTHING;
