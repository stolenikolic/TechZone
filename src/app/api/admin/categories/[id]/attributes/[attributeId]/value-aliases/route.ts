import { NextResponse } from "next/server";
import { mapAttributeValueAliasRow, type AttributeValueAliasDbRow } from "lib/attributes/attribute-value-alias";
import { assertAttributeOnCategory } from "lib/attributes/category-attribute-guard";
import { revalidateCategorySurfaces } from "lib/revalidate-categories";
import { createSupabaseServiceClient } from "utils/supabase";

export const dynamic = "force-dynamic";

const PRODUCT_CHUNK = 100;

async function collectCategorySubtreeIds(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  rootId: string
): Promise<string[]> {
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

async function countProductsWithValue(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  categoryIds: string[],
  attributeId: string,
  value: string
): Promise<number> {
  const { data: products } = await supabase
    .from("products")
    .select("id")
    .in("category_id", categoryIds)
    .eq("is_active", true);
  const productIds = (products ?? []).map((r) => r.id as string);
  if (productIds.length === 0) return 0;

  let count = 0;
  const want = value.trim().toLowerCase();
  for (let i = 0; i < productIds.length; i += PRODUCT_CHUNK) {
    const chunk = productIds.slice(i, i + PRODUCT_CHUNK);
    const { data: paRows } = await supabase
      .from("product_attributes")
      .select("value")
      .eq("attribute_id", attributeId)
      .in("product_id", chunk);
    for (const row of paRows ?? []) {
      if (row.value != null && String(row.value).trim().toLowerCase() === want) count += 1;
    }
  }
  return count;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; attributeId: string }> }
) {
  try {
    const { id: categoryId, attributeId } = await context.params;
    const supabase = createSupabaseServiceClient();
    if (!(await assertAttributeOnCategory(supabase, categoryId, attributeId))) {
      return NextResponse.json({ error: "Attribute not attached to category." }, { status: 404 });
    }

    const { data: rows, error } = await supabase
      .from("attribute_value_aliases")
      .select("id, attribute_id, alias, canonical_label, match_mode, supplier_id, priority, is_active")
      .eq("attribute_id", attributeId)
      .order("canonical_label", { ascending: true })
      .order("priority", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const categoryIds = await collectCategorySubtreeIds(supabase, categoryId);
    const mapped = ((rows ?? []) as AttributeValueAliasDbRow[]).map(mapAttributeValueAliasRow);

    const canonicalLabels = Array.from(new Set(mapped.map((r) => r.canonicalLabel)));
    const productCountByCanonical = new Map<string, number>();
    for (const label of canonicalLabels) {
      productCountByCanonical.set(
        label,
        await countProductsWithValue(supabase, categoryIds, attributeId, label)
      );
    }

    const groups = canonicalLabels.map((canonicalLabel) => ({
      canonicalLabel,
      productCount: productCountByCanonical.get(canonicalLabel) ?? 0,
      aliases: mapped
        .filter((r) => r.canonicalLabel === canonicalLabel)
        .map((r) => ({
          id: r.id,
          alias: r.alias,
          matchMode: r.matchMode,
          supplierId: r.supplierId,
          priority: r.priority,
          isActive: r.isActive
        }))
    }));

    const aliasKeys = new Set(
      mapped.map((r) => `${r.alias.trim().toLowerCase()}|${r.supplierId ?? ""}`)
    );
    const aliasCanonicalByKey = new Map(
      mapped.map((r) => [`${r.alias.trim().toLowerCase()}|${r.supplierId ?? ""}`, r.canonicalLabel])
    );

    const valueCounts = new Map<string, number>();
    const { data: products } = await supabase
      .from("products")
      .select("id")
      .in("category_id", categoryIds)
      .eq("is_active", true);
    const productIds = (products ?? []).map((r) => r.id as string);

    for (let i = 0; i < productIds.length; i += PRODUCT_CHUNK) {
      const chunk = productIds.slice(i, i + PRODUCT_CHUNK);
      const { data: paRows } = await supabase
        .from("product_attributes")
        .select("value")
        .eq("attribute_id", attributeId)
        .in("product_id", chunk);
      for (const row of paRows ?? []) {
        if (row.value == null || String(row.value).trim() === "") continue;
        const v = String(row.value).trim();
        valueCounts.set(v, (valueCounts.get(v) ?? 0) + 1);
      }
    }

    const catalogValues = Array.from(valueCounts.entries())
      .map(([value, productCount]) => {
        const key = `${value.toLowerCase()}|`;
        const mappedTo = aliasKeys.has(key) ? aliasCanonicalByKey.get(key) : null;
        return { value, productCount, mappedTo };
      })
      .sort((a, b) => a.value.localeCompare(b.value));

    return NextResponse.json({ groups, catalogValues });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type PostBody = {
  alias?: string;
  canonicalLabel?: string;
  matchMode?: "exact" | "contains" | "regex";
  supplierId?: string | null;
  priority?: number;
};

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; attributeId: string }> }
) {
  try {
    const { id: categoryId, attributeId } = await context.params;
    const body = (await request.json()) as PostBody;
    const alias = body.alias?.trim() ?? "";
    const canonicalLabel = body.canonicalLabel?.trim() ?? "";
    if (!alias || !canonicalLabel) {
      return NextResponse.json({ error: "alias and canonicalLabel are required." }, { status: 400 });
    }
    const matchMode = body.matchMode ?? "exact";
    if (!["exact", "contains", "regex"].includes(matchMode)) {
      return NextResponse.json({ error: "Invalid matchMode." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    if (!(await assertAttributeOnCategory(supabase, categoryId, attributeId))) {
      return NextResponse.json({ error: "Attribute not attached to category." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("attribute_value_aliases")
      .insert({
        attribute_id: attributeId,
        alias,
        canonical_label: canonicalLabel,
        match_mode: matchMode,
        supplier_id: body.supplierId?.trim() || null,
        priority: body.priority ?? 100,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const { data: category } = await supabase
      .from("categories")
      .select("slug")
      .eq("id", categoryId)
      .maybeSingle();
    revalidateCategorySurfaces(category?.slug ?? null);

    return NextResponse.json({ success: true, id: data?.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
