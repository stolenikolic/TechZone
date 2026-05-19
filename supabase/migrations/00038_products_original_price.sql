-- Strikethrough / rate reference price (typically effective + markup %, rounded to whole KM).

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS original_price numeric(12, 2);

COMMENT ON COLUMN public.products.original_price IS
  'Display reference price (whole KM). Computed from effective price + pricing_settings.original_price_markup_percent.';

ALTER TABLE public.pricing_settings
  ADD COLUMN IF NOT EXISTS original_price_markup_percent numeric;

COMMENT ON COLUMN public.pricing_settings.original_price_markup_percent IS
  'Percent added on top of effective price for original_price (e.g. 10 = +10%). Result rounded to nearest whole KM.';

UPDATE public.pricing_settings
SET original_price_markup_percent = 10
WHERE original_price_markup_percent IS NULL;

-- Backfill original_price for existing products (nearest whole KM).
UPDATE public.products p
SET original_price = round(
  (
    COALESCE(p.custom_price, p.price)
    * (
      1
      + COALESCE(
        (SELECT ps.original_price_markup_percent FROM public.pricing_settings ps LIMIT 1),
        10
      ) / 100.0
    )
  )::numeric
)
WHERE COALESCE(p.custom_price, p.price) IS NOT NULL
  AND COALESCE(p.custom_price, p.price) > 0;

CREATE OR REPLACE FUNCTION public.update_products_prices(entries jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE products p
  SET
    price = (elem->>'price')::numeric,
    original_price = (elem->>'original_price')::numeric,
    updated_at = now()
  FROM jsonb_array_elements(entries) AS elem
  WHERE p.id = (elem->>'id')::uuid;
$$;
