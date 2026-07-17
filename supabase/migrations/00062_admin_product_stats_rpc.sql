-- Compute admin product counters in one database query instead of loading the
-- complete product/offer/attribute catalog through hundreds of REST requests.
CREATE OR REPLACE FUNCTION public.get_admin_product_stats()
RETURNS TABLE (
  all_count integer,
  ready integer,
  unlinked integer,
  linked integer,
  needs_attributes integer
)
LANGUAGE sql
STABLE
SET search_path = ''
SET statement_timeout = '30s'
AS $$
  WITH offer_counts AS MATERIALIZED (
    SELECT product_id, count(*)::integer AS offer_count
    FROM public.supplier_products
    WHERE product_id IS NOT NULL
    GROUP BY product_id
  ),
  product_attr_presence AS MATERIALIZED (
    SELECT product_id, true AS has_any_row
    FROM public.product_attributes
    GROUP BY product_id
  ),
  eligible AS MATERIALIZED (
    SELECT p.id, p.category_id, p.attributes
    FROM public.products p
    JOIN offer_counts oc ON oc.product_id = p.id
    WHERE coalesce(p.custom_price, p.price) > 0
      AND p.category_id IS NOT NULL
      AND p.main_image IS NOT NULL
      AND (p.mpn IS NOT NULL OR p.ean IS NOT NULL)
  ),
  attribute_evaluation AS MATERIALIZED (
    SELECT
      e.id,
      count(ca.attribute_id)::integer AS required_count,
      count(ca.attribute_id) FILTER (
        WHERE (
          pa.product_id IS NOT NULL
          AND (pa.value IS NULL OR btrim(pa.value) <> '')
        )
        OR CASE jsonb_typeof(e.attributes -> a.slug)
          WHEN 'string' THEN btrim(e.attributes ->> a.slug) <> ''
          WHEN 'number' THEN true
          WHEN 'boolean' THEN true
          ELSE false
        END
      )::integer AS satisfied_count,
      bool_or(pap.has_any_row IS TRUE) AS has_any_attribute_row,
      bool_or(
        jsonb_typeof(e.attributes) = 'object'
        AND e.attributes <> '{}'::jsonb
      ) AS has_attributes_json
    FROM eligible e
    LEFT JOIN public.category_attributes ca
      ON ca.category_id = e.category_id
    LEFT JOIN public.attributes a
      ON a.id = ca.attribute_id
    LEFT JOIN public.product_attributes pa
      ON pa.product_id = e.id
     AND pa.attribute_id = ca.attribute_id
    LEFT JOIN product_attr_presence pap
      ON pap.product_id = e.id
    GROUP BY e.id
  ),
  base_counts AS (
    SELECT
      count(*)::integer AS all_count,
      count(*) FILTER (WHERE oc.product_id IS NULL)::integer AS unlinked,
      count(*) FILTER (
        WHERE oc.product_id IS NOT NULL
          AND (
            coalesce(p.custom_price, p.price) IS NULL
            OR coalesce(p.custom_price, p.price) <= 0
            OR p.category_id IS NULL
            OR p.main_image IS NULL
            OR (p.mpn IS NULL AND p.ean IS NULL)
          )
      )::integer AS linked
    FROM public.products p
    LEFT JOIN offer_counts oc ON oc.product_id = p.id
  ),
  attribute_counts AS (
    SELECT
      count(*) FILTER (
        WHERE required_count > satisfied_count
          OR (
            required_count = 0
            AND NOT coalesce(has_attributes_json, false)
            AND NOT coalesce(has_any_attribute_row, false)
          )
      )::integer AS needs_attributes,
      count(*) FILTER (
        WHERE required_count = satisfied_count
          AND (
            required_count > 0
            OR coalesce(has_attributes_json, false)
            OR coalesce(has_any_attribute_row, false)
          )
      )::integer AS ready
    FROM attribute_evaluation
  )
  SELECT
    b.all_count,
    a.ready,
    b.unlinked,
    b.linked,
    a.needs_attributes
  FROM base_counts b
  CROSS JOIN attribute_counts a;
$$;

REVOKE ALL ON FUNCTION public.get_admin_product_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_product_stats() FROM anon;
REVOKE ALL ON FUNCTION public.get_admin_product_stats() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_product_stats() TO service_role;
