-- Add SSD category under Računarske komponente (same parent as Hard Diskovi).
-- image_url left null per requirements.
INSERT INTO public.categories (name, slug, parent_id, image_url)
SELECT 'SSD', 'ssd', '0915ef81-02db-4df4-9752-9d5c1b72be97', NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories
  WHERE slug = 'ssd' AND parent_id = '0915ef81-02db-4df4-9752-9d5c1b72be97'
);
