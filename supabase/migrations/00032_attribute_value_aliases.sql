-- Manual alias → canonical label maps for product attribute filter values.
-- Only explicit rows here are applied; unknown raw values pass through unchanged.

CREATE TABLE IF NOT EXISTS public.attribute_value_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id uuid NOT NULL REFERENCES public.attributes(id) ON DELETE CASCADE,
  alias text NOT NULL,
  canonical_label text NOT NULL,
  match_mode text NOT NULL DEFAULT 'exact',
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attribute_value_aliases_match_mode_check
    CHECK (match_mode IN ('exact', 'contains', 'regex'))
);

CREATE INDEX IF NOT EXISTS idx_attribute_value_aliases_attribute
  ON public.attribute_value_aliases (attribute_id, is_active);

CREATE INDEX IF NOT EXISTS idx_attribute_value_aliases_lookup
  ON public.attribute_value_aliases (attribute_id, lower(alias));

CREATE UNIQUE INDEX IF NOT EXISTS idx_attribute_value_aliases_unique_alias
  ON public.attribute_value_aliases (
    attribute_id,
    lower(trim(alias)),
    COALESCE(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

ALTER TABLE public.attribute_value_aliases ENABLE ROW LEVEL SECURITY;

INSERT INTO public.job_schedules (job_type, is_paused)
VALUES ('apply_value_aliases', false)
ON CONFLICT (job_type) DO NOTHING;
