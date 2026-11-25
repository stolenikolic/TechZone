-- Unscoped reconcile used to rewrite every linked master (~56k rows) and hit the
-- PostgREST statement_timeout, so price syncs scoped the call to products touched
-- in that run. A product whose offers were already inactive was never visited again,
-- and products.is_active stayed true.
--
-- NULL argument now repairs only drifted rows:
--   off when every linked offer is inactive, on when any linked offer is active.
--   Masters with no supplier_products rows are left alone.
-- An uuid array still limits the update to those masters.

DROP FUNCTION IF EXISTS public.reconcile_products_is_active_from_supplier_offers(uuid[]);
DROP FUNCTION IF EXISTS public.reconcile_products_is_active_from_supplier_offers();

CREATE FUNCTION public.reconcile_products_is_active_from_supplier_offers(
  p_product_ids uuid[] DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '120s'
AS $$
DECLARE
  updated_count integer := 0;
  n integer := 0;
BEGIN
  IF p_product_ids IS NULL THEN
    UPDATE public.products p
    SET is_active = false,
        updated_at = now()
    WHERE p.is_active IS DISTINCT FROM false
      AND EXISTS (
        SELECT 1
        FROM public.supplier_products sp
        WHERE sp.product_id = p.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.supplier_products sp
        WHERE sp.product_id = p.id
          AND sp.is_active
      );
    GET DIAGNOSTICS n = ROW_COUNT;
    updated_count := updated_count + n;

    UPDATE public.products p
    SET is_active = true,
        updated_at = now()
    WHERE p.is_active IS DISTINCT FROM true
      AND EXISTS (
        SELECT 1
        FROM public.supplier_products sp
        WHERE sp.product_id = p.id
          AND sp.is_active
      );
    GET DIAGNOSTICS n = ROW_COUNT;
    updated_count := updated_count + n;
  ELSE
    UPDATE public.products p
    SET is_active = agg.active_any,
        updated_at = now()
    FROM (
      SELECT product_id, bool_or(is_active) AS active_any
      FROM public.supplier_products
      WHERE product_id IS NOT NULL
        AND product_id = ANY (p_product_ids)
      GROUP BY product_id
    ) agg
    WHERE p.id = agg.product_id
      AND p.is_active IS DISTINCT FROM agg.active_any;
    GET DIAGNOSTICS n = ROW_COUNT;
    updated_count := n;
  END IF;

  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_products_is_active_from_supplier_offers(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reconcile_products_is_active_from_supplier_offers(uuid[]) FROM anon;
REVOKE ALL ON FUNCTION public.reconcile_products_is_active_from_supplier_offers(uuid[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_products_is_active_from_supplier_offers(uuid[]) TO service_role;

COMMENT ON FUNCTION public.reconcile_products_is_active_from_supplier_offers(uuid[]) IS
  'Sets products.is_active from linked supplier_products. NULL repairs drifted rows in the whole catalog. An uuid array limits the update to those masters.';
