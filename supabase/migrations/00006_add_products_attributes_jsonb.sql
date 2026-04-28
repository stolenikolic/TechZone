-- Preparation for future high-performance filtering (30k+ products).
-- Store product attributes in JSONB to avoid multiple JOINs when filtering.
-- Existing attribute tables (product_attributes, attributes, category_attributes) are unchanged.
-- No existing queries or filtering logic are modified.
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS attributes JSONB;
