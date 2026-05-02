-- Metadata that controls how product attributes are rendered in category filters.
ALTER TABLE public.attributes
ADD COLUMN IF NOT EXISTS filter_display_type text NOT NULL DEFAULT 'checkbox',
ADD COLUMN IF NOT EXISTS filter_unit text,
ADD COLUMN IF NOT EXISTS filter_step numeric;

ALTER TABLE public.attributes
ADD CONSTRAINT attributes_filter_display_type_check
CHECK (filter_display_type IN ('checkbox', 'range'))
NOT VALID;

UPDATE public.attributes
SET
  filter_display_type = 'range',
  filter_unit = 'pcs',
  filter_step = 1
WHERE slug = 'm2_connectors';
