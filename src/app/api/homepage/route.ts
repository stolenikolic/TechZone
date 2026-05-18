import { NextResponse } from "next/server";
import { loadActiveHomepage } from "lib/homepage/load-homepage";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await loadActiveHomepage(true);
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[api/homepage]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
