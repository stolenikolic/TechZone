import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";
import { generateDescriptionForProduct } from "lib/ai-descriptions/generate-for-product";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { slug } = await context.params;
    const supabase = createSupabaseServiceClient();

    const { data: product, error } = await supabase
      .from("products")
      .select(
        `id, name, brand, category_id, description,
         ai_description_input_hash, ai_description_locked, ai_description_status,
         categories(name, slug)`
      )
      .eq("slug", slug)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    const result = await generateDescriptionForProduct(
      supabase,
      {
        id: product.id as string,
        name: product.name as string,
        brand: (product.brand as string | null) ?? null,
        category_id: (product.category_id as string | null) ?? null,
        description: (product.description as string | null) ?? null,
        ai_description_input_hash: (product.ai_description_input_hash as string | null) ?? null,
        ai_description_locked: Boolean(product.ai_description_locked),
        ai_description_status: (product.ai_description_status as string | null) ?? null,
        categories: product.categories as Parameters<typeof generateDescriptionForProduct>[1]["categories"]
      },
      { force: true }
    );

    if (!result.ok) {
      return NextResponse.json(
        { success: false, reason: result.reason, message: result.message ?? null },
        { status: result.reason === "qa_failed" ? 422 : 400 }
      );
    }

    return NextResponse.json({ success: true, output: result.output });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[regenerate-description]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
