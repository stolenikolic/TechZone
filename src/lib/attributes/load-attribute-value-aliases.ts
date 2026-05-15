import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapAttributeValueAliasRow,
  type AttributeValueAliasDbRow,
  type AttributeValueAliasRow
} from "lib/attributes/attribute-value-alias";

export async function loadAttributeValueAliases(
  supabase: SupabaseClient,
  attributeIds: string[]
): Promise<Map<string, AttributeValueAliasRow[]>> {
  const byAttribute = new Map<string, AttributeValueAliasRow[]>();
  if (attributeIds.length === 0) return byAttribute;

  const uniqueIds = Array.from(new Set(attributeIds));
  const { data, error } = await supabase
    .from("attribute_value_aliases")
    .select("id, attribute_id, alias, canonical_label, match_mode, supplier_id, priority, is_active")
    .in("attribute_id", uniqueIds)
    .eq("is_active", true);

  if (error) throw new Error(`loadAttributeValueAliases: ${error.message}`);

  for (const row of (data ?? []) as AttributeValueAliasDbRow[]) {
    const mapped = mapAttributeValueAliasRow(row);
    const list = byAttribute.get(mapped.attributeId) ?? [];
    list.push(mapped);
    byAttribute.set(mapped.attributeId, list);
  }

  return byAttribute;
}
