import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile";
  const safeNext = next.startsWith("/") ? next : "/profile";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`);
    }
  }

  const errorDescription = searchParams.get("error_description") ?? "Auth callback failed";
  return NextResponse.redirect(
    `${origin}/auth/error?error=${encodeURIComponent(errorDescription)}`
  );
}
