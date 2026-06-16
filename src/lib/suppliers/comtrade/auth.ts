import { COMTRADE_AUTH_CLIENT_ID, COMTRADE_AUTH_COUNTRY } from "./constants";
import type { ComtradeLoginResponse } from "./types";

function readCredentials(): { username: string; password: string } {
  const username = process.env.COMTRADE_USERNAME?.trim() ?? "";
  const password = process.env.COMTRADE_PASSWORD?.trim() ?? "";
  if (!username || !password) {
    throw new Error(
      "COMTRADE_USERNAME and COMTRADE_PASSWORD must be set in .env.local"
    );
  }
  return { username, password };
}

function extractToken(body: ComtradeLoginResponse): string | null {
  const t = body.token ?? body.accessToken ?? body.access_token;
  return typeof t === "string" && t.trim().length > 0 ? t.trim() : null;
}

let cachedToken: string | null = null;

export function clearComtradeTokenCache(): void {
  cachedToken = null;
}

export async function loginComtrade(apiBase: string): Promise<string> {
  const { username, password } = readCredentials();
  const res = await fetch(`${apiBase}/Auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      clientId: COMTRADE_AUTH_CLIENT_ID,
      country: COMTRADE_AUTH_COUNTRY,
      username,
      password
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ComTrade login failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as ComtradeLoginResponse;
  const token = extractToken(body);
  if (!token) throw new Error("ComTrade login: no token in response");
  cachedToken = token;
  return token;
}

export async function getComtradeToken(apiBase: string, forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken) return cachedToken;
  return loginComtrade(apiBase);
}
