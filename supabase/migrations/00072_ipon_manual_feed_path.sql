-- Hand-entered iPon feed path. Longer path wins over the automatic two-level menu key.
-- Service role bypasses RLS. The column lives on the existing supplier_categories table.

ALTER TABLE public.supplier_categories
  ADD COLUMN IF NOT EXISTS manual_feed_path text;

COMMENT ON COLUMN public.supplier_categories.manual_feed_path IS
  'Hand-entered iPon feed <category> path, two or more levels. Longer path wins over the automatic two-level menu key.';
