import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "utils/supabase/server";
import { isAdminRole } from "./roles";

/**
 * Returns 401 JSON if the request is not from an authenticated admin.
 * Call at the start of every /api/admin/* route handler.
 */
export async function assertAdminApi() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !isAdminRole(profile?.role as "admin" | "customer" | undefined)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return null;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
