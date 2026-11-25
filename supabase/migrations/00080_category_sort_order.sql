-- Sibling menu order. Lower sort_order appears first among the same parent.
-- Ties fall back to name in the application. Duplicate numbers are allowed.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_categories_parent_sort
  ON public.categories (parent_id, sort_order);

UPDATE public.categories AS c
SET sort_order = v.sort_order
FROM (
  VALUES
    ('racunari', 10),
    ('racunarske-komponente', 20),
    ('racunarska-periferija', 30),
    ('telefoni-tableti-pametni-uredjaji', 40),
    ('televizori-projektori-vr', 50),
    ('konzole-i-gaming', 60),
    ('audio-i-multimedija', 70),
    ('foto-video-dronovi', 80),
    ('mreza-serveri-sigurnost', 90),
    ('racunarski-dodaci-softver', 100),

    ('laptopi', 10),
    ('gaming-laptopi', 20),
    ('desktop-racunari', 30),
    ('tower-racunari', 40),
    ('all-in-one-racunari', 50),
    ('kompaktni-racunari', 60),
    ('mini-racunari', 70),
    ('landscape-racunari', 80),
    ('barebone-sistemi', 90),
    ('torbe-za-laptop', 100),
    ('pribor-za-laptop', 110),
    ('pos-terminali', 120),

    ('procesori', 10),
    ('maticne-ploce', 20),
    ('ram', 30),
    ('graficke-kartice', 40),
    ('ssd', 50),
    ('hard-diskovi', 60),
    ('kucista', 70),
    ('napajanja', 80),
    ('vodena-hladjenja', 90),
    ('vazudsna-hladjenja', 100),
    ('ventilatori-za-kucista', 110),
    ('termalne-paste', 120),
    ('eksterni-ssd', 130),
    ('eksterni-hard-diskovi', 140),
    ('zvucne-kartice', 150),
    ('io-kartice', 160),
    ('opticki-uredjaji', 170),
    ('dodaci-za-vodena-hladjenja', 180),
    ('dodaci-za-vazdusna-hladjenja', 190),

    ('monitori', 10),
    ('tastature', 20),
    ('misevi', 30),
    ('slusalice', 40),
    ('zvucnici', 50),
    ('set-mis-tastatura', 60),
    ('podloge-za-mis', 70),
    ('stampaci', 80),
    ('skeneri', 90),
    ('gaming-stolice', 100),
    ('gaming-stolovi', 110),
    ('digitalne-table', 120),
    ('dodaci-za-tastature', 130),
    ('dodaci-za-miseve', 140),

    ('mobilni-telefoni', 10),
    ('tableti', 20),
    ('pametni-satovi-i-narukvice', 30),
    ('e-citaci', 40),
    ('klasicni-telefoni', 50),
    ('punjaci-za-telefone-i-tablete', 60),
    ('powerbank', 70),
    ('pribor-za-e-citace', 80),
    ('pametni-asistenti', 90),

    ('televizori', 10),
    ('projektori', 20),
    ('platna-za-projektore', 30),
    ('profesionalni-displeji', 40),
    ('virtuelna-realnost', 50),
    ('multimedijalni-plejeri', 60),
    ('set-top-box', 70),
    ('audio-video-ekstenderi', 80),
    ('dodaci-za-projektore', 90),
    ('dodaci-za-virtuelnu-realnost', 100),

    ('gaming-konzole', 10),
    ('igre', 20),
    ('gaming-kontroleri', 30),
    ('volani-i-simulator-oprema', 40),
    ('joystick-i-flight-kontroleri', 50),
    ('memorija-i-diskovi', 60),
    ('punjaci-baterije-i-napajanja', 70),
    ('futrole-i-zastita', 80),
    ('drzaci-za-kontrolere', 90),
    ('kablovi-i-adapteri', 100),
    ('ostala-gaming-oprema', 110),

    ('bluetooth-zvucnici', 10),
    ('hi-fi-sistemi', 20),
    ('audio-pojacala', 30),
    ('audio-miksete', 40),
    ('dac-i-audio-konverteri', 50),
    ('radio-uredjaji', 60),
    ('blu-ray-i-dvd-plejeri', 70),
    ('mp3-plejeri', 80),

    ('digitalni-fotoaparati', 10),
    ('action-kamere', 20),
    ('video-kamere', 30),
    ('dronovi', 40),
    ('gimbalovi-i-stabilizatori', 50),
    ('foto-i-video-pribor', 60),
    ('foto-futrole-i-torbe', 70),
    ('pribor-za-dronove', 80),
    ('digitalni-okviri-za-slike', 90),

    ('ruteri', 10),
    ('mesh-sistemi', 20),
    ('access-point', 30),
    ('range-extenderi', 40),
    ('repetitori', 50),
    ('mobilni-modemi', 60),
    ('powerline-adapteri', 70),
    ('switchevi', 80),
    ('poe-oprema', 90),
    ('nadzorne-kamere', 100),
    ('sigurnosni-sistemi', 110),
    ('firewall-uredjaji', 120),
    ('nas-uredjaji', 130),
    ('serveri', 140),
    ('serverske-komponente', 150),
    ('serverski-ssd-diskovi', 160),
    ('serverski-hard-diskovi', 170),
    ('usb-adapteri', 180),
    ('pci-pcie-m2-mrezne-kartice', 190),
    ('pci-express-kartice', 200),
    ('pci-kartice', 210),
    ('transceiveri', 220),
    ('mrezni-media-konverteri', 230),
    ('gateway-uredjaji', 240),
    ('antene', 250),
    ('mrezni-dodaci', 260),

    ('dodaci', 10)
) AS v(slug, sort_order)
WHERE c.slug = v.slug;

-- Anything left at 0 was not in the seed. Place it at the end of its sibling group.
WITH leftovers AS (
  SELECT
    id,
    parent_id,
    ROW_NUMBER() OVER (PARTITION BY parent_id ORDER BY name) AS rn
  FROM public.categories
  WHERE sort_order = 0
),
bases AS (
  SELECT parent_id, MAX(sort_order) AS base
  FROM public.categories
  WHERE sort_order <> 0
  GROUP BY parent_id
)
UPDATE public.categories AS c
SET sort_order = COALESCE(b.base, 0) + l.rn * 10
FROM leftovers AS l
LEFT JOIN bases AS b ON b.parent_id IS NOT DISTINCT FROM l.parent_id
WHERE c.id = l.id;
