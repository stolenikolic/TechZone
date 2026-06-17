-- 00059_domestic_km_pricing.sql
-- BiH domestic suppliers: net KM nabavna × pdv_bih (ComTrade, Avtera).

ALTER TABLE public.suppliers
  DROP CONSTRAINT IF EXISTS suppliers_pricing_formula_check;

ALTER TABLE public.suppliers
  ADD CONSTRAINT suppliers_pricing_formula_check
  CHECK (
    pricing_formula IS NULL
    OR pricing_formula IN (
      'ipon_huf',
      'hungary_huf_alza_tax',
      'domestic_custom',
      'domestic_km_net'
    )
  );

COMMENT ON COLUMN public.suppliers.pricing_formula IS
  'ipon_huf | hungary_huf_alza_tax | domestic_custom | domestic_km_net (net KM × pdv_bih) | NULL = legacy convert.';

UPDATE public.suppliers
SET pricing_formula = 'domestic_km_net'
WHERE code IN ('comtrade', 'avtera');
