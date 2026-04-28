-- Category image for homepage category section
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT;
