-- Homepage section flags and discount (nullable for future use)
-- If columns already exist, they are not recreated.

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_flash_deal boolean DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent integer;
