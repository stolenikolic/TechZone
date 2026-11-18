-- 00074_alza_supplier.sql
-- Alza.hu API importer — supplier row, job schedule, and category rows
-- only where one internal slug is an unambiguous name match.
-- Broad Alza trees (PC alkatrészek, Kiegészítők, Okos eszközök) stay unmapped.
-- The crawl list itself lives in src/lib/suppliers/alza/categories.ts.

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
  'c4e8a1b2-7d63-4f5a-9e10-2b6c8d0f1a34',
  'Alza',
  'alza',
  'alza_api',
  'https://www.alza.hu',
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
SELECT
  'c4e8a1b2-7d63-4f5a-9e10-2b6c8d0f1a34',
  c.id,
  v.category_key,
  v.listing_url,
  true,
  v.sort_order
FROM (
  VALUES
    ('18843241'::text, 'video-kamere'::text, 'https://www.alza.hu/18843241.htm'::text, 10),
    ('18843129'::text, 'digitalni-fotoaparati'::text, 'https://www.alza.hu/18843129.htm'::text, 20),
    ('18842948'::text, 'monitori'::text, 'https://www.alza.hu/18842948.htm'::text, 30),
    ('18849604'::text, 'televizori'::text, 'https://www.alza.hu/18849604.htm'::text, 40),
    ('18843602'::text, 'slusalice'::text, 'https://www.alza.hu/18843602.htm'::text, 50),
    ('18843496'::text, 'zvucnici'::text, 'https://www.alza.hu/18843496.htm'::text, 60)
) AS v(category_key, slug, listing_url, sort_order)
JOIN public.categories c ON c.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1
  FROM public.supplier_categories sc
  WHERE sc.supplier_id = 'c4e8a1b2-7d63-4f5a-9e10-2b6c8d0f1a34'
    AND sc.supplier_category_key = v.category_key
);

INSERT INTO public.job_schedules (job_type, is_paused)
VALUES ('alza_import', false)
ON CONFLICT (job_type) DO NOTHING;
