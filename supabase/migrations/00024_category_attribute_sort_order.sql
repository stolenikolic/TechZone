-- Deterministic per-category attribute ordering for admin-managed filters.
ALTER TABLE public.category_attributes
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT
    category_id,
    attribute_id,
    ROW_NUMBER() OVER (
      PARTITION BY category_id
      ORDER BY sort_order ASC, attribute_id ASC
    ) - 1 AS new_order
  FROM public.category_attributes
)
UPDATE public.category_attributes ca
SET sort_order = ordered.new_order
FROM ordered
WHERE ca.category_id = ordered.category_id
  AND ca.attribute_id = ordered.attribute_id;

CREATE INDEX IF NOT EXISTS idx_category_attributes_category_sort
  ON public.category_attributes (category_id, sort_order);
