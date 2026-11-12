-- English tracking productGroup → supplier category.
-- One name may belong to several categories. One category may own several names.
-- A category is usable only after product_group_learned_at is set.
-- Service role bypasses RLS. No policies for anon/authenticated (jobs only).

CREATE TABLE IF NOT EXISTS public.ipon_product_groups (
  supplier_category_id uuid NOT NULL REFERENCES public.supplier_categories (id) ON DELETE CASCADE,
  product_group text NOT NULL,
  PRIMARY KEY (supplier_category_id, product_group)
);

CREATE INDEX IF NOT EXISTS ipon_product_groups_group_idx
  ON public.ipon_product_groups (product_group);

COMMENT ON TABLE public.ipon_product_groups IS
  'English iponcomp.com tracking productGroup learned from products already in the category.';

CREATE TABLE IF NOT EXISTS public.ipon_product_group_seen (
  supplier_category_id uuid NOT NULL REFERENCES public.supplier_categories (id) ON DELETE CASCADE,
  supplier_product_id text NOT NULL,
  product_group text,
  PRIMARY KEY (supplier_category_id, supplier_product_id)
);

COMMENT ON TABLE public.ipon_product_group_seen IS
  'In-progress productGroup reads. Cleared when the category map is saved.';

ALTER TABLE public.supplier_categories
  ADD COLUMN IF NOT EXISTS product_group_learned_at timestamptz;

COMMENT ON COLUMN public.supplier_categories.product_group_learned_at IS
  'Set when every existing iPon id in the category has been read from tracking.';

ALTER TABLE public.ipon_feed_pending
  ADD COLUMN IF NOT EXISTS product_group text;

COMMENT ON COLUMN public.ipon_feed_pending.product_group IS
  'English productGroup from tracking. Unknown names stay here and are not retried until the map gains that name.';

CREATE INDEX IF NOT EXISTS ipon_feed_pending_product_group_idx
  ON public.ipon_feed_pending (product_group);

ALTER TABLE public.ipon_product_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipon_product_group_seen ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ipon_product_groups FROM anon, authenticated;
REVOKE ALL ON TABLE public.ipon_product_group_seen FROM anon, authenticated;
