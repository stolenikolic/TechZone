import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";

export const dynamic = "force-dynamic";

type Row = { id: string; name: string; slug: string };

export async function GET() {
  const denied = await guardAdminApi();
  if (denied) return denied;
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
