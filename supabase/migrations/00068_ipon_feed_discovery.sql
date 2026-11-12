-- iPon feed discovery: category path + filter membership + pending new IDs.
-- Service role bypasses RLS. No policies for anon/authenticated (jobs only).

ALTER TABLE public.supplier_categories
  ADD COLUMN IF NOT EXISTS feed_category_path text,
  ADD COLUMN IF NOT EXISTS membership_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS membership_status text,
  ADD COLUMN IF NOT EXISTS membership_expected integer,
  ADD COLUMN IF NOT EXISTS membership_fetched integer;

ALTER TABLE public.supplier_categories
  DROP CONSTRAINT IF EXISTS supplier_categories_membership_status_check;

ALTER TABLE public.supplier_categories
  ADD CONSTRAINT supplier_categories_membership_status_check
  CHECK (
    membership_status IS NULL
    OR membership_status IN ('complete', 'incomplete', 'failed')
  );

COMMENT ON COLUMN public.supplier_categories.feed_category_path IS
  'Hungarian Árukereső <category> path for this iPon group. Parent key for feed discovery.';

CREATE TABLE IF NOT EXISTS public.ipon_category_membership (
  supplier_product_id text NOT NULL,
  supplier_category_id uuid NOT NULL REFERENCES public.supplier_categories (id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (supplier_product_id, supplier_category_id)
);

CREATE INDEX IF NOT EXISTS ipon_category_membership_product_idx
  ON public.ipon_category_membership (supplier_product_id);

CREATE INDEX IF NOT EXISTS ipon_category_membership_category_idx
  ON public.ipon_category_membership (supplier_category_id);

COMMENT ON TABLE public.ipon_category_membership IS
  'iPon list-API id → supplier_categories row. Built only from existing listing filters.';

CREATE TABLE IF NOT EXISTS public.ipon_feed_pending (
  supplier_product_id text PRIMARY KEY,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  status text NOT NULL DEFAULT 'pending',
  reason text,
  candidate_category_ids uuid[] NOT NULL DEFAULT '{}',
  unclassified_checks integer NOT NULL DEFAULT 0 CHECK (unclassified_checks >= 0),
  last_membership_proof_at timestamptz,
  feed_snapshot jsonb
);

ALTER TABLE public.ipon_feed_pending
  DROP CONSTRAINT IF EXISTS ipon_feed_pending_status_check;

ALTER TABLE public.ipon_feed_pending
  ADD CONSTRAINT ipon_feed_pending_status_check
  CHECK (status IN ('pending', 'ambiguous', 'unclassified', 'no_tracking'));

CREATE INDEX IF NOT EXISTS ipon_feed_pending_attempt_idx
  ON public.ipon_feed_pending (last_attempt_at NULLS FIRST);

COMMENT ON TABLE public.ipon_feed_pending IS
  'Feed identifiers not yet in supplier_products. unclassified_checks counts proven filter misses.';

ALTER TABLE public.ipon_category_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipon_feed_pending ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ipon_category_membership FROM anon, authenticated;
REVOKE ALL ON TABLE public.ipon_feed_pending FROM anon, authenticated;
