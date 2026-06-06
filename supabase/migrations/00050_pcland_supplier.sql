-- 00050_pcland_supplier.sql
-- PCLand (pcland.hu) HTML importer — supplier row, procesori category, job schedule.

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
  'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
  'PCLand',
  'pcland',
  'pcland_html',
  'https://pcland.hu',
  'HUF',
  'hungary_huf_alza_tax',
  false,
  true,
  50,
  '{"type":"weekly","weekday":1}',
  7
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
  'd1e2f3a4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
  'b7acf048-472c-4d15-af63-a9c78883ba15',
  'procesori',
  'https://pcland.hu/termekek-158/szamitogep-alkatresz-160/processzor-397',
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
VALUES ('pcland_import', false)
ON CONFLICT (job_type) DO NOTHING;
