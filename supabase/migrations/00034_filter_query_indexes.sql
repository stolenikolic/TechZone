-- Filter query performance: composite indexes aligned with attribute_id + product_id lookups.
-- Safe: IF NOT EXISTS only; no data or schema changes to application tables.

CREATE INDEX IF NOT EXISTS idx_product_attributes_attr_product
  ON public.product_attributes (attribute_id, product_id);

CREATE INDEX IF NOT EXISTS idx_product_attributes_product_attr
  ON public.product_attributes (product_id, attribute_id);

CREATE INDEX IF NOT EXISTS idx_products_category_active
  ON public.products (category_id, is_active)
  WHERE is_active = true;
