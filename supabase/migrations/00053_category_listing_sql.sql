-- SQL-backed category listing + facets (pagination, filters, accurate counts).

CREATE OR REPLACE FUNCTION public.product_effective_price(
  p_custom_price numeric,
  p_price numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_custom_price IS NOT NULL THEN p_custom_price
    ELSE COALESCE(p_price, 0)
  END;
$$;

CREATE OR REPLACE FUNCTION public.parse_attribute_numeric_value(p_value text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (substring(trim(coalesce(p_value, '')) FROM '[0-9]+(?:\.[0-9]+)?'))::numeric,
    (substring(trim(coalesce(p_value, '')) FROM '^[0-9]+'))::numeric
  );
$$;

CREATE OR REPLACE FUNCTION public.get_category_products_listing(
  p_category_id uuid,
  p_brand_slugs text[] DEFAULT NULL,
  p_price_min numeric DEFAULT NULL,
  p_price_max numeric DEFAULT NULL,
  p_attribute_filters jsonb DEFAULT '[]'::jsonb,
  p_sort text DEFAULT 'relevance',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 30
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  description text,
  brand text,
  main_image text,
  price numeric,
  custom_price numeric,
  original_price numeric,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_where text := 'p.category_id = $1 AND p.is_active = true AND p.publish_locked = false';
  v_sort text;
  v_page integer;
  v_page_size integer;
  v_offset integer;
  v_filter jsonb;
  v_attr_id uuid;
  v_values text[];
  v_normalized_values text[];
  v_min numeric;
  v_max numeric;
  v_sql text;
BEGIN
  v_page := greatest(1, coalesce(p_page, 1));
  v_page_size := greatest(1, least(coalesce(p_page_size, 30), 100));
  v_offset := (v_page - 1) * v_page_size;

  v_where := v_where || format(
    ' AND public.product_effective_price(p.custom_price, p.price) > 0'
  );

  IF p_brand_slugs IS NOT NULL AND array_length(p_brand_slugs, 1) > 0 THEN
    v_where := v_where || format(
      ' AND lower(replace(trim(coalesce(p.brand, '''')), '' '', ''-'')) = ANY(%L::text[])',
      p_brand_slugs
    );
  END IF;

  IF p_price_min IS NOT NULL THEN
    v_where := v_where || format(
      ' AND public.product_effective_price(p.custom_price, p.price) >= %s',
      p_price_min
    );
  END IF;

  IF p_price_max IS NOT NULL THEN
    v_where := v_where || format(
      ' AND public.product_effective_price(p.custom_price, p.price) <= %s',
      p_price_max
    );
  END IF;

  IF jsonb_typeof(p_attribute_filters) = 'array' THEN
    FOR v_filter IN SELECT value FROM jsonb_array_elements(p_attribute_filters)
    LOOP
      v_attr_id := (v_filter->>'attribute_id')::uuid;

      IF v_filter->>'type' = 'list' THEN
        SELECT coalesce(array_agg(elem), ARRAY[]::text[])
        INTO v_values
        FROM jsonb_array_elements_text(v_filter->'values') AS elem;

        IF array_length(v_values, 1) > 0 THEN
          SELECT coalesce(array_agg(lower(trim(x))), ARRAY[]::text[])
          INTO v_normalized_values
          FROM unnest(v_values) AS x;

          v_where := v_where || format(
            ' AND EXISTS (
              SELECT 1 FROM public.product_attributes pa
              WHERE pa.product_id = p.id
                AND pa.attribute_id = %L
                AND lower(trim(pa.value)) = ANY(%L::text[])
            )',
            v_attr_id,
            v_normalized_values
          );
        END IF;
      ELSIF v_filter->>'type' = 'range' THEN
        v_min := (v_filter->>'min')::numeric;
        v_max := (v_filter->>'max')::numeric;
        v_where := v_where || format(
          ' AND EXISTS (
            SELECT 1 FROM public.product_attributes pa
            WHERE pa.product_id = p.id
              AND pa.attribute_id = %L
              AND public.parse_attribute_numeric_value(pa.value) IS NOT NULL
              AND public.parse_attribute_numeric_value(pa.value) >= %s
              AND public.parse_attribute_numeric_value(pa.value) <= %s
          )',
          v_attr_id,
          v_min,
          v_max
        );
      END IF;
    END LOOP;
  END IF;

  v_sort := lower(trim(coalesce(p_sort, 'relevance')));
  IF v_sort NOT IN ('relevance', 'date', 'asc', 'desc') THEN
    v_sort := 'relevance';
  END IF;

  v_sql := format(
    'WITH filtered AS (
      SELECT
        p.id,
        p.name,
        p.slug,
        p.description,
        p.brand,
        p.main_image,
        p.price,
        p.custom_price,
        p.original_price,
        p.created_at,
        public.product_effective_price(p.custom_price, p.price) AS eff_price,
        fp.priority AS fp_priority,
        fp.created_at AS fp_created_at,
        (fp.id IS NOT NULL) AS is_featured
      FROM public.products p
      LEFT JOIN public.category_featured_products fp
        ON fp.product_id = p.id AND fp.category_id = %L
      WHERE %s
    ),
    ranked AS (
      SELECT
        f.*,
        count(*) OVER () AS total_count
      FROM filtered f
    )
    SELECT
      r.id,
      r.name,
      r.slug,
      r.description,
      r.brand,
      r.main_image,
      r.price,
      r.custom_price,
      r.original_price,
      r.created_at,
      r.total_count
    FROM ranked r
    ORDER BY
      CASE WHEN r.is_featured THEN 0 ELSE 1 END,
      r.fp_priority ASC NULLS LAST,
      r.fp_created_at DESC NULLS LAST,
      CASE WHEN %L = ''date'' THEN r.created_at END DESC NULLS LAST,
      CASE WHEN %L = ''asc'' THEN r.eff_price END ASC NULLS LAST,
      CASE WHEN %L = ''desc'' THEN r.eff_price END DESC NULLS LAST,
      r.name ASC,
      r.id ASC
    LIMIT %s OFFSET %s',
    p_category_id,
    v_where,
    v_sort,
    v_sort,
    v_sort,
    v_page_size,
    v_offset
  );

  RETURN QUERY EXECUTE v_sql USING p_category_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_category_shop_facets(p_category_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible AS (
    SELECT
      p.id,
      p.brand,
      public.product_effective_price(p.custom_price, p.price) AS eff_price
    FROM public.products p
    WHERE p.category_id = p_category_id
      AND p.is_active = true
      AND p.publish_locked = false
  ),
  priced AS (
    SELECT * FROM visible WHERE eff_price > 0
  ),
  price_bounds AS (
    SELECT min(eff_price) AS price_min, max(eff_price) AS price_max
    FROM priced
  ),
  brands AS (
    SELECT coalesce(
      jsonb_agg(brand ORDER BY brand),
      '[]'::jsonb
    ) AS items
    FROM (
      SELECT DISTINCT trim(brand) AS brand
      FROM priced
      WHERE brand IS NOT NULL AND trim(brand) <> ''
    ) b
  ),
  attribute_values AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object('attribute_id', pa.attribute_id, 'value', trim(pa.value))
        ORDER BY pa.attribute_id, trim(pa.value)
      ),
      '[]'::jsonb
    ) AS items
    FROM public.product_attributes pa
    INNER JOIN priced pr ON pr.id = pa.product_id
    WHERE pa.value IS NOT NULL
      AND trim(pa.value) <> ''
      AND lower(trim(pa.value)) NOT IN ('-', 'n/a', '—')
  )
  SELECT jsonb_build_object(
    'price_min', (SELECT price_min FROM price_bounds),
    'price_max', (SELECT price_max FROM price_bounds),
    'brands', (SELECT items FROM brands),
    'attribute_values', (SELECT items FROM attribute_values)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_category_products_listing(
  uuid, text[], numeric, numeric, jsonb, text, integer, integer
) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_category_shop_facets(uuid) TO service_role;
