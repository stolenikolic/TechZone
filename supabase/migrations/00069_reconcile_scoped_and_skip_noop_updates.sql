-- Scope reconcile_products_is_active_from_supplier_offers() to a product_id subset so the
-- 2h/4h price-sync jobs (iPon XML, Avtera, ComTrade) only reconcile the masters they just
-- touched instead of scanning/locking all ~56k products every run. Full-catalog behaviour
-- (nightly aggregate_prices, admin tools) is preserved by calling with no argument (NULL).
--
-- update_products_prices / update_products_price_sources now skip rows where nothing
-- actually changed, so repeated syncs with unchanged prices stop rewriting HOT chains and
-- the indexed price_source_region column on every pass.

DROP FUNCTION IF EXISTS public.reconcile_products_is_active_from_supplier_offers();

CREATE FUNCTION public.reconcile_products_is_active_from_supplier_offers(
  p_product_ids uuid[] DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE products p
  SET is_active = agg.active_any,
      updated_at = now()
  FROM (
    SELECT product_id, bool_or(is_active) AS active_any
    FROM supplier_products
    WHERE product_id IS NOT NULL
      AND (p_product_ids IS NULL OR product_id = ANY (p_product_ids))
    GROUP BY product_id
  ) agg
  WHERE p.id = agg.product_id
    AND p.is_active IS DISTINCT FROM agg.active_any;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_products_is_active_from_supplier_offers(uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.update_products_prices(entries jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE products p
  SET
    price = (elem->>'price')::numeric,
    original_price = (elem->>'original_price')::numeric,
    updated_at = now()
  FROM jsonb_array_elements(entries) AS elem
  WHERE p.id = (elem->>'id')::uuid
    AND (
      p.price IS DISTINCT FROM (elem->>'price')::numeric
      OR p.original_price IS DISTINCT FROM (elem->>'original_price')::numeric
    );
$$;

CREATE OR REPLACE FUNCTION public.update_products_price_sources(entries jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE products p
  SET
    price_source_region = elem->>'price_source_region',
    price_source_supplier_id = NULLIF(elem->>'price_source_supplier_id', '')::uuid,
    updated_at = now()
  FROM jsonb_array_elements(entries) AS elem
  WHERE p.id = (elem->>'id')::uuid
    AND (
      p.price_source_region IS DISTINCT FROM (elem->>'price_source_region')
      OR p.price_source_supplier_id IS DISTINCT FROM NULLIF(elem->>'price_source_supplier_id', '')::uuid
    );
$$;
