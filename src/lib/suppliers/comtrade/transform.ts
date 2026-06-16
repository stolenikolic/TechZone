import type { SpecRow, SpecSnapshot } from "lib/suppliers/shared/spec-snapshot";
import { COMTRADE_IMAGE_CDN } from "./constants";
import type { ComtradeImageItem, ComtradePriceItem, ComtradeProductDetail, ComtradeSpecItem } from "./types";

export function comtradeImageUrl(filename: string): string {
  const name = filename.trim().replace(/^\//, "");
  return `${COMTRADE_IMAGE_CDN}/${name}`;
}

export function buildComtradeImageUrls(images: ComtradeImageItem[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const img of images) {
    const url = img.url?.trim();
    if (!url) continue;
    const full = comtradeImageUrl(url);
    if (seen.has(full)) continue;
    seen.add(full);
    out.push(full);
  }
  return out;
}

export function comtradeSpecsToRows(specs: ComtradeSpecItem[]): SpecRow[] {
  return specs
    .map((s) => {
      const name = (s.name?.trim() || s.nameEng?.trim() || s.code?.trim() || "").trim();
      const value = (s.value?.trim() || s.valueEng?.trim() || "").trim();
      if (!name || !value) return null;
      return { name, value };
    })
    .filter((r): r is SpecRow => r != null);
}

export function buildComtradeSpecSnapshot(
  detail: ComtradeProductDetail | null,
  specs: ComtradeSpecItem[],
  mpn: string | null,
  ean: string | null
): SpecSnapshot {
  return {
    mpn: mpn ?? detail?.productNo ?? null,
    ean: ean ?? detail?.barCode ?? null,
    factory_link: null,
    specs: comtradeSpecsToRows(specs)
  };
}

export function resolveComtradeListPrice(item: ComtradePriceItem): number | null {
  const price = Number(item.partnerPrice);
  if (!Number.isFinite(price) || price < 0) return null;
  return price;
}

export function buildComtradeRawJson(input: {
  listItem: ComtradePriceItem;
  detail?: ComtradeProductDetail | null;
  imageUrls?: string[];
  matchAudit?: unknown;
  productGroupId: string;
}): Record<string, unknown> {
  const raw: Record<string, unknown> = {
    source: "comtrade",
    product_group_id: input.productGroupId,
    list_item: input.listItem
  };
  if (input.detail) raw.product_detail = input.detail;
  if (input.imageUrls?.length) raw.image_urls = input.imageUrls;
  if (input.matchAudit != null) raw.matchAudit = input.matchAudit;
  return raw;
}
