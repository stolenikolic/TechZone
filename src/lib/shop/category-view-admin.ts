import type { SupabaseClient } from "@supabase/supabase-js";

export type CategoryViewColumns = {
  view_source_category_id: string | null;
  view_filter_attribute_slug: string | null;
  view_filter_value: string | null;
};

export type CategoryViewInput = {
  sourceId: string | null;
  attributeSlug: string | null;
  value: string | null;
};

function textField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

export function readCategoryViewInput(
  body: object
): { present: false } | { present: true; input: CategoryViewInput } {
  const record = body as Record<string, unknown>;
  if (
    !("viewSourceCategoryId" in record) &&
    !("viewFilterAttributeSlug" in record) &&
    !("viewFilterValue" in record)
  ) {
    return { present: false };
  }

  return {
    present: true,
    input: {
      sourceId: textField(record, "viewSourceCategoryId") || null,
      attributeSlug: textField(record, "viewFilterAttributeSlug") || null,
      value: textField(record, "viewFilterValue") || null
    }
  };
}

function attributeSlugs(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  const slugs: string[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const raw = (row as { attributes?: unknown }).attributes;
    const attribute = Array.isArray(raw) ? raw[0] : raw;
    if (
      attribute &&
      typeof attribute === "object" &&
      typeof (attribute as { slug?: unknown }).slug === "string"
    ) {
      slugs.push((attribute as { slug: string }).slug);
    }
  }
  return slugs;
}

export async function categoryParentChildError(
  supabase: SupabaseClient,
  parentId: string | null
): Promise<string | null> {
  if (!parentId) return null;
  const { data, error } = await supabase
    .from("categories")
    .select("view_source_category_id")
    .eq("id", parentId)
    .maybeSingle();
  if (error) return error.message;
  if (data?.view_source_category_id) return "Pokazivač ne može imati djecu.";
  return null;
}

export async function resolveCategoryViewWrite(
  supabase: SupabaseClient,
  categoryId: string | null,
  input: CategoryViewInput
): Promise<{ ok: true; columns: CategoryViewColumns } | { ok: false; error: string }> {
  const filled = [input.sourceId, input.attributeSlug, input.value].filter(Boolean).length;
  if (filled === 0) {
    return {
      ok: true,
      columns: {
        view_source_category_id: null,
        view_filter_attribute_slug: null,
        view_filter_value: null
      }
    };
  }

  if (!input.sourceId || !input.attributeSlug || !input.value) {
    return {
      ok: false,
      error: "Pokazivač traži izvornu kategoriju, slug atributa i tačnu vrijednost."
    };
  }

  if (categoryId && input.sourceId === categoryId) {
    return { ok: false, error: "Izvor ne smije biti sama kategorija." };
  }

  const { data: source, error: sourceError } = await supabase
    .from("categories")
    .select("id, view_source_category_id")
    .eq("id", input.sourceId)
    .maybeSingle();
  if (sourceError) return { ok: false, error: sourceError.message };
  if (!source) return { ok: false, error: "Izvorna kategorija ne postoji." };
  if (source.view_source_category_id) {
    return { ok: false, error: "Izvor ne smije biti pokazivač." };
  }

  if (categoryId) {
    const { data: children, error: childError } = await supabase
      .from("categories")
      .select("id")
      .eq("parent_id", categoryId)
      .limit(1);
    if (childError) return { ok: false, error: childError.message };
    if (children && children.length > 0) {
      return { ok: false, error: "Kategorija koja ima djecu ne može biti pokazivač." };
    }
  }

  const { data: links, error: attrError } = await supabase
    .from("category_attributes")
    .select("attributes(slug)")
    .eq("category_id", input.sourceId);
  if (attrError) return { ok: false, error: attrError.message };

  const canonical = attributeSlugs(links).find(
    (slug) => slug.toLowerCase() === input.attributeSlug!.toLowerCase()
  );
  if (!canonical) {
    return { ok: false, error: "Atribut nije vezan za izvornu kategoriju." };
  }

  return {
    ok: true,
    columns: {
      view_source_category_id: input.sourceId,
      view_filter_attribute_slug: canonical,
      view_filter_value: input.value
    }
  };
}
