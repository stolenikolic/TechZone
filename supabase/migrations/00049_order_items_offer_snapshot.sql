-- Snapshot of storefront offer choice at checkout (per order line).

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS supplier_product_id uuid REFERENCES public.supplier_products (id) ON DELETE SET NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS offer_choice text;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS offer_label text;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS supplier_name text;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS delivery_label text;

COMMENT ON COLUMN public.order_items.supplier_product_id IS
  'Supplier offer row purchased (snapshot reference).';
COMMENT ON COLUMN public.order_items.offer_choice IS
  'cheapest | fastest — storefront purchase option key.';
COMMENT ON COLUMN public.order_items.offer_label IS
  'Display label at checkout, e.g. Najjeftinije / Najbrza dostava.';
COMMENT ON COLUMN public.order_items.supplier_name IS
  'Supplier display name at checkout time.';
COMMENT ON COLUMN public.order_items.delivery_label IS
  'Delivery estimate text shown to customer at checkout.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_offer_choice_check'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_offer_choice_check
      CHECK (offer_choice IS NULL OR offer_choice IN ('cheapest', 'fastest'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_order_items_supplier_product_id
  ON public.order_items (supplier_product_id);
