import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";
import { revalidateCategorySurfaces } from "lib/revalidate-categories";

type PatchBody = {
  tone?: string | null;
  audience?: string | null;
  extraInstructions?: string | null;
  isEnabled?: boolean;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id: categoryId } = await context.params;
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("category_ai_description_config")
      .select("tone, audience, extra_instructions, is_enabled, updated_at")
      .eq("category_id", categoryId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({
      config: data
        ? {
            tone: data.tone,
            audience: data.audience,
            extraInstructions: data.extra_instructions,
            isEnabled: data.is_enabled,
            updatedAt: data.updated_at
          }
        : null
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id: categoryId } = await context.params;
    const body = (await request.json()) as PatchBody;
    const supabase = createSupabaseServiceClient();

    const row = {
      category_id: categoryId,
      tone: body.tone?.trim() || "profesionalan, prirodan",
      audience: body.audience?.trim() || null,
      extra_instructions: body.extraInstructions?.trim() || null,
      is_enabled: body.isEnabled !== false,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("category_ai_description_config").upsert(row, {
      onConflict: "category_id"
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const { data: category } = await supabase
      .from("categories")
      .select("slug")
      .eq("id", categoryId)
      .maybeSingle();
    revalidateCategorySurfaces(category?.slug ?? null);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
