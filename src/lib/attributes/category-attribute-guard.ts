import type { SupabaseClient } from "@supabase/supabase-js";

/** Ensures attribute is attached to category (for admin value-alias routes). */
export async function assertAttributeOnCategory(
  supabase: SupabaseClient,
  categoryId: string,
  attributeId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("category_attributes")
    .select("attribute_id")
    .eq("category_id", categoryId)
    .eq("attribute_id", attributeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}
