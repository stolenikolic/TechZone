/**
 * POST-less batch read of /api/tracking/products?ids=
 * English displayName, brand, plusDays. No image.
 */

import { fetchWithSession } from "lib/suppliers/shared/http-session";
import {
  IPON_ACCEPT_LANGUAGE,
  IPON_IMPORT_USER_AGENT,
  IponCaptchaError,
  looksLikeCaptchaOrBlock,
  numEnv,
  sleep
} from "./ipon-fetch";
import { withTransientHttpRetry } from "./transient-retry";
import { ensureIponXhrSession, IponXhrTokenError, iponXhrHeaders, type IponXhrSession } from "./xhrToken";

const IPON_ORIGIN = "https://iponcomp.com";
export const IPON_TRACKING_BATCH_SIZE = 100;

export type IponTrackingProduct = {
  id: string;
  displayName: string;
  grossPrice: number | null;
  brand: string | null;
  productGroup: string | null;
  searchProductGroup: string | null;
  breadcrumb: string[];
  plusDays: number | null;
};

export function iponCallDelayMs(): number {
  const min = numEnv("IPON_TRACKING_DELAY_MIN_MS", 2000);
  const max = numEnv("IPON_TRACKING_DELAY_MAX_MS", 4000);
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function asGroupKey(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if (typeof rec.id === "number" && Number.isFinite(rec.id)) return String(rec.id);
    if (typeof rec.id === "string" && rec.id.trim()) return rec.id.trim();
  }
  return null;
}

function asPrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return null;
}

export function parseIponTrackingProducts(body: unknown): IponTrackingProduct[] {
  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const items = Array.isArray(body) ? body : Array.isArray(rec?.items) ? rec.items : [];
  const out: IponTrackingProduct[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const id =
      typeof item.id === "number" && Number.isFinite(item.id)
        ? String(item.id)
        : typeof item.id === "string" && item.id.trim()
          ? item.id.trim()
          : null;
    const displayName = typeof item.displayName === "string" ? item.displayName.trim() : "";
    if (!id || !displayName) continue;
    const breadcrumb = Array.isArray(item.breadcrumb)
      ? item.breadcrumb.filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      : [];
    const plusDays =
      typeof item.plusDays === "number" && Number.isFinite(item.plusDays) ? Math.max(0, Math.round(item.plusDays)) : null;
    out.push({
      id,
      displayName,
      grossPrice: asPrice(item.grossPrice),
      brand: typeof item.brand === "string" && item.brand.trim() ? item.brand.trim() : null,
      productGroup: asGroupKey(item.productGroup),
      searchProductGroup: asGroupKey(item.searchProductGroup),
      breadcrumb,
      plusDays
    });
  }
  return out;
}

async function readJsonBody(res: Response, label: string): Promise<unknown> {
  const text = await res.text();
  if (looksLikeCaptchaOrBlock(text, res.status) || res.status === 429) {
    throw new IponCaptchaError(`${label}: captcha / blokada`);
  }
  if (res.status === 403 && text.includes("xhr_token")) throw new IponXhrTokenError();
  if (!res.ok) throw new Error(`${label} HTTP ${res.status}`);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${label}: odgovor nije JSON`);
  }
}

export async function fetchIponTrackingBatch(
  ids: string[],
  jar: Map<string, string>,
  session: IponXhrSession | null
): Promise<{ products: IponTrackingProduct[]; session: IponXhrSession }> {
  const numeric = ids.map((id) => id.trim()).filter((id) => /^\d+$/.test(id)).slice(0, IPON_TRACKING_BATCH_SIZE);
  if (numeric.length === 0) {
    const ready = session ?? (await ensureIponXhrSession(jar, null));
    return { products: [], session: ready };
  }

  const url = `${IPON_ORIGIN}/api/tracking/products?ids=${numeric.join(",")}`;

  const once = async (active: IponXhrSession) => {
    const res = await withTransientHttpRetry(
      `tracking ids=${numeric.length}`,
      () =>
        fetchWithSession(url, {
          jar,
          userAgent: IPON_IMPORT_USER_AGENT,
          referer: `${IPON_ORIGIN}/shop`,
          acceptJson: true,
          acceptLanguage: IPON_ACCEPT_LANGUAGE,
          origin: IPON_ORIGIN,
          extraHeaders: iponXhrHeaders(active)
        }),
      { isRetryableResponse: (response) => response.status === 502 || response.status === 503 || response.status === 504 }
    );
    const json = await readJsonBody(res, "iPon tracking");
    return parseIponTrackingProducts(json);
  };

  let active = await ensureIponXhrSession(jar, session);
  try {
    return { products: await once(active), session: active };
  } catch (error) {
    if (!(error instanceof IponXhrTokenError)) throw error;
    active = await ensureIponXhrSession(jar, null, true);
    return { products: await once(active), session: active };
  }
}

export async function pauseBetweenIponCalls(): Promise<void> {
  await sleep(iponCallDelayMs());
}
