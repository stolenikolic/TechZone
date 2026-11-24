-- Full-catalog price aggregation pages active linked offers by primary key
-- (is_active AND product_id IS NOT NULL, ORDER BY id). The previous
-- ORDER BY product_id + OFFSET sorted the whole filtered set and hit
-- PostgREST statement_timeout on the first page.

CREATE INDEX IF NOT EXISTS idx_supplier_products_active_linked_id
  ON public.supplier_products (id)
  WHERE is_active AND product_id IS NOT NULL;
