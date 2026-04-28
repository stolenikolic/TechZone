-- Strict product search: only name and brand (no description, no fuzzy logic).
-- Matches: name ILIKE '%query%' OR brand ILIKE '%query%'. Case-insensitive. 30 per page.
CREATE OR REPLACE FUNCTION public.search_products(search_query text, page int DEFAULT 1)
RETURNS TABLE (
  id uuid,
  name text,
  brand text,
  slug text,
  main_image text,
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
  page_sanitized int;
  off int;
BEGIN
  q := trim(coalesce(search_query, ''));
  IF length(q) < 2 THEN
    RETURN;
  END IF;

  q_lower := lower(q);
  page_sanitized := greatest(1, coalesce(page, 1));
  off := (page_sanitized - 1) * 30;

  RETURN QUERY
  WITH matches AS (
    SELECT
      p.id,
      p.name,
      p.brand,
      p.slug,
      p.main_image,
      count(*) OVER () AS total,
      (CASE WHEN position(q_lower in lower(p.name)) > 0 THEN 0 ELSE 1 END) AS name_match,
      (CASE WHEN p.brand IS NOT NULL AND position(q_lower in lower(p.brand)) > 0 THEN 0 ELSE 1 END) AS brand_match
    FROM public.products p
    WHERE p.is_active = true
      AND (
        position(q_lower in lower(p.name)) > 0
        OR (p.brand IS NOT NULL AND position(q_lower in lower(p.brand)) > 0)
      )
  )
  SELECT
    m.id,
    m.name,
    m.brand,
    m.slug,
    m.main_image,
    m.total
  FROM matches m
  ORDER BY m.name_match, m.brand_match, m.name
  LIMIT 30
  OFFSET off;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_products(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_products(text, int) TO anon;
GRANT EXECUTE ON FUNCTION public.search_products(text, int) TO service_role;
