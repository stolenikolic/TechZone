-- Subcategories under Foto, video i dronovi.
-- Idempotent: safe to re-run. image_url left null.
-- Parent looked up by slug (not hardcoded UUID) so it works across environments.

INSERT INTO public.categories (name, slug, parent_id, image_url)
SELECT v.name, v.slug, p.id, NULL
FROM (VALUES
  ('Digitalni fotoaparati', 'digitalni-fotoaparati'),
  ('Action kamere', 'action-kamere'),
  ('Video kamere', 'video-kamere'),
  ('Foto i video pribor', 'foto-i-video-pribor'),
  ('Foto futrole i torbe', 'foto-futrole-i-torbe'),
  ('Gimbalovi i stabilizatori', 'gimbalovi-i-stabilizatori'),
  ('Digitalni okviri za slike', 'digitalni-okviri-za-slike'),
  ('Dronovi', 'dronovi'),
  ('Pribor za dronove', 'pribor-za-dronove')
) AS v(name, slug)
JOIN public.categories p ON p.slug = 'foto-video-dronovi' AND p.parent_id IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c WHERE c.slug = v.slug
);
