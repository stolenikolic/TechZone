import { NextResponse } from "next/server";
import { processCategoryImageFromBuffer } from "lib/images/process-category-image";
import { revalidateCategorySurfaces } from "lib/revalidate-categories";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";

export const dynamic = "force-dynamic";

/** POST multipart: file → WebP → Storage → categories.image_url */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id: categoryId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: category, error: loadError } = await supabase
      .from("categories")
      .select("id, slug, image_url")
      .eq("id", categoryId)
      .maybeSingle();

    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 400 });
    if (!category) return NextResponse.json({ error: "Category not found." }, { status: 404 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const imageUrl = await processCategoryImageFromBuffer(
      supabase,
      categoryId,
      buffer,
      category.image_url
    );

    const { error: updateError } = await supabase
      .from("categories")
      .update({ image_url: imageUrl })
      .eq("id", categoryId);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });

    revalidateCategorySurfaces(category.slug);
    return NextResponse.json({ success: true, imageUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
