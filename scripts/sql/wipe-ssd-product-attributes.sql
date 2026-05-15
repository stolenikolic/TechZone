-- Obriši sve upisane vrijednosti atributa za proizvode u kategoriji SSD.
-- NE dira: attributes, category_attributes, attribute_value_aliases (ručne mape).
-- Nakon ovoga: admin → kategorija SSD → Pokreni enrichment (ili job enrichment + overwrite).
--
-- Zašto i products.attributes: enrichment preskače slug ako je već u JSON-u (ručni/admin).

-- =============================================================================
-- 1) Pregled (pokreni prvo, bez DELETE)
-- =============================================================================

SELECT c.id AS category_id, c.slug, c.name
FROM public.categories c
WHERE c.slug = 'ssd';

SELECT count(*) AS ssd_products
FROM public.products p
WHERE p.category_id = (SELECT id FROM public.categories WHERE slug = 'ssd' LIMIT 1);

SELECT count(*) AS product_attribute_rows
FROM public.product_attributes pa
JOIN public.products p ON p.id = pa.product_id
WHERE p.category_id = (SELECT id FROM public.categories WHERE slug = 'ssd' LIMIT 1);

SELECT count(*) AS products_with_attributes_json
FROM public.products p
WHERE p.category_id = (SELECT id FROM public.categories WHERE slug = 'ssd' LIMIT 1)
  AND p.attributes IS NOT NULL
  AND p.attributes <> '{}'::jsonb;

-- =============================================================================
-- 2) Brisanje (odkomentiraj kad si siguran)
-- =============================================================================

/*
BEGIN;

DELETE FROM public.product_attributes pa
USING public.products p
WHERE pa.product_id = p.id
  AND p.category_id = (SELECT id FROM public.categories WHERE slug = 'ssd' LIMIT 1);

UPDATE public.products p
SET
  attributes = '{}'::jsonb,
  updated_at = now()
WHERE p.category_id = (SELECT id FROM public.categories WHERE slug = 'ssd' LIMIT 1);

COMMIT;
*/

-- =============================================================================
-- 3) Provjera poslije
-- =============================================================================

/*
SELECT count(*) AS remaining_product_attribute_rows
FROM public.product_attributes pa
JOIN public.products p ON p.id = pa.product_id
WHERE p.category_id = (SELECT id FROM public.categories WHERE slug = 'ssd' LIMIT 1);
*/
