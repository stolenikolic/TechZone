-- 00052_konzolvilag_supplier.sql
-- Konzolvilág (konzolvilag.hu) HTML importer — supplier row, procesori category, job schedule.

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
  'f3a4b5c6-d7e8-4f9a-0b1c-2d3e4f5a6b7c',
  'Konzolvilág',
  'konzolvilag',
  'konzolvilag_html',
  'https://www.konzolvilag.hu',
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
  'f3a4b5c6-d7e8-4f9a-0b1c-2d3e4f5a6b7c',
  'b7acf048-472c-4d15-af63-a9c78883ba15',
  'procesori',
  'https://www.konzolvilag.hu/pc/hardver/processzor',
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
VALUES ('konzolvilag_import', false)
ON CONFLICT (job_type) DO NOTHING;
