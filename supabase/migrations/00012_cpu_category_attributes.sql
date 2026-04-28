-- CPU (Procesori): attribute definitions + category_attributes for filters (iPon spec mapping)

INSERT INTO public.attributes (name, slug, is_seo_filter)
VALUES
  ('Boxed', 'boxed', false),
  ('CPU family', 'cpu_family', false),
  ('Integrated VGA', 'integrated_vga', false),
  ('Integrated VGA (chip)', 'integrated_vga_chip', false),
  ('TDP', 'tdp', false),
  ('Clock speed', 'clock_speed', false),
  ('Turbo frequency', 'turbo_frequency', false)
ON CONFLICT (slug) DO NOTHING;

-- Socket već postoji kao slug 'socket' — samo veži za kategoriju ispod

INSERT INTO public.category_attributes (category_id, attribute_id)
SELECT c.id, a.id
FROM public.categories c
CROSS JOIN public.attributes a
WHERE c.slug = 'procesori'
  AND a.slug IN (
    'boxed',
    'cpu_family',
    'socket',
    'integrated_vga',
    'integrated_vga_chip',
    'tdp',
    'clock_speed',
    'turbo_frequency'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.category_attributes ca
    WHERE ca.category_id = c.id AND ca.attribute_id = a.id
  );
