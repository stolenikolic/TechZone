-- Token-based product search across product identity fields.
-- Every query token must exist in name, brand, MPN, or EAN. Results stay paginated at 30 per page.
DROP FUNCTION IF EXISTS public.search_products(text, int);

CREATE FUNCTION public.search_products(search_query text, page int DEFAULT 1)
RETURNS TABLE (
  id uuid,
  name text,
  brand text,
  slug text,
  main_image text,
  price numeric,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  q text;
  q_lower text;
  query_tokens text[];
  page_sanitized int;
  off int;
BEGIN
  q := trim(coalesce(search_query, ''));
  IF length(q) < 2 THEN
    RETURN;
  END IF;

  q_lower := lower(q);
  query_tokens := array_remove(regexp_split_to_array(q_lower, '\s+'), '');
  IF cardinality(query_tokens) = 0 THEN
    RETURN;
  END IF;

  page_sanitized := greatest(1, coalesce(page, 1));
  off := (page_sanitized - 1) * 30;

  RETURN QUERY
  WITH searchable_products AS (
    SELECT
      p.id,
      p.name,
      p.brand,
      p.slug,
      p.main_image,
      p.price,
      lower(concat_ws(' ', p.name, p.brand, p.mpn, p.ean)) AS searchable_text
    FROM public.products p
    WHERE p.is_active = true
  ),
  matches AS (
    SELECT
      sp.id,
      sp.name,
      sp.brand,
      sp.slug,
      sp.main_image,
      sp.price,
      count(*) OVER () AS total,
      CASE WHEN position(q_lower in lower(sp.name)) > 0 THEN 0 ELSE 1 END AS exact_name_match,
      CASE WHEN sp.brand IS NOT NULL AND position(q_lower in lower(sp.brand)) > 0 THEN 0 ELSE 1 END AS exact_brand_match,
      CASE WHEN position(q_lower in sp.searchable_text) > 0 THEN 0 ELSE 1 END AS exact_identity_match
    FROM searchable_products sp
    WHERE NOT EXISTS (
      SELECT 1
      FROM unnest(query_tokens) AS token(value)
      WHERE position(token.value in sp.searchable_text) = 0
    )
  )
  SELECT
    m.id,
    m.name,
    m.brand,
    m.slug,
    m.main_image,
    m.price,
    m.total
  FROM matches m
  ORDER BY
    m.exact_name_match,
    m.exact_brand_match,
    m.exact_identity_match,
    length(m.name),
    m.name
  LIMIT 30
  OFFSET off;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_products(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_products(text, int) TO anon;
GRANT EXECUTE ON FUNCTION public.search_products(text, int) TO service_role;
