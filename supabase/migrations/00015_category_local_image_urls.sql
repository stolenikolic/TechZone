-- Use local optimized category photos for storefront category cards.
UPDATE public.categories
SET image_url = CASE slug
  WHEN 'racunarske-komponente' THEN '/assets/images/categories/racunarske-komponente.webp'
  WHEN 'graficke-kartice' THEN '/assets/images/categories/graficke-kartice.webp'
  WHEN 'hard-diskovi' THEN '/assets/images/categories/hard-diskovi.webp'
  WHEN 'maticne-ploce' THEN '/assets/images/categories/maticne-ploce.webp'
  WHEN 'procesori' THEN '/assets/images/categories/procesori.webp'
  WHEN 'ssd' THEN '/assets/images/categories/ssd.webp'
  ELSE image_url
END
WHERE slug IN (
  'racunarske-komponente',
  'graficke-kartice',
  'hard-diskovi',
  'maticne-ploce',
  'procesori',
  'ssd'
);
