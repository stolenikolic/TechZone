-- Speeds up the detail-scrape queue:
-- supplier_id + pending snapshot are the filters, updated_at/id define stable FIFO order.
CREATE INDEX IF NOT EXISTS idx_supplier_products_scrape_queue
  ON public.supplier_products (supplier_id, updated_at, id)
  WHERE spec_snapshot IS NULL
    AND product_id IS NOT NULL;
