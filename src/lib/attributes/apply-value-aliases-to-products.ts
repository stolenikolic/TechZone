/**
 * Backfill: UPDATE product_attributes where value matches a manual alias → canonical_label.
 * Does not change values that have no matching alias row.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { mapAttributeValueAliasRow, type AttributeValueAliasDbRow } from "lib/attributes/attribute-value-alias";

const PRODUCT_CHUNK = 100;

export type ApplyValueAliasesResult = {
  success: boolean;
  productsUpdated: number;
  rowsUpdated: number;
  errors: number;
};

async function collectCategorySubtreeIds(supabase: SupabaseClient, rootId: string): Promise<string[]> {
  const out = new Set<string>([rootId]);
  let frontier: string[] = [rootId];
  for (let depth = 0; depth < 32 && frontier.length > 0; depth++) {
    const { data, error } = await supabase.from("categories").select("id").in("parent_id", frontier);
    if (error) throw new Error(error.message);
    const next: string[] = [];
    for (const r of data ?? []) {
      const id = (r as { id: string }).id;
      if (!out.has(id)) {
        out.add(id);
        next.push(id);
      }
    }
    frontier = next;
  }
  return Array.from(out);
}

export type ApplyValueAliasesOptions = {
  categoryId: string;
  attributeId?: string;
  dryRun?: boolean;
};

export async function applyValueAliasesToProducts(
  supabase: SupabaseClient,
  options: ApplyValueAliasesOptions
): Promise<ApplyValueAliasesResult> {
  const { categoryId, attributeId, dryRun = false } = options;
  const categoryIds = await collectCategorySubtreeIds(supabase, categoryId);

  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id")
    .in("category_id", categoryIds)
    .eq("is_active", true);
  if (prodErr) throw new Error(prodErr.message);

  const productIds = (products ?? []).map((r) => r.id as string);
  if (productIds.length === 0) {
    return { success: true, productsUpdated: 0, rowsUpdated: 0, errors: 0 };
  }

  let aliasQuery = supabase
    .from("attribute_value_aliases")
    .select("id, attribute_id, alias, canonical_label, match_mode, supplier_id, priority, is_active")
    .eq("is_active", true)
    .eq("match_mode", "exact");

  if (attributeId) aliasQuery = aliasQuery.eq("attribute_id", attributeId);

  const { data: aliasRows, error: aliasErr } = await aliasQuery;
  if (aliasErr) throw new Error(aliasErr.message);

  const aliases = ((aliasRows ?? []) as AttributeValueAliasDbRow[]).map(mapAttributeValueAliasRow);
  if (aliases.length === 0) {
    return { success: true, productsUpdated: 0, rowsUpdated: 0, errors: 0 };
  }

  const aliasesByAttribute = new Map<string, typeof aliases>();
  for (const row of aliases) {
    const list = aliasesByAttribute.get(row.attributeId) ?? [];
    list.push(row);
    aliasesByAttribute.set(row.attributeId, list);
  }

  const slugByAttributeId = new Map<string, string>();
  const { data: attrRows } = await supabase
    .from("attributes")
    .select("id, slug")
    .in("id", Array.from(aliasesByAttribute.keys()));
  for (const r of attrRows ?? []) {
    if (r.slug) slugByAttributeId.set(r.id as string, r.slug as string);
  }

  let rowsUpdated = 0;
  let errors = 0;
  const touchedProducts = new Set<string>();

  for (let i = 0; i < productIds.length; i += PRODUCT_CHUNK) {
    const chunk = productIds.slice(i, i + PRODUCT_CHUNK);
    const attributeIds = Array.from(aliasesByAttribute.keys());

    const { data: paRows, error: paErr } = await supabase
      .from("product_attributes")
      .select("product_id, attribute_id, value")
      .in("product_id", chunk)
      .in("attribute_id", attributeIds);

    if (paErr) {
      errors += 1;
      continue;
    }

    for (const pa of paRows ?? []) {
      const attrId = pa.attribute_id as string;
      const current = pa.value == null ? "" : String(pa.value).trim();
      if (!current) continue;

      const attrAliases = aliasesByAttribute.get(attrId) ?? [];
      for (const aliasRow of attrAliases) {
        if (current.toLowerCase() !== aliasRow.alias.trim().toLowerCase()) continue;
        const canonical = aliasRow.canonicalLabel.trim();
        if (!canonical || canonical === current) continue;

        if (!dryRun) {
          const { error: updErr } = await supabase
            .from("product_attributes")
            .update({ value: canonical })
            .eq("product_id", pa.product_id)
            .eq("attribute_id", attrId);
          if (updErr) {
            errors += 1;
            break;
          }

          const slug = slugByAttributeId.get(attrId);
          if (slug) {
            const { data: productRow } = await supabase
              .from("products")
              .select("attributes")
              .eq("id", pa.product_id)
              .maybeSingle();
            if (productRow?.attributes && typeof productRow.attributes === "object") {
              const prev = productRow.attributes as Record<string, unknown>;
              if (typeof prev[slug] === "string" && prev[slug] === current) {
                await supabase
                  .from("products")
                  .update({
                    attributes: { ...prev, [slug]: canonical },
                    updated_at: new Date().toISOString()
                  })
                  .eq("id", pa.product_id);
              }
            }
          }
        }

        rowsUpdated += 1;
        touchedProducts.add(pa.product_id as string);
        break;
      }
    }
  }

  return {
    success: errors === 0,
    productsUpdated: touchedProducts.size,
    rowsUpdated,
    errors
  };
}
