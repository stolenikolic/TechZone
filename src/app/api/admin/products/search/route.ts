import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";

export type AdminProductSearchResult = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  image: string | null;
  mpn: string | null;
  ean: string | null;
};

const SEARCH_COLUMNS = ["name", "brand", "mpn", "ean"] as const;

function cleanToken(token: string) {
  return token.replace(/[%,()]/g, "").trim();
}

function buildTokenFilter(token: string) {
  return SEARCH_COLUMNS.map((column) => `${column}.ilike.%${token}%`).join(",");
}

export async function GET(request: Request) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().slice(0, 160) ?? "";
  const tokens = q.toLowerCase().split(/\s+/).map(cleanToken).filter(Boolean);

  if (tokens.length === 0) {
    return NextResponse.json([]);
  }

  try {
    const supabase = createSupabaseServiceClient();
    let query = supabase
      .from("products")
      .select("id, name, slug, brand, main_image, mpn, ean")
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(20);

    for (const token of tokens) {
      query = query.or(buildTokenFilter(token));
    }

    const { data, error } = await query;
    if (error) {
      console.error("[admin/products/search]", error.message);
      return NextResponse.json([], { status: 200 });
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const body: AdminProductSearchResult[] = rows.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      slug: String(row.slug ?? ""),
      brand: row.brand != null ? String(row.brand) : null,
      image: row.main_image != null ? String(row.main_image) : null,
      mpn: row.mpn != null ? String(row.mpn) : null,
      ean: row.ean != null ? String(row.ean) : null
    }));

    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/products/search]", message);
    return NextResponse.json([], { status: 200 });
  }
}
