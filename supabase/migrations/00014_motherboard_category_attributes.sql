-- Motherboards (Matične ploče): attribute definitions + category_attributes for iPon spec mapping.

INSERT INTO public.attributes (name, slug, is_seo_filter)
VALUES
  ('Chipset', 'chipset', false),
  ('Memory type', 'memory_type', false),
  ('Memory sockets', 'memory_sockets', false),
  ('M.2 connectors', 'm2_connectors', false)
ON CONFLICT (slug) DO NOTHING;

-- Socket already exists as slug 'socket' from the shared component attributes.

INSERT INTO public.category_attributes (category_id, attribute_id)
SELECT c.id, a.id
FROM public.categories c
CROSS JOIN public.attributes a
WHERE c.id = 'bc6b63f8-ac4e-44cc-82e6-030cebee187d'
  AND a.slug IN (
    'socket',
    'chipset',
    'memory_type',
    'memory_sockets',
    'm2_connectors'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.category_attributes ca
    WHERE ca.category_id = c.id AND ca.attribute_id = a.id
  );
