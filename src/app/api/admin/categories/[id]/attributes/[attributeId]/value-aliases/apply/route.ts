import { NextResponse } from "next/server";
import { applyValueAliasesToProducts } from "lib/attributes/apply-value-aliases-to-products";
import { assertAttributeOnCategory } from "lib/attributes/category-attribute-guard";
import { revalidateCategorySurfaces } from "lib/revalidate-categories";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; attributeId: string }> }
) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id: categoryId, attributeId } = await context.params;
    const supabase = createSupabaseServiceClient();
    if (!(await assertAttributeOnCategory(supabase, categoryId, attributeId))) {
      return NextResponse.json({ error: "Attribute not attached to category." }, { status: 404 });
    }

    const result = await applyValueAliasesToProducts(supabase, { categoryId, attributeId });

    const { data: category } = await supabase
      .from("categories")
      .select("slug")
      .eq("id", categoryId)
      .maybeSingle();
    revalidateCategorySurfaces(category?.slug ?? null);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
