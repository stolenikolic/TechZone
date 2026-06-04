-- 00047_suppliers_inbound_lead_days_default.sql
-- Default lead days (before first Monday inbound) per supplier — editable in admin Settings.

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS inbound_lead_days_default integer;

COMMENT ON COLUMN public.suppliers.inbound_lead_days_default IS
  'Default lead days for delivery estimate when not overridden per offer. iPon uses supplier_products.delivery_days (NULL=0). Others use this value (default 7).';

UPDATE public.suppliers
SET inbound_lead_days_default = 0
WHERE id = 'a10f40b1-1c98-462d-81e8-47c1bef989db'
  AND inbound_lead_days_default IS NULL;

UPDATE public.suppliers
SET inbound_lead_days_default = 7
WHERE id <> 'a10f40b1-1c98-462d-81e8-47c1bef989db'
  AND inbound_lead_days_default IS NULL;
