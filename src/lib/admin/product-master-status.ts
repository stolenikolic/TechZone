import type Product from "models/Product.model";
import { isNotApplicableAttributeValue } from "lib/attributes/not-applicable-value";
import { getEffectivePrice } from "lib/effective-price";

export type DbCategory = { id: string; name: string; slug: string; parent_id: string | null };

export type DbProductForStatus = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  main_image: string | null;
  price: number | null;
  custom_price: number | null;
  mpn: string | null;
  ean: string | null;
  attributes: Record<string, unknown> | null;
  categories: DbCategory | DbCategory[] | null;
};

export type MasterStatus = NonNullable<Product["masterStatus"]>;
export type MasterStatusValue = MasterStatus["value"];

export type CategoryAttrReq = { attributeId: string; slug: string };

function hasAttributesJson(value: Record<string, unknown> | null) {
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

function manualJsonHasValue(attrs: Record<string, unknown> | null, slug: string): boolean {
  if (!attrs || typeof attrs !== "object") return false;
  const v = attrs[slug];
  if (typeof v === "string") {
    const t = v.trim();
    if (t.length === 0) return false;
    if (isNotApplicableAttributeValue(t)) return true;
    return true;
  }
  if (typeof v === "number" && Number.isFinite(v)) return true;
  if (typeof v === "boolean") return true;
  return false;
}

function hasCategoryAttributeValue(
  attrs: Record<string, unknown> | null,
  req: CategoryAttrReq,
  presentIds: Set<string>,
  valuesBySlug: Map<string, string> | undefined
): boolean {
  const tableVal = valuesBySlug?.get(req.slug);
  if (tableVal !== undefined) {
    const t = tableVal.trim();
    if (t.length === 0) return false;
    return true;
  }
  if (presentIds.has(req.attributeId)) return true;
  return manualJsonHasValue(attrs, req.slug);
}

export function getMasterStatus(
  row: DbProductForStatus,
  supplierOffers: number,
  categoryReqByCategoryId: Map<string, CategoryAttrReq[]>,
  productAttributeIds: Map<string, Set<string>>,
  productAttributeValues: Map<string, Map<string, string>>
): MasterStatus {
  if (supplierOffers === 0) {
    return {
      value: "unlinked",
      label: "unlinked",
      tooltip: "This master product has no linked supplier offers.",
      missing: ["supplier offer"],
      supplierOffers
    };
  }

  const missing: string[] = [];
  const effectivePrice = getEffectivePrice(row.custom_price, row.price);
  if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) missing.push("price");
  if (!row.categories || (Array.isArray(row.categories) && row.categories.length === 0)) {
    missing.push("category");
  }
  if (!row.main_image) missing.push("image");
  if (!row.mpn && !row.ean) missing.push("MPN or EAN");

  if (missing.length > 0) {
    return {
      value: "linked",
      label: "linked",
      tooltip: `Linked to supplier offer(s), but missing: ${missing.join(", ")}.`,
      missing,
      supplierOffers
    };
  }

  const rawCategory = row.categories;
  const category =
    rawCategory == null ? null : Array.isArray(rawCategory) ? rawCategory[0] ?? null : rawCategory;
  const required = category?.id ? categoryReqByCategoryId.get(category.id) ?? [] : [];
  const presentIds = productAttributeIds.get(row.id) ?? new Set<string>();
  const valuesBySlug = productAttributeValues.get(row.id);

  const missingSlugSet = new Set<string>();
  for (const req of required) {
    if (!hasCategoryAttributeValue(row.attributes, req, presentIds, valuesBySlug)) {
      missingSlugSet.add(req.slug);
    }
  }
  const missingSlugs = Array.from(missingSlugSet);

  if (missingSlugs.length > 0) {
    const preview = missingSlugs.slice(0, 14).join(", ");
    return {
      value: "needs_attributes",
      label: "needs attributes",
      tooltip: `Missing ${missingSlugs.length} category attribute(s): ${preview}${missingSlugs.length > 14 ? ", …" : ""}.`,
      missing: missingSlugs,
      supplierOffers
    };
  }

  if (required.length === 0 && !hasAttributesJson(row.attributes) && presentIds.size === 0) {
    return {
      value: "needs_attributes",
      label: "needs attributes",
      tooltip:
        "No category attribute template is configured for this category, and this product has no attribute values yet.",
      missing: ["attributes"],
      supplierOffers
    };
  }

  return {
    value: "ready",
    label: "ready",
    tooltip: "Ready: linked offer, price, category, image, MPN/EAN, and attributes are present.",
    missing: [],
    supplierOffers
  };
}

export function firstCategory(row: DbProductForStatus): DbCategory | null {
  const rawCategory = row.categories;
  return rawCategory == null ? null : Array.isArray(rawCategory) ? rawCategory[0] ?? null : rawCategory;
}
