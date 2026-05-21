-- 00042_firstshop_supplier.sql
-- FirstShop (firstshop.hu) HTML importer — supplier row, procesori category, job schedule.

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
  enrichment_priority
)
VALUES (
  'c8e4f1a2-3b4c-5d6e-9f0a-1b2c3d4e5f6a',
  'FirstShop',
  'firstshop',
  'firstshop_html',
  'https://firstshop.hu',
  'HUF',
  'hungary_huf_alza_tax',
  false,
  true,
  55
)
ON CONFLICT (code) DO UPDATE
SET
  kind = EXCLUDED.kind,
  base_url = EXCLUDED.base_url,
  default_currency = EXCLUDED.default_currency,
  pricing_formula = EXCLUDED.pricing_formula,
  creates_master_products = EXCLUDED.creates_master_products,
  is_active = EXCLUDED.is_active,
  enrichment_priority = EXCLUDED.enrichment_priority;

INSERT INTO public.supplier_categories (
  supplier_id,
  internal_category_id,
  supplier_category_key,
  listing_url,
  is_active,
  sort_order
)
VALUES (
  'c8e4f1a2-3b4c-5d6e-9f0a-1b2c3d4e5f6a',
  'b7acf048-472c-4d15-af63-a9c78883ba15',
  'procesori',
  'https://firstshop.hu/hardver/processzor-c2',
  true,
  10
)
ON CONFLICT (supplier_id, internal_category_id) DO UPDATE
SET
  supplier_category_key = EXCLUDED.supplier_category_key,
  listing_url = EXCLUDED.listing_url,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.job_schedules (job_type, is_paused)
VALUES ('firstshop_import', false)
ON CONFLICT (job_type) DO NOTHING;
