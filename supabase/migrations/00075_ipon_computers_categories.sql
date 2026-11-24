-- iPon notebook-pc-ebook: real categories, view pointers, and plain group imports.
-- Filter paths (tower, all-in-one, gamer, PoS, ...) are pointers. They are not listing URLs.
-- Idempotent: safe to re-run. image_url left null.

INSERT INTO public.categories (name, slug, parent_id, image_url)
SELECT 'Računari', 'racunari', NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c WHERE c.slug = 'racunari'
);

INSERT INTO public.categories (name, slug, parent_id, image_url)
SELECT v.name, v.slug, p.id, NULL
FROM (VALUES
  ('Laptopi', 'laptopi'),
  ('Pribor za laptop', 'pribor-za-laptop'),
  ('Torbe za laptop', 'torbe-za-laptop'),
  ('Desktop računari', 'desktop-racunari'),
  ('Mini računari', 'mini-racunari'),
  ('Barebone sistemi', 'barebone-sistemi')
) AS v(name, slug)
JOIN public.categories p ON p.slug = 'racunari' AND p.parent_id IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c WHERE c.slug = v.slug
);

INSERT INTO public.categories (name, slug, parent_id, image_url)
SELECT v.name, v.slug, p.id, NULL
FROM (VALUES
  ('E-čitači', 'e-citaci'),
  ('Pribor za e-čitače', 'pribor-za-e-citace')
) AS v(name, slug)
JOIN public.categories p ON p.slug = 'telefoni-tableti-pametni-uredjaji' AND p.parent_id IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c WHERE c.slug = v.slug
);

INSERT INTO public.attributes (name, slug, name_bs, is_seo_filter, filter_display_type)
VALUES
  ('Gamer', 'gamer', 'Gamer', false, 'checkbox'),
  ('Form factor', 'form_factor', 'Oblik', false, 'checkbox')
ON CONFLICT (slug) DO UPDATE
SET
  name_bs = COALESCE(public.attributes.name_bs, EXCLUDED.name_bs),
  filter_display_type = EXCLUDED.filter_display_type;

INSERT INTO public.category_attributes (category_id, attribute_id, sort_order)
SELECT c.id, a.id, 0
FROM public.categories c
JOIN public.attributes a ON a.slug = 'gamer'
WHERE c.slug = 'laptopi'
  AND NOT EXISTS (
    SELECT 1
    FROM public.category_attributes ca
    WHERE ca.category_id = c.id AND ca.attribute_id = a.id
  );

INSERT INTO public.category_attributes (category_id, attribute_id, sort_order)
SELECT c.id, a.id, 0
FROM public.categories c
JOIN public.attributes a ON a.slug = 'form_factor'
WHERE c.slug = 'desktop-racunari'
  AND NOT EXISTS (
    SELECT 1
    FROM public.category_attributes ca
    WHERE ca.category_id = c.id AND ca.attribute_id = a.id
  );

INSERT INTO public.categories (
  name,
  slug,
  parent_id,
  image_url,
  view_source_category_id,
  view_filter_attribute_slug,
  view_filter_value
)
SELECT v.name, v.slug, parent.id, NULL, src.id, v.attribute_slug, v.filter_value
FROM (VALUES
  ('Gaming laptopi', 'gaming-laptopi', 'laptopi', 'gamer', 'Yes'),
  ('All-in-One računari', 'all-in-one-racunari', 'desktop-racunari', 'form_factor', 'all-in-one'),
  ('Tower računari', 'tower-racunari', 'desktop-racunari', 'form_factor', 'tower'),
  ('Landscape računari', 'landscape-racunari', 'desktop-racunari', 'form_factor', 'landscape'),
  ('Kompaktni računari', 'kompaktni-racunari', 'desktop-racunari', 'form_factor', 'compact'),
  ('POS terminali', 'pos-terminali', 'desktop-racunari', 'form_factor', 'pos')
) AS v(name, slug, source_slug, attribute_slug, filter_value)
JOIN public.categories parent ON parent.slug = 'racunari' AND parent.parent_id IS NULL
JOIN public.categories src ON src.slug = v.source_slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c WHERE c.slug = v.slug
);

UPDATE public.categories pointer
SET
  parent_id = parent.id,
  view_source_category_id = src.id,
  view_filter_attribute_slug = v.attribute_slug,
  view_filter_value = v.filter_value
FROM (VALUES
  ('gaming-laptopi', 'laptopi', 'gamer', 'Yes'),
  ('all-in-one-racunari', 'desktop-racunari', 'form_factor', 'all-in-one'),
  ('tower-racunari', 'desktop-racunari', 'form_factor', 'tower'),
  ('landscape-racunari', 'desktop-racunari', 'form_factor', 'landscape'),
  ('kompaktni-racunari', 'desktop-racunari', 'form_factor', 'compact'),
  ('pos-terminali', 'desktop-racunari', 'form_factor', 'pos')
) AS v(slug, source_slug, attribute_slug, filter_value)
JOIN public.categories parent ON parent.slug = 'racunari' AND parent.parent_id IS NULL
JOIN public.categories src ON src.slug = v.source_slug
WHERE pointer.slug = v.slug
  AND (
    pointer.parent_id IS DISTINCT FROM parent.id
    OR pointer.view_source_category_id IS DISTINCT FROM src.id
    OR pointer.view_filter_attribute_slug IS DISTINCT FROM v.attribute_slug
    OR pointer.view_filter_value IS DISTINCT FROM v.filter_value
  );

INSERT INTO public.supplier_categories (
  supplier_id,
  internal_category_id,
  supplier_category_key,
  listing_url,
  is_active,
  sort_order
)
SELECT
  'a10f40b1-1c98-462d-81e8-47c1bef989db',
  c.id,
  v.category_key,
  v.listing_url,
  true,
  v.sort_order
FROM (VALUES
  ('2', 'laptopi', 'https://iponcomp.com/shop/group/notebook-pc-ebook/notebook/2', 110),
  ('23', 'pribor-za-laptop', 'https://iponcomp.com/shop/group/notebook-pc-ebook/notebook-accessories/23', 120),
  ('38', 'torbe-za-laptop', 'https://iponcomp.com/shop/group/notebook-pc-ebook/notebook-bag/38', 130),
  ('64', 'desktop-racunari', 'https://iponcomp.com/shop/group/notebook-pc-ebook/complete-pc/64', 140),
  ('71', 'mini-racunari', 'https://iponcomp.com/shop/group/notebook-pc-ebook/mini-computer/71', 150),
  ('56', 'barebone-sistemi', 'https://iponcomp.com/shop/group/notebook-pc-ebook/barebone/56', 160),
  ('45', 'e-citaci', 'https://iponcomp.com/shop/group/notebook-pc-ebook/ebook/45', 170),
  ('51', 'pribor-za-e-citace', 'https://iponcomp.com/shop/group/notebook-pc-ebook/ebook-accessories/51', 180)
) AS v(category_key, slug, listing_url, sort_order)
JOIN public.categories c ON c.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1
  FROM public.supplier_categories sc
  WHERE sc.supplier_id = 'a10f40b1-1c98-462d-81e8-47c1bef989db'
    AND sc.supplier_category_key = v.category_key
    AND sc.listing_url = v.listing_url
);

INSERT INTO public.supplier_attribute_mappings (
  supplier_id,
  internal_category_id,
  attribute_id,
  source_field_name,
  match_mode,
  priority,
  is_active
)
SELECT
  'a10f40b1-1c98-462d-81e8-47c1bef989db',
  c.id,
  a.id,
  'iPon Gamer',
  'exact',
  40,
  true
FROM public.categories c
JOIN public.attributes a ON a.slug = 'gamer'
WHERE c.slug = 'laptopi'
  AND NOT EXISTS (
    SELECT 1
    FROM public.supplier_attribute_mappings m
    WHERE m.supplier_id = 'a10f40b1-1c98-462d-81e8-47c1bef989db'
      AND m.internal_category_id = c.id
      AND m.attribute_id = a.id
      AND m.source_field_name = 'iPon Gamer'
  );

INSERT INTO public.attribute_value_aliases (
  attribute_id,
  alias,
  canonical_label,
  match_mode,
  supplier_id,
  priority,
  is_active
)
SELECT
  a.id,
  v.alias,
  'Yes',
  'exact',
  'a10f40b1-1c98-462d-81e8-47c1bef989db',
  10,
  true
FROM public.attributes a
CROSS JOIN (VALUES ('yes'), ('Igen'), ('Da')) AS v(alias)
WHERE a.slug = 'gamer'
  AND NOT EXISTS (
    SELECT 1
    FROM public.attribute_value_aliases existing
    WHERE existing.attribute_id = a.id
      AND lower(trim(existing.alias)) = lower(trim(v.alias))
      AND existing.supplier_id = 'a10f40b1-1c98-462d-81e8-47c1bef989db'
  );
