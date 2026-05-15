import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "utils/supabase";

export const dynamic = "force-dynamic";

const PRODUCT_ID_CHUNK = 200;

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

function specCellToString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.value === "string") return o.value.trim();
    if (typeof o.value === "number" && Number.isFinite(o.value)) return String(o.value);
  }
  return "";
}

/**
 * GET /api/admin/categories/[id]/spec-fields?supplierId=<uuid>
 *
 * Returns unique field names from spec_snapshot.specs for all supplier_products
 * linked to products in this category **or any of its subcategories**, with a
 * non-null spec_snapshot for the given supplier.
 * Also returns existing mappings for this supplier + category subtree (scoped + global).
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: categoryId } = await context.params;
    const url = new URL(request.url);
    const supplierId = url.searchParams.get("supplierId")?.trim();
    if (!supplierId) {
      return NextResponse.json({ error: "supplierId query param is required" }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const categoryIds = await collectCategorySubtreeIds(supabase, categoryId);
    const categoryIdSet = new Set(categoryIds);

    const { data: mappingRows, error: mappingErr } = await supabase
      .from("supplier_attribute_mappings")
      .select("id, attribute_id, source_field_name, match_mode, priority, internal_category_id, attributes(name, slug)")
      .eq("supplier_id", supplierId)
      .eq("is_active", true)
      .order("priority", { ascending: true });

    if (mappingErr) return NextResponse.json({ error: mappingErr.message }, { status: 400 });

    type MappingLookupEntry = {
      id: string;
      attributeId: string;
      attributeName: string;
      attributeSlug: string;
      matchMode: string;
      priority: number;
      internalCategoryId: string | null;
    };
    const filteredMappings = (mappingRows ?? []).filter((m) => {
      const row = m as { internal_category_id: string | null };
      return row.internal_category_id == null || categoryIdSet.has(row.internal_category_id);
    }) as Array<{
      id: string;
      attribute_id: string;
      source_field_name: string;
      match_mode: string;
      priority: number;
      internal_category_id: string | null;
      attributes: { name: string; slug: string } | { name: string; slug: string }[] | null;
    }>;

    filteredMappings.sort((a, b) => {
      const aGlobal = a.internal_category_id == null ? 0 : 1;
      const bGlobal = b.internal_category_id == null ? 0 : 1;
      if (aGlobal !== bGlobal) return aGlobal - bGlobal;
      return (a.priority ?? 0) - (b.priority ?? 0);
    });

    const mappingByName = new Map<string, MappingLookupEntry>();
    for (const m of filteredMappings) {
      const attr = Array.isArray(m.attributes) ? m.attributes[0] : m.attributes;
      const key = m.source_field_name.trim().toLowerCase();
      const existing = mappingByName.get(key);
      if (!existing || (m.internal_category_id !== null && existing.internalCategoryId === null)) {
        mappingByName.set(key, {
          id: m.id,
          attributeId: m.attribute_id,
          attributeName: attr?.name ?? "",
          attributeSlug: attr?.slug ?? "",
          matchMode: m.match_mode,
          priority: m.priority,
          internalCategoryId: m.internal_category_id
        });
      }
    }

    const { data: prodRows, error: prodErr } = await supabase
      .from("products")
      .select("id")
      .in("category_id", categoryIds);

    if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 400 });

    const productIds = Array.from(
      new Set((prodRows ?? []).map((r) => (r as { id: string }).id).filter(Boolean))
    );

    const spRows: Array<{ spec_snapshot: unknown }> = [];
    if (productIds.length > 0) {
      for (let i = 0; i < productIds.length; i += PRODUCT_ID_CHUNK) {
        const chunk = productIds.slice(i, i + PRODUCT_ID_CHUNK);
        const { data: chunkRows, error: spErr } = await supabase
          .from("supplier_products")
          .select("spec_snapshot")
          .eq("supplier_id", supplierId)
          .not("spec_snapshot", "is", null)
          .not("product_id", "is", null)
          .in("product_id", chunk);

        if (spErr) return NextResponse.json({ error: spErr.message }, { status: 400 });
        spRows.push(...((chunkRows ?? []) as Array<{ spec_snapshot: unknown }>));
      }
    }

    const fieldMap = new Map<string, { exampleValue: string; productCount: number }>();
    for (const row of spRows) {
      const snap = row.spec_snapshot as { specs?: unknown } | null;
      const rawSpecs = snap?.specs;
      const specs = Array.isArray(rawSpecs) ? rawSpecs : [];
      const seenInThisRow = new Set<string>();
      for (const raw of specs) {
        if (!raw || typeof raw !== "object") continue;
        const s = raw as Record<string, unknown>;
        const name = specCellToString(s.name);
        const value = specCellToString(s.value);
        if (!name || !value) continue;
        if (!seenInThisRow.has(name)) {
          seenInThisRow.add(name);
          const existing = fieldMap.get(name);
          if (existing) {
            existing.productCount += 1;
          } else {
            fieldMap.set(name, { exampleValue: value, productCount: 1 });
          }
        }
      }
    }

    const fields = Array.from(fieldMap.entries())
      .sort((a, b) => b[1].productCount - a[1].productCount)
      .map(([name, stats]) => {
        const mapping = mappingByName.get(name.toLowerCase()) ?? null;
        return {
          name,
          exampleValue: stats.exampleValue,
          productCount: stats.productCount,
          mapping: mapping
            ? {
                id: mapping.id,
                attributeId: mapping.attributeId,
                attributeName: mapping.attributeName,
                attributeSlug: mapping.attributeSlug,
                matchMode: mapping.matchMode,
                priority: mapping.priority
              }
            : null
        };
      });

    return NextResponse.json({
      fields,
      meta: {
        categoryIdsInTree: categoryIds.length,
        productsInTree: productIds.length,
        supplierRowsWithSnapshot: spRows.length
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
