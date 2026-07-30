-- Subcategories under Telefoni, tableti i pametni uređaji.
-- Idempotent: safe to re-run. image_url left null.
-- Parent looked up by slug (not hardcoded UUID) so it works across environments.

INSERT INTO public.categories (name, slug, parent_id, image_url)
SELECT v.name, v.slug, p.id, NULL
FROM (VALUES
  ('Mobilni telefoni', 'mobilni-telefoni'),
  ('Klasični telefoni', 'klasicni-telefoni'),
  ('Tableti', 'tableti'),
  ('Pametni satovi i narukvice', 'pametni-satovi-i-narukvice'),
  ('Punjači za telefone i tablete', 'punjaci-za-telefone-i-tablete'),
  ('Powerbank', 'powerbank'),
  ('Pametni asistenti', 'pametni-asistenti')
) AS v(name, slug)
JOIN public.categories p ON p.slug = 'telefoni-tableti-pametni-uredjaji' AND p.parent_id IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c WHERE c.slug = v.slug
);
