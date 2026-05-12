import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";

export const dynamic = "force-dynamic";

type Row = { id: string; name: string; slug: string };

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("attributes")
      .select("id, name, slug")
      .order("slug", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ items: (data ?? []) as Row[] });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
