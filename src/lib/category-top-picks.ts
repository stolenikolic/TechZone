import { createSupabaseServiceClient } from "utils/supabase";

export type CategoryTopPick = {
  productId: string;
  priority: number;
  createdAt: string;
};

export async function loadTopPickMapByCategory(categoryId: string): Promise<Map<string, CategoryTopPick>> {
  if (!categoryId) return new Map();
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("category_featured_products")
    .select("product_id, priority, created_at")
    .eq("category_id", categoryId);

  return new Map(
    (data ?? []).map((row) => [
      row.product_id,
      {
        productId: row.product_id,
        priority: row.priority ?? 100,
        createdAt: row.created_at ?? ""
      } satisfies CategoryTopPick
    ])
  );
}

export function compareTopPickThenDate(
  productIdA: string,
  productIdB: string,
  createdAtA: string | null | undefined,
  createdAtB: string | null | undefined,
  topPickMap: Map<string, CategoryTopPick>
): number {
  const pickA = topPickMap.get(productIdA);
  const pickB = topPickMap.get(productIdB);
  if (pickA && !pickB) return -1;
  if (!pickA && pickB) return 1;
  if (pickA && pickB) {
    if (pickA.priority !== pickB.priority) return pickA.priority - pickB.priority;
    const pickDateA = Date.parse(pickA.createdAt);
    const pickDateB = Date.parse(pickB.createdAt);
    if (!Number.isNaN(pickDateA) && !Number.isNaN(pickDateB) && pickDateB !== pickDateA) {
      return pickDateB - pickDateA;
    }
  }
  const ta = createdAtA ? Date.parse(createdAtA) : 0;
  const tb = createdAtB ? Date.parse(createdAtB) : 0;
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && tb !== ta) return tb - ta;
  return 0;
}
