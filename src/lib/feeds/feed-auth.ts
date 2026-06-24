import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminRole } from "lib/auth/roles";
import { requireSupabaseAnonKey, requireSupabaseUrl } from "utils/supabase/config";
import { getSupabaseNodeClientOptions } from "utils/supabase/node-client-options";

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

function tokensEqual(expected: string, provided: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function isAdminJwt(token: string): Promise<boolean> {
  const supabase = createClient(
    requireSupabaseUrl(),
    requireSupabaseAnonKey(),
    getSupabaseNodeClientOptions()
  );
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return false;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) return false;
  return isAdminRole(profile?.role as "admin" | "customer" | undefined);
}

/**
 * Feed endpoints accept FEED_API_KEY (Bearer) or a valid admin Supabase JWT.
 */
export async function assertFeedAccess(request: Request) {
  const token = extractBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const feedApiKey = process.env.FEED_API_KEY?.trim();
  if (feedApiKey && tokensEqual(feedApiKey, token)) {
    return null;
  }

  try {
    if (await isAdminJwt(token)) return null;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
