import { NextResponse } from "next/server";
import { PRODUCT_IMAGES_BUCKET } from "lib/images/constants";
import { resizeProductToWebp } from "lib/images/resize-to-webp";
import { uploadWebp } from "lib/images/storage";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";

export const dynamic = "force-dynamic";

/** POST multipart: file → WebP → Storage → product_images row */
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { slug } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "file is required." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, main_image")
      .eq("slug", slug)
      .maybeSingle();

    if (productError) return NextResponse.json({ error: productError.message }, { status: 400 });
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    const productId = String(product.id);

    const { data: existingRows } = await supabase
      .from("product_images")
      .select("sort_order")
      .eq("product_id", productId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextIndex =
      existingRows?.length && existingRows[0]?.sort_order != null
        ? Number(existingRows[0].sort_order) + 1
        : 0;

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const webpBuffer = await resizeProductToWebp(rawBuffer);
    const path = `${productId}/${nextIndex}.webp`;
    const imageUrl = await uploadWebp(supabase, PRODUCT_IMAGES_BUCKET, path, webpBuffer);

    const { error: insertError } = await supabase.from("product_images").insert({
      product_id: productId,
      image_url: imageUrl,
      sort_order: nextIndex
    });

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

    if (!product.main_image) {
      await supabase.from("products").update({ main_image: imageUrl }).eq("id", productId);
    }

    return NextResponse.json({ success: true, imageUrl, sortOrder: nextIndex });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
