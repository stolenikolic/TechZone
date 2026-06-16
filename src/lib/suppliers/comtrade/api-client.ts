import { getComtradeToken, loginComtrade } from "./auth";
import { COMTRADE_API_BASE } from "./constants";
import type {
  ComtradeImageItem,
  ComtradePriceItem,
  ComtradeProductDetail,
  ComtradeSpecItem
} from "./types";

async function parseJson<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ComTrade ${label}: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export class ComtradeApiClient {
  private apiBase: string;
  private token: string | null = null;

  constructor(apiBase = COMTRADE_API_BASE) {
    this.apiBase = apiBase.replace(/\/$/, "");
  }

  async ensureAuth(): Promise<void> {
    this.token = await getComtradeToken(this.apiBase);
  }

  private async fetchAuthed(path: string, label: string, retryOn401 = true): Promise<Response> {
    if (!this.token) await this.ensureAuth();
    const url = `${this.apiBase}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.token}`
      }
    });
    if (res.status === 401 && retryOn401) {
      this.token = await loginComtrade(this.apiBase);
      return this.fetchAuthed(path, label, false);
    }
    return res;
  }

  async fetchPriceItems(): Promise<ComtradePriceItem[]> {
    const res = await this.fetchAuthed("/Price/items", "Price/items");
    const data = await parseJson<ComtradePriceItem[] | { items?: ComtradePriceItem[] }>(
      res,
      "Price/items"
    );
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }

  async fetchProduct(productNo: string): Promise<ComtradeProductDetail | null> {
    const no = encodeURIComponent(productNo.trim());
    const res = await this.fetchAuthed(`/Product?No=${no}`, `Product ${productNo}`);
    if (res.status === 404) return null;
    return parseJson<ComtradeProductDetail>(res, `Product ${productNo}`);
  }

  async fetchProductSpecs(productNo: string): Promise<ComtradeSpecItem[]> {
    const no = encodeURIComponent(productNo.trim());
    const res = await this.fetchAuthed(`/Product/specs?No=${no}`, `Product/specs ${productNo}`);
    if (res.status === 404) return [];
    const data = await parseJson<ComtradeSpecItem[]>(res, `Product/specs ${productNo}`);
    return Array.isArray(data) ? data : [];
  }

  async fetchProductImages(productNo: string): Promise<ComtradeImageItem[]> {
    const no = encodeURIComponent(productNo.trim());
    const res = await this.fetchAuthed(`/Product/images?No=${no}`, `Product/images ${productNo}`);
    if (res.status === 404) return [];
    const data = await parseJson<ComtradeImageItem[]>(res, `Product/images ${productNo}`);
    return Array.isArray(data) ? data : [];
  }
}

export function createComtradeApiClient(): ComtradeApiClient {
  return new ComtradeApiClient();
}
