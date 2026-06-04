-- 00046_delivery_policy_weekly_only.sql
-- Ispravka: svi dobavljači primaju pošiljke svakog ponedjeljka (ne svaki drugi).
-- Razlika između dobavljača je supplier_products.delivery_days (lead), ne biweekly raspored.

UPDATE public.suppliers
SET delivery_policy = '{"type":"weekly","weekday":1}'::jsonb
WHERE delivery_policy IS NULL
   OR delivery_policy->>'type' = 'biweekly';

COMMENT ON COLUMN public.suppliers.delivery_policy IS
  'Inbound kod nas: weekly weekday (1 = ponedjeljak). Lead time = supplier_products.delivery_days.';
