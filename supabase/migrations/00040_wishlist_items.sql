-- Per-user wishlist (authenticated); guests use localStorage on the client.

CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_items_user_id ON public.wishlist_items (user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_product_id ON public.wishlist_items (product_id);

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wishlist_items_select_own ON public.wishlist_items;
CREATE POLICY wishlist_items_select_own ON public.wishlist_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS wishlist_items_insert_own ON public.wishlist_items;
CREATE POLICY wishlist_items_insert_own ON public.wishlist_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS wishlist_items_delete_own ON public.wishlist_items;
CREATE POLICY wishlist_items_delete_own ON public.wishlist_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
