-- Homepage CMS: single table for hero, side banners, promo blocks.

CREATE TABLE IF NOT EXISTS public.homepage_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  image_url text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT homepage_blocks_zone_check CHECK (
    zone IN ('hero_carousel', 'hero_side', 'promo')
  )
);

CREATE INDEX IF NOT EXISTS idx_homepage_blocks_zone_sort
  ON public.homepage_blocks (zone, sort_order);

-- Seed defaults (static asset URLs until replaced via admin upload).
INSERT INTO public.homepage_blocks (zone, sort_order, is_active, image_url, content)
VALUES
  (
    'hero_carousel',
    0,
    true,
    '/assets/images/hero/hero-1.jpg',
    '{"title":"Tech Deals","categoryLabel":"Electronics","description":"Discover the latest gadgets and tech essentials.","buttonLink":"/products","buttonLabel":"EXPLORE NOW"}'::jsonb
  ),
  (
    'hero_carousel',
    1,
    true,
    '/assets/images/hero/hero-2.jpg',
    '{"title":"New Arrivals","categoryLabel":"Featured","description":"Explore new products and exclusive offers.","buttonLink":"/products","buttonLabel":"EXPLORE NOW"}'::jsonb
  ),
  (
    'hero_side',
    0,
    true,
    '/assets/images/market-2/shoe-1.png',
    '{"tag":"New Arrivals","title":"Winter Sale 20% OFF","linkUrl":"/","buttonLabel":"EXPLORE NOW"}'::jsonb
  ),
  (
    'hero_side',
    1,
    true,
    '/assets/images/market-2/airpods-1.png',
    '{"tag":"Accessories","title":"Airpods Pro 30% OFF","linkUrl":"/","buttonLabel":"EXPLORE NOW"}'::jsonb
  ),
  (
    'promo',
    0,
    true,
    '/assets/images/market-1/promo-1.jpg',
    '{"title":"Summer Collection","description":"Save up to 50% on summer essentials including swimwear, dresses, sandals, and accessories","buttonLink":"/products/search","buttonLabel":"Shop Now"}'::jsonb
  ),
  (
    'promo',
    1,
    true,
    '/assets/images/market-1/promo-2.jpg',
    '{"title":"Spring Essentials","description":"Save up to 50% on spring essentials including jackets, rain boots, and seasonal accessories","buttonLink":"/products/search","buttonLabel":"Shop Now"}'::jsonb
  );
