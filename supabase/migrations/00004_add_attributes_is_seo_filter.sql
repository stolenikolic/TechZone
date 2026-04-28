-- Add is_seo_filter to attributes (prepare for future SEO-friendly filter URLs)
-- When true, this attribute may be used in path segments (e.g. /hard-diskovi/4tb for capacity).
ALTER TABLE public.attributes
ADD COLUMN IF NOT EXISTS is_seo_filter boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.attributes.is_seo_filter IS 'When true, this attribute can be used in SEO-friendly URL segments. Used later when adding path-based filters.';

-- Set defaults: capacity = true; rpm, buffer, size_inch = false.
-- Note: "brand" is not in attributes (it lives on products.brand); handle brand via app or category_seo_filters when adding SEO URLs.
UPDATE public.attributes SET is_seo_filter = true WHERE slug = 'capacity';
UPDATE public.attributes SET is_seo_filter = false WHERE slug IN ('rpm', 'buffer', 'size_inch');
