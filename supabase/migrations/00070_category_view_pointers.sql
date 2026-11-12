-- A category row can point at another category plus one attribute filter.
-- Products stay on the source category. Deleting the source clears the pointer.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS view_source_category_id uuid REFERENCES public.categories (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS view_filter_attribute_slug text,
  ADD COLUMN IF NOT EXISTS view_filter_value text;

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_view_pointer_complete;

ALTER TABLE public.categories
  ADD CONSTRAINT categories_view_pointer_complete
  CHECK (
    (
      view_source_category_id IS NULL
      AND view_filter_attribute_slug IS NULL
      AND view_filter_value IS NULL
    )
    OR (
      view_source_category_id IS NOT NULL
      AND view_source_category_id <> id
      AND view_filter_attribute_slug IS NOT NULL
      AND btrim(view_filter_attribute_slug) <> ''
      AND view_filter_value IS NOT NULL
      AND btrim(view_filter_value) <> ''
    )
  );

CREATE INDEX IF NOT EXISTS categories_view_source_category_id_idx
  ON public.categories (view_source_category_id)
  WHERE view_source_category_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.clear_category_view_pointers()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.categories
  SET
    view_source_category_id = NULL,
    view_filter_attribute_slug = NULL,
    view_filter_value = NULL
  WHERE view_source_category_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS categories_clear_view_pointers ON public.categories;

CREATE TRIGGER categories_clear_view_pointers
  BEFORE DELETE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_category_view_pointers();

CREATE OR REPLACE FUNCTION public.enforce_category_view_pointer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.view_source_category_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.categories WHERE parent_id = NEW.id) THEN
    RAISE EXCEPTION 'pointer category cannot have children';
  END IF;

  IF NEW.parent_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.categories
       WHERE id = NEW.parent_id
         AND view_source_category_id IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'pointer category cannot have children';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS categories_enforce_view_pointer ON public.categories;

CREATE TRIGGER categories_enforce_view_pointer
  BEFORE INSERT OR UPDATE OF view_source_category_id, parent_id
  ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_category_view_pointer();
