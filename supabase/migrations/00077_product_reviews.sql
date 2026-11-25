-- Customer reviews for delivered purchases. One review per account and product.
-- products.rating / products.rating_count are the published aggregate, maintained by trigger.
-- Existing ratings are 0 and are left in place; a product with rating_count 0 has no public score.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS rating numeric(3,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS rating_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.products ALTER COLUMN rating DROP NOT NULL;

DO $$
DECLARE
  v_type text;
BEGIN
  SELECT data_type INTO v_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'products'
    AND column_name = 'rating';

  IF v_type IN ('integer', 'smallint', 'bigint') THEN
    ALTER TABLE public.products
      ALTER COLUMN rating TYPE numeric(3,2) USING rating::numeric(3,2);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders (id) ON DELETE SET NULL,
  rating smallint NOT NULL,
  comment text,
  author_name text NOT NULL,
  status text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_reviews_rating_check CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT product_reviews_comment_check CHECK (
    comment IS NULL OR (char_length(comment) > 0 AND char_length(comment) <= 1000)
  ),
  CONSTRAINT product_reviews_status_check CHECK (status IN ('published', 'hidden')),
  CONSTRAINT product_reviews_author_name_check CHECK (char_length(trim(author_name)) > 0),
  CONSTRAINT product_reviews_product_user_key UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON public.product_reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_order_id ON public.product_reviews (order_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_published_list
  ON public.product_reviews (product_id, created_at DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_orders_delivered_user
  ON public.orders (user_id)
  WHERE status = 'Delivered';

CREATE OR REPLACE FUNCTION public.refresh_product_rating_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := OLD.product_id;
  ELSE
    target_id := NEW.product_id;
  END IF;

  UPDATE public.products AS p
  SET
    rating = stats.avg_rating,
    rating_count = stats.review_count
  FROM (
    SELECT
      ROUND(AVG(r.rating)::numeric, 2) AS avg_rating,
      COUNT(*)::integer AS review_count
    FROM public.product_reviews AS r
    WHERE r.product_id = target_id
      AND r.status = 'published'
  ) AS stats
  WHERE p.id = target_id;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.product_id IS DISTINCT FROM OLD.product_id THEN
      UPDATE public.products AS p
      SET
        rating = stats.avg_rating,
        rating_count = stats.review_count
      FROM (
        SELECT
          ROUND(AVG(r.rating)::numeric, 2) AS avg_rating,
          COUNT(*)::integer AS review_count
        FROM public.product_reviews AS r
        WHERE r.product_id = OLD.product_id
          AND r.status = 'published'
      ) AS stats
      WHERE p.id = OLD.product_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS product_reviews_refresh_stats ON public.product_reviews;
CREATE TRIGGER product_reviews_refresh_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_product_rating_stats();

REVOKE ALL ON FUNCTION public.refresh_product_rating_stats() FROM PUBLIC, anon, authenticated;

-- Writes go through this function so eligibility cannot be skipped from the Data API.
CREATE OR REPLACE FUNCTION public.submit_product_review(
  p_product_id uuid,
  p_rating smallint,
  p_comment text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_order uuid;
  v_name text;
  v_comment text;
  v_row public.product_reviews;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'review_not_authenticated';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'review_invalid_rating';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN
    RAISE EXCEPTION 'review_product_missing';
  END IF;

  v_comment := trim(coalesce(p_comment, ''));
  v_comment := regexp_replace(v_comment, '<[^>]*>', '', 'g');
  v_comment := regexp_replace(v_comment, '[[:cntrl:]&&[^[:space:]]]', '', 'g');
  v_comment := nullif(v_comment, '');

  IF v_comment IS NOT NULL AND char_length(v_comment) > 1000 THEN
    RAISE EXCEPTION 'review_comment_too_long';
  END IF;

  SELECT o.id
  INTO v_order
  FROM public.orders AS o
  JOIN public.order_items AS oi ON oi.order_id = o.id
  WHERE o.user_id = v_user
    AND o.status = 'Delivered'
    AND oi.product_id = p_product_id
  ORDER BY o.created_at DESC
  LIMIT 1;

  SELECT left(
    coalesce(
      nullif(split_part(trim(coalesce(full_name, '')), ' ', 1), ''),
      'Kupac'
    ),
    80
  )
  INTO v_name
  FROM public.profiles
  WHERE id = v_user;

  v_name := coalesce(nullif(trim(coalesce(v_name, '')), ''), 'Kupac');

  INSERT INTO public.product_reviews (
    product_id,
    user_id,
    order_id,
    rating,
    comment,
    author_name,
    status
  )
  VALUES (
    p_product_id,
    v_user,
    v_order,
    p_rating,
    v_comment,
    v_name,
    'published'
  )
  ON CONFLICT (product_id, user_id) DO UPDATE
  SET
    rating = EXCLUDED.rating,
    comment = EXCLUDED.comment,
    author_name = EXCLUDED.author_name,
    order_id = COALESCE(EXCLUDED.order_id, product_reviews.order_id),
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'rating', v_row.rating,
    'comment', v_row.comment,
    'author_name', v_row.author_name,
    'status', v_row.status,
    'verified_purchase', v_row.order_id IS NOT NULL,
    'created_at', v_row.created_at,
    'updated_at', v_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_product_review(uuid, smallint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_product_review(uuid, smallint, text) TO authenticated;

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_reviews_select_visible ON public.product_reviews;
CREATE POLICY product_reviews_select_visible
  ON public.product_reviews
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    OR user_id = (SELECT auth.uid())
  );

REVOKE ALL ON TABLE public.product_reviews FROM anon, authenticated;
GRANT SELECT ON TABLE public.product_reviews TO anon, authenticated;
GRANT ALL ON TABLE public.product_reviews TO service_role;
