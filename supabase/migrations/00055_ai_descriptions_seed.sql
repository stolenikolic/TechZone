-- Seed: Bosnian attribute labels (name_bs) and pilot AI description config for procesori.

UPDATE public.attributes SET name_bs = 'Kapacitet' WHERE slug = 'capacity' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Buffer' WHERE slug = 'buffer' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Veličina diska' WHERE slug = 'size_inch' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Broj okretaja' WHERE slug = 'rpm' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Socket / podnožje' WHERE slug = 'socket' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Boxed verzija' WHERE slug = 'boxed' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'CPU porodica' WHERE slug = 'cpu_family' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Integrisana grafika' WHERE slug = 'integrated_vga' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Grafički čip' WHERE slug = 'integrated_vga_chip' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'TDP' WHERE slug = 'tdp' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Radni takt' WHERE slug = 'clock_speed' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Turbo frekvencija' WHERE slug = 'turbo_frequency' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Čipset' WHERE slug = 'chipset' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Tip memorije' WHERE slug = 'memory_type' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Slotovi memorije' WHERE slug = 'memory_sockets' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'M.2 konektori' WHERE slug = 'm2_connectors' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Format' WHERE slug = 'size' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Interfejs' WHERE slug = 'connection' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'PCIe generacija' WHERE slug = 'pcie_generation' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Brzina čitanja' WHERE slug = 'read_speed' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Brzina pisanja' WHERE slug = 'write_speed' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Heatsink' WHERE slug = 'heatsink' AND name_bs IS NULL;
UPDATE public.attributes SET name_bs = 'Boja' WHERE slug = 'color' AND name_bs IS NULL;

-- Fallback: use English name when no Bosnian label defined
UPDATE public.attributes SET name_bs = name WHERE name_bs IS NULL;

-- Pilot: procesori category — enable 7 key attributes for AI descriptions
UPDATE public.category_attributes ca
SET
  include_in_ai_description = true,
  ai_description_priority = v.priority
FROM (
  VALUES
    ('cpu_family', 10),
    ('socket', 20),
    ('clock_speed', 30),
    ('turbo_frequency', 40),
    ('tdp', 50),
    ('integrated_vga', 60),
    ('boxed', 70)
) AS v(slug, priority)
JOIN public.attributes a ON a.slug = v.slug
JOIN public.categories c ON c.slug = 'procesori'
WHERE ca.category_id = c.id AND ca.attribute_id = a.id;

INSERT INTO public.category_ai_description_config (category_id, tone, audience, extra_instructions, is_enabled)
SELECT
  c.id,
  'profesionalan, prirodan',
  'entuzijasti i korisnici koji grade ili nadograđuju računar',
  'Naglasiti praktičnu korist za gaming, rad ili svakodnevnu upotrebu. Spomeni kompatibilnost sa socketom samo ako je u specifikacijama. Prirodno uključi riječ Bosna ili BiH jednom ako ima smisla.',
  true
FROM public.categories c
WHERE c.slug = 'procesori'
ON CONFLICT (category_id) DO UPDATE SET
  audience = EXCLUDED.audience,
  extra_instructions = EXCLUDED.extra_instructions,
  updated_at = now();
