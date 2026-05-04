-- Obavezno polje grad + istorijska ispravka starih narudžbi (grad + dostava).

-- 1) Kolona grada (ak već ne postoji)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_city text;

-- 2) Postojeće redove bez grada: podrazumijevano Bijeljina
UPDATE orders
SET shipping_city = 'Bijeljina'
WHERE shipping_city IS NULL OR trim(shipping_city) = '';

-- 3) Obavezni grad za nove narudžbe
ALTER TABLE orders ALTER COLUMN shipping_city SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'orders_shipping_city_not_blank'
      AND conrelid = 'orders'::regclass
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_shipping_city_not_blank
      CHECK (length(trim(shipping_city)) > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_shipping_city ON orders(shipping_city);

-- 4) Stare narudžbe: dostava u bazi 13 KM, ukupan iznos uključuje dostavu
-- Pretpostavka: sve gdje je shipping_total još 0, total NIJE još uključivao dostavu.
UPDATE orders
SET
  shipping_total = 13,
  total_price = round((COALESCE(subtotal, 0) + 13)::numeric, 2)
WHERE COALESCE(shipping_total, 0) = 0;
