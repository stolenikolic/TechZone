-- 00057_comtrade_supplier.sql
-- ComTrade (ct4partners.ba) API importer — prvi domaći dobavljač, pilot CPU → procesori.

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
  'e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b',
  'ComTrade',
  'comtrade',
  'comtrade_api',
  'https://www.ct4partners.ba',
  'KM',
  NULL,
  false,
  true,
  60,
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
VALUES (
  'e8f9a0b1-c2d3-4e5f-8a9b-0c1d2e3f4a5b',
  'b7acf048-472c-4d15-af63-a9c78883ba15',
  'CPU',
  NULL,
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
VALUES
  ('comtrade_import', false),
  ('comtrade_price_sync', false),
  ('comtrade_enrich', true)
ON CONFLICT (job_type) DO NOTHING;
