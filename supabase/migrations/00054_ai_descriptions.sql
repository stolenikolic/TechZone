-- AI product descriptions: schema for prompt config, generation tracking, and job schedule.

ALTER TABLE public.category_attributes
  ADD COLUMN IF NOT EXISTS include_in_ai_description boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_description_priority integer NOT NULL DEFAULT 100;

ALTER TABLE public.attributes
  ADD COLUMN IF NOT EXISTS name_bs text;

COMMENT ON COLUMN public.attributes.name_bs IS
  'Bosnian label for attribute used in AI description prompts (ijekavica).';

CREATE TABLE IF NOT EXISTS public.category_ai_description_config (
  category_id uuid PRIMARY KEY REFERENCES public.categories(id) ON DELETE CASCADE,
  tone text DEFAULT 'profesionalan, prirodan',
  audience text,
  extra_instructions text,
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.category_ai_description_config IS
  'Per-category AI description prompt settings (tone, audience, extra instructions).';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ai_meta_description text,
  ADD COLUMN IF NOT EXISTS ai_title_suggestion text,
  ADD COLUMN IF NOT EXISTS ai_og_description text,
  ADD COLUMN IF NOT EXISTS ai_faq jsonb,
  ADD COLUMN IF NOT EXISTS ai_description_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ai_description_input_hash text,
  ADD COLUMN IF NOT EXISTS ai_description_model text,
  ADD COLUMN IF NOT EXISTS ai_description_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_description_locked boolean NOT NULL DEFAULT false;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_ai_description_status_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_ai_description_status_check
  CHECK (ai_description_status IN ('pending', 'generated', 'approved', 'weak', 'manual'));

COMMENT ON COLUMN public.products.ai_description_status IS
  'pending | generated | approved | weak | manual — AI description workflow state.';

COMMENT ON COLUMN public.products.ai_description_locked IS
  'When true, AI description job will not overwrite description or related fields.';

CREATE INDEX IF NOT EXISTS idx_products_ai_status
  ON public.products (ai_description_status);

CREATE INDEX IF NOT EXISTS idx_products_ai_hash
  ON public.products (ai_description_input_hash)
  WHERE ai_description_input_hash IS NOT NULL;

INSERT INTO public.job_schedules (job_type, is_paused)
VALUES ('ai_descriptions', false)
ON CONFLICT (job_type) DO NOTHING;
