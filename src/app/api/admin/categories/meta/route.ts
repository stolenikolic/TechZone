import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient();
    const [{ data: categories, error: categoriesError }, { data: attributes, error: attributesError }] =
      await Promise.all([
        supabase
          .from("categories")
          .select("id, name, slug, parent_id")
          .order("name", { ascending: true }),
        supabase
          .from("attributes")
          .select("id, name, slug, filter_display_type, filter_unit, filter_step")
          .order("name", { ascending: true })
      ]);

    if (categoriesError) return NextResponse.json({ error: categoriesError.message }, { status: 400 });
    if (attributesError) return NextResponse.json({ error: attributesError.message }, { status: 400 });
    return NextResponse.json({ categories: categories ?? [], attributes: attributes ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
