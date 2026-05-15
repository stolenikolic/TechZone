-- Reset iPon detail snapshots so rows re-enter the scrape queue
-- (fetchIponScrapeQueueBatch selects supplier_products where spec_snapshot IS NULL).
-- Run in Supabase SQL editor after reviewing. Adjust WHERE if you only want linked masters.

UPDATE public.supplier_products sp
SET
  spec_snapshot = NULL,
  specs_fetched_at = NULL,
  enrichment_status = 'pending',
  updated_at = now()
FROM public.suppliers s
WHERE sp.supplier_id = s.id
  AND s.code = 'ipon'
  AND sp.product_id IS NOT NULL;

-- Optional: only rows missing factory_link in the current snapshot (skip full wipe):
-- UPDATE public.supplier_products sp
-- SET spec_snapshot = NULL, specs_fetched_at = NULL, enrichment_status = 'pending', updated_at = now()
-- FROM public.suppliers s
-- WHERE sp.supplier_id = s.id AND s.code = 'ipon' AND sp.product_id IS NOT NULL
--   AND (
--     sp.spec_snapshot IS NULL
--     OR nullif(btrim(sp.spec_snapshot->>'factory_link'), '') IS NULL
--   );
