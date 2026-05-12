-- Category-specific highlighted products (Top pick) with manual priority.
CREATE TABLE IF NOT EXISTS public.category_featured_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT category_featured_products_unique UNIQUE (category_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_category_featured_products_category_priority
  ON public.category_featured_products (category_id, priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_category_featured_products_product
  ON public.category_featured_products (product_id);

ALTER TABLE public.category_featured_products ENABLE ROW LEVEL SECURITY;
