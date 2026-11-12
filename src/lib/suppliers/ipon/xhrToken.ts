/**
 * iPon shop API session token. The site issues it from /api/xhr-token and
 * expects X-Ipon-Xhr / X-Ipon-Xid on later JSON calls. Same flow as the browser.
 */

import { fetchWithSession } from "lib/suppliers/shared/http-session";
import { IPON_ACCEPT_LANGUAGE, IPON_IMPORT_USER_AGENT, looksLikeCaptchaOrBlock } from "./ipon-fetch";

const IPON_ORIGIN = "https://iponcomp.com";

export class IponXhrTokenError extends Error {
  constructor() {
    super("iPon xhr_token");
    this.name = "IponXhrTokenError";
  }
}

export type IponXhrSession = {
  token: string;
  xid: string | null;
  expiresAt: number;
};

function xhrHeaders(session: IponXhrSession): Record<string, string> {
  const headers: Record<string, string> = { "X-Ipon-Xhr": session.token };
  if (session.xid) headers["X-Ipon-Xid"] = session.xid;
  return headers;
}

export function iponXhrHeaders(session: IponXhrSession | null): Record<string, string> {
  return session ? xhrHeaders(session) : {};
}

async function readTokenResponse(res: Response): Promise<IponXhrSession> {
  const text = await res.text();
  if (looksLikeCaptchaOrBlock(text, res.status)) {
    throw new Error("iPon xhr-token: captcha / blokada");
  }
  if (!res.ok) throw new Error(`iPon xhr-token HTTP ${res.status}`);
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new Error("iPon xhr-token: odgovor nije JSON");
  }
  const rec = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  const token = rec && typeof rec.token === "string" ? rec.token : "";
  if (!token) throw new Error("iPon xhr-token: prazan token");
  const ttl = rec && typeof rec.ttl === "number" && rec.ttl > 0 ? rec.ttl : 600;
  const xid = rec && typeof rec.xid === "string" && rec.xid ? rec.xid : null;
  return { token, xid, expiresAt: Date.now() + ttl * 1000 - 60_000 };
}

export async function ensureIponXhrSession(
  jar: Map<string, string>,
  current: IponXhrSession | null,
  force = false
): Promise<IponXhrSession> {
  if (!force && current && current.expiresAt > Date.now()) return current;

  if (jar.size === 0) {
    const home = await fetchWithSession(`${IPON_ORIGIN}/shop`, {
      jar,
      userAgent: IPON_IMPORT_USER_AGENT,
      referer: `${IPON_ORIGIN}/`,
      acceptJson: false,
      acceptLanguage: IPON_ACCEPT_LANGUAGE,
      origin: IPON_ORIGIN
    });
    if (home.ok) await home.text();
    else await home.text().catch(() => undefined);
  }

  const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const res = await fetchWithSession(`${IPON_ORIGIN}/api/xhr-token?r=${nonce}`, {
    jar,
    userAgent: IPON_IMPORT_USER_AGENT,
    referer: `${IPON_ORIGIN}/shop`,
    acceptJson: true,
    acceptLanguage: IPON_ACCEPT_LANGUAGE,
    origin: IPON_ORIGIN
  });
  return readTokenResponse(res);
}
