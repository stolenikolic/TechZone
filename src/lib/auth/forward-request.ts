import { headers } from "next/headers";

/**
 * Forwards the browser cookie header on server-side calls to /api/admin/* so
 * middleware and guardAdminApi see the same Supabase session as the page request.
 */
export async function getForwardedCookieHeader(): Promise<Record<string, string>> {
  const headersList = await headers();
  const cookie = headersList.get("cookie");
  return cookie ? { cookie } : {};
}

export async function serverAdminFetch(input: RequestInfo | URL, init?: RequestInit) {
  const cookieHeader = await getForwardedCookieHeader();
  return fetch(input, {
    ...init,
    cache: init?.cache ?? "no-store",
    headers: {
      ...cookieHeader,
      ...(init?.headers ?? {})
    }
  });
}
