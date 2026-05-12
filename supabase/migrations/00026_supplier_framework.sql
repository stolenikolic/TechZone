-- 00026_supplier_framework.sql
-- Generalized supplier configuration. DB-driven categories, attribute mappings, and
-- scrape settings. The new tables coexist with the existing hardcoded mappings in
-- src/lib/suppliers/ipon/* and src/lib/suppliers/pcx/*; an adapter (registry.ts)
-- reads from these tables first and falls back to the hardcoded data when a row is
-- missing. Strangler pattern: no destructive operations, only ADD/CREATE IF NOT EXISTS.

-- Extend suppliers with metadata used by the registry / admin UI.
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS base_url text,
  ADD COLUMN IF NOT EXISTS default_currency text,
  ADD COLUMN IF NOT EXISTS creates_master_products boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Which internal categories does a supplier sync, and which source category key /
-- listing URL maps to that internal category.
CREATE TABLE IF NOT EXISTS public.supplier_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  internal_category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  supplier_category_key text,
  listing_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_categories_unique UNIQUE (supplier_id, internal_category_id)
);

-- How a source attribute name (e.g. iPon spec name "CPU foglalat") maps to an internal
-- attribute (by attribute_id). Optional internal_category_id allows category-scoped
-- overrides. priority controls the order of fallback when multiple mappings match.
CREATE TABLE IF NOT EXISTS public.supplier_attribute_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  internal_category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  attribute_id uuid NOT NULL REFERENCES public.attributes(id) ON DELETE CASCADE,
  source_field_name text NOT NULL,
  match_mode text NOT NULL DEFAULT 'exact',
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mapping_match_mode_check CHECK (match_mode IN ('exact', 'contains', 'regex'))
);

-- Free-form per-supplier configuration (delay_ms, batch_size, user_agent, headers, ...).
-- The registry exposes a typed `getSupplierScrapeConfig(key, fallback)` accessor.
CREATE TABLE IF NOT EXISTS public.supplier_scrape_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_scrape_config_unique UNIQUE (supplier_id, key)
);

CREATE INDEX IF NOT EXISTS idx_supplier_categories_supplier
  ON public.supplier_categories (supplier_id, is_active);

CREATE INDEX IF NOT EXISTS idx_supplier_attribute_mappings_lookup
  ON public.supplier_attribute_mappings (supplier_id, internal_category_id, is_active);

CREATE INDEX IF NOT EXISTS idx_supplier_attribute_mappings_source
  ON public.supplier_attribute_mappings (supplier_id, source_field_name);

CREATE INDEX IF NOT EXISTS idx_supplier_scrape_config_supplier
  ON public.supplier_scrape_config (supplier_id, is_active);
