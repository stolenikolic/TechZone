/**
 * Deljena HTTP sesija (cookie jar) za dobavljače koji zahtevaju prvo HTML pa JSON/XHR.
 */

export type FetchWithSessionOptions = {
  jar: Map<string, string>;
  userAgent: string;
  referer?: string;
  acceptJson?: boolean;
  /** Ako je postavljeno, koristi se umesto podrazumevanog Accept (npr. samo `text/html`). */
  acceptOverride?: string;
  /** Podrazumevano: en-US,en;q=0.9,hu;q=0.8 */
  acceptLanguage?: string;
  origin?: string;
};

function mergeSetCookieIntoJar(res: Response, jar: Map<string, string>): void {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof headers.getSetCookie === "function") {
    const list = headers.getSetCookie();
    if (list?.length) {
      for (const c of list) {
        const pair = c.split(";")[0].trim();
        const eq = pair.indexOf("=");
        if (eq > 0) jar.set(pair.slice(0, eq), pair);
      }
      return;
    }
  }
  const single = res.headers.get("set-cookie");
  if (!single) return;
  const pair = single.split(";")[0].trim();
  const eq = pair.indexOf("=");
  if (eq > 0) jar.set(pair.slice(0, eq), pair);
}

function cookieHeader(jar: Map<string, string>): string {
  return Array.from(jar.values()).join("; ");
}

export async function fetchWithSession(
  url: string,
  options: FetchWithSessionOptions,
  init?: Omit<RequestInit, "headers">
): Promise<Response> {
  const { jar, userAgent, referer, acceptJson = false, acceptOverride, acceptLanguage, origin } = options;
  const acceptHeader =
    acceptOverride ??
    (acceptJson ? "application/json, text/plain, */*" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
  /** Kao u browseru: navigacija/HTML = `fetch`, XHR JSON lista = `XMLHttpRequest`. */
  const xrw = acceptJson ? "XMLHttpRequest" : "fetch";
  const headers: Record<string, string> = {
    "User-Agent": userAgent,
    Accept: acceptHeader,
    "Accept-Language": acceptLanguage ?? "en-US,en;q=0.9,hu;q=0.8",
    Referer: referer ?? url,
    "X-Requested-With": xrw
  };
  if (origin) headers.Origin = origin;
  const ch = cookieHeader(jar);
  if (ch) headers.Cookie = ch;

  const res = await fetch(url, {
    ...init,
    headers,
    redirect: "follow"
  });
  mergeSetCookieIntoJar(res, jar);
  return res;
}
