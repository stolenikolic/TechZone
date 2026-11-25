-- Any signed-in customer can review a product.
-- order_id is set only when that account has a delivered order for the product.

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
