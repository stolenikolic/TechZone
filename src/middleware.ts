import { type NextRequest, NextResponse } from "next/server";
import { isAdminRole } from "lib/auth/roles";
import {
  ADMIN_PROTECTED_PREFIXES,
  AUTH_PAGES,
  CUSTOMER_PROTECTED_PREFIXES
} from "lib/auth/paths";
import { createSupabaseMiddlewareClient } from "utils/supabase/middleware";
import { hasSupabasePublicConfig } from "utils/supabase/config";

function matchesPrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAdminPath(path: string) {
  return matchesPrefix(path, ADMIN_PROTECTED_PREFIXES);
}

function loginUrl(request: NextRequest, nextPath?: string) {
  const url = new URL("/login", request.url);
  if (nextPath) url.searchParams.set("next", nextPath);
  return url;
}

function resolvePostLoginDestination(
  next: string | null,
  isAdmin: boolean
): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    if (isAdminPath(next) && !isAdmin) {
      return "/profile";
    }
    return next;
  }
  return isAdmin ? "/admin/products" : "/profile";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!hasSupabasePublicConfig()) {
    return NextResponse.next();
  }

  const { supabase, response } = createSupabaseMiddlewareClient(request);

  const {
    data: { user }
  } = await supabase.auth.getUser();

  let profileRole: "customer" | "admin" | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    profileRole = (profile?.role as "customer" | "admin") ?? null;
  }

  const isAdmin = isAdminRole(profileRole);
  const isAuthenticated = Boolean(user);

  if (pathname.startsWith("/api/admin")) {
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return response;
  }

  if (matchesPrefix(pathname, ADMIN_PROTECTED_PREFIXES)) {
    if (!isAuthenticated) {
      return NextResponse.redirect(loginUrl(request, pathname));
    }
    if (!isAdmin) {
      // Logged-in customer must not be sent to /login?next=/admin/* (redirect loop).
      return NextResponse.redirect(new URL("/profile", request.url));
    }
    return response;
  }

  if (matchesPrefix(pathname, CUSTOMER_PROTECTED_PREFIXES)) {
    if (!isAuthenticated) {
      return NextResponse.redirect(loginUrl(request, pathname));
    }
    return response;
  }

  if (AUTH_PAGES.includes(pathname as (typeof AUTH_PAGES)[number]) && isAuthenticated) {
    const next = request.nextUrl.searchParams.get("next");
    const dest = resolvePostLoginDestination(next, isAdmin);
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
