import type { SpecRow, SpecSnapshot } from "lib/suppliers/shared/spec-snapshot";
import type { AvteraProduct } from "./types";

function dimSpec(name: string, value: string | null, unit?: string): SpecRow | null {
  if (!value?.trim()) return null;
  const v = value.trim();
  const display = unit && v !== "0" ? `${v} ${unit}` : v;
  return { name, value: display };
}

export function avteraSpecsToRows(product: AvteraProduct): SpecRow[] {
  const rows: SpecRow[] = [];

  if (product.brandName?.trim()) {
    rows.push({ name: "Brend", value: product.brandName.trim() });
  }

  for (const l of product.dodatneLastnosti) {
    const name = l.naziv.trim();
    const value = l.value.trim();
    if (!name || !value) continue;
    rows.push({ name, value });
  }

  const weight = dimSpec("Bruto teža", product.brutoTeza, "kg");
  if (weight) rows.push(weight);
  const len = dimSpec("Bruto dužina", product.brutoDolzina, "m");
  if (len) rows.push(len);
  const wid = dimSpec("Bruto širina", product.brutoSirina, "m");
  if (wid) rows.push(wid);
  const h = dimSpec("Bruto visina", product.brutoVisina, "m");
  if (h) rows.push(h);

  return rows;
}

export function buildAvteraSpecSnapshot(
  product: AvteraProduct,
  mpn: string | null,
  ean: string | null
): SpecSnapshot {
  return {
    mpn,
    ean,
    factory_link: null,
    specs: avteraSpecsToRows(product)
  };
}

export function buildAvteraRawJson(input: {
  product: AvteraProduct;
  matchAudit?: unknown;
}): Record<string, unknown> {
  const p = input.product;
  const imageUrls = [...p.dodatneSlike];
  const raw: Record<string, unknown> = {
    source: "avtera",
    product_name: p.izdelekIme?.trim() ?? null,
    image_url: p.slikaVelika?.trim() ?? null,
    image_urls: imageUrls.length > 0 ? imageUrls : undefined,
    supplier_url: p.url?.trim() ?? null,
    supplier_category_id: p.kategorijaId,
    brand_id: p.brandId,
    brand_name: p.brandName,
    izdelek: p
  };
  if (input.matchAudit != null) raw.matchAudit = input.matchAudit;
  return raw;
}
