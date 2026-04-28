-- Improve category filter performance for 30k+ products.
-- products.brand: used in .eq("category_id", ...).in("brand", brandFilterNames)
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products (brand) WHERE brand IS NOT NULL;

-- product_attributes.value: used when resolving attribute filters (capacity, rpm, buffer, size)
CREATE INDEX IF NOT EXISTS idx_product_attributes_value ON public.product_attributes (value);
