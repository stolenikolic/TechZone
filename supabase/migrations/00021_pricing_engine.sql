-- Pricing engine: global settings, margin tiers, supplier formulas, category/product margin overrides.

CREATE TABLE IF NOT EXISTS public.pricing_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kurs_eur numeric,
  eur_km_rate numeric,
  alza_tax numeric,
  pdv_bih numeric,
  default_selling_margin numeric,
  min_absolute_profit_km numeric,
  min_margin_percent numeric,
  high_cost_threshold_km numeric,
  high_cost_max_margin_multiplier numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pricing_settings IS 'Global pricing knobs; fill via admin.';
COMMENT ON COLUMN public.pricing_settings.kurs_eur IS 'HUF per 1 EUR divisor (e.g. 370 HUF = 1 EUR).';
COMMENT ON COLUMN public.pricing_settings.eur_km_rate IS 'EUR to KM multiplier (e.g. 1.95).';
COMMENT ON COLUMN public.pricing_settings.alza_tax IS 'Extra HU factor for non-iPon Hungarian sources (e.g. 1.08).';
COMMENT ON COLUMN public.pricing_settings.pdv_bih IS 'BiH VAT multiplier in acquisition KM (e.g. 1.17).';
COMMENT ON COLUMN public.pricing_settings.default_selling_margin IS 'Selling multiplier when no tier/category/product override.';
COMMENT ON COLUMN public.pricing_settings.min_absolute_profit_km IS 'Minimum profit floor: sell >= cost + this.';
COMMENT ON COLUMN public.pricing_settings.min_margin_percent IS 'Minimum relative margin as fraction (e.g. 0.10 = 10%).';
COMMENT ON COLUMN public.pricing_settings.high_cost_threshold_km IS 'Acquisition cost from which high_cost_max_margin_multiplier caps m.';
COMMENT ON COLUMN public.pricing_settings.high_cost_max_margin_multiplier IS 'Cap on selling multiplier m when cost >= threshold.';

INSERT INTO public.pricing_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM public.pricing_settings LIMIT 1);

CREATE TABLE IF NOT EXISTS public.pricing_margin_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_cost_km numeric NOT NULL,
  max_cost_km numeric,
  margin_multiplier numeric NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pricing_margin_tiers IS 'Cost bands -> selling multiplier when no category/product margin override.';
COMMENT ON COLUMN public.pricing_margin_tiers.max_cost_km IS 'Exclusive upper bound; NULL = no upper limit.';

CREATE INDEX IF NOT EXISTS idx_pricing_margin_tiers_min
  ON public.pricing_margin_tiers (min_cost_km, sort_order);

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS pricing_formula text,
  ADD COLUMN IF NOT EXISTS cost_adjustment_multiplier numeric NOT NULL DEFAULT 1.0;

COMMENT ON COLUMN public.suppliers.pricing_formula IS 'ipon_huf | hungary_huf_alza_tax | NULL = legacy app conversion.';
COMMENT ON COLUMN public.suppliers.cost_adjustment_multiplier IS 'Multiplier on computed acquisition KM (default 1).';

ALTER TABLE public.suppliers
  DROP CONSTRAINT IF EXISTS suppliers_pricing_formula_check;

ALTER TABLE public.suppliers
  ADD CONSTRAINT suppliers_pricing_formula_check
  CHECK (
    pricing_formula IS NULL
    OR pricing_formula IN ('ipon_huf', 'hungary_huf_alza_tax', 'domestic_custom')
  );

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS selling_margin_default numeric;

COMMENT ON COLUMN public.categories.selling_margin_default IS 'Selling multiplier; replaces tier when set.';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS selling_margin_override numeric;

COMMENT ON COLUMN public.products.selling_margin_override IS 'Selling multiplier; replaces tier and category default when set.';

UPDATE public.suppliers
SET
  pricing_formula = 'ipon_huf',
  cost_adjustment_multiplier = COALESCE(cost_adjustment_multiplier, 1.0)
WHERE id = 'a10f40b1-1c98-462d-81e8-47c1bef989db';

UPDATE public.suppliers
SET
  pricing_formula = 'hungary_huf_alza_tax',
  cost_adjustment_multiplier = COALESCE(cost_adjustment_multiplier, 1.0)
WHERE id = 'f4a8b2c0-9d1e-4f3a-bc5d-6e7f8091a2b3';

ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_margin_tiers ENABLE ROW LEVEL SECURITY;
