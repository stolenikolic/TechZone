/**
 * Adapter za supplier framework. DB-first lookup sa hardcoded fallback-om.
 *
 * Konzumenti (importeri, scraperi) ne moraju da znaju da li je vrijednost došla
 * iz Supabase-a ili iz statične mape — adapter čita iz `supplier_categories`,
 * `supplier_attribute_mappings`, `supplier_scrape_config` (migracija 00026), a
 * ako DB nema podataka, vraća se na hardcoded vrijednosti iz
 * `src/lib/suppliers/ipon/*` i `src/lib/suppliers/pcx/*`.
 *
 * Pravilo: nikad ne bacaj iz adaptera. Ako DB pukne, vrati fallback i upiši
 * warning u konzolu — kritični putevi (uvoz, scrape) moraju da ostanu funkcionalni.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "utils/supabase";
import { IPON_CATEGORIES, IPON_SUPPLIER_ID } from "lib/suppliers/ipon/categories";
import { PCX_CATEGORIES } from "lib/suppliers/pcx/categories";

export type RegistryCategory = {
  internalCategoryId: string;
  supplierCategoryKey: string | null;
  listingUrl: string | null;
  sortOrder: number;
};

export type AttributeMappingRow = {
  supplierId: string;
  internalCategoryId: string | null;
  attributeId: string;
  attributeSlug: string;
  sourceFieldName: string;
  matchMode: "exact" | "contains" | "regex";
  priority: number;
};

export type RegistryOptions = {
  /** Cache TTL in milliseconds. Defaults to 5 minutes. */
  ttlMs?: number;
  /** Optional pre-built Supabase client to share with caller. */
  supabase?: SupabaseClient;
};

const DEFAULT_TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const categoryCache = new Map<string, CacheEntry<RegistryCategory[]>>();
const mappingsCache = new Map<string, CacheEntry<AttributeMappingRow[]>>();
const configCache = new Map<string, CacheEntry<Record<string, unknown>>>();
const categorySlugCache = new Map<string, CacheEntry<string[]>>();

function now(): number {
  return Date.now();
}

function getSupabase(options?: RegistryOptions): SupabaseClient | null {
  if (options?.supabase) return options.supabase;
  try {
    return createSupabaseServiceClient();
  } catch (err) {
    console.warn("[registry] supabase unavailable:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

function readCache<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (hit.expiresAt < now()) {
    map.delete(key);
    return null;
  }
  return hit.value;
}

function writeCache<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number): void {
  map.set(key, { value, expiresAt: now() + ttlMs });
}

export function invalidateRegistryCaches(supplierId?: string): void {
  if (!supplierId) {
    categoryCache.clear();
    mappingsCache.clear();
    configCache.clear();
    categorySlugCache.clear();
    return;
  }
  categoryCache.delete(supplierId);
  mappingsCache.delete(supplierId);
  configCache.delete(supplierId);
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

function fallbackCategoriesForSupplier(supplierId: string): RegistryCategory[] {
  if (supplierId === IPON_SUPPLIER_ID) {
    return IPON_CATEGORIES.map((c, idx) => ({
      internalCategoryId: c.internalCategoryId,
      supplierCategoryKey: c.supplierCategoryId != null ? String(c.supplierCategoryId) : null,
      listingUrl: c.url,
      sortOrder: (idx + 1) * 10
    }));
  }
  if (supplierId === PCX_SUPPLIER_ID) {
    return PCX_CATEGORIES.map((c, idx) => ({
      internalCategoryId: "",
      supplierCategoryKey: c.name,
      listingUrl: c.url,
      sortOrder: (idx + 1) * 10
    })).filter((c) => c.internalCategoryId);
  }
  return [];
}

/** Mirror of the constant in `src/lib/suppliers/pcx/importProducts.ts`. */
export const PCX_SUPPLIER_ID = "f4a8b2c0-9d1e-4f3a-bc5d-6e7f8091a2b3";

/**
 * Vraća listu kategorija koje dobavljač sinkuje. DB-first; ako tabela `supplier_categories`
 * nema redova, vraća se na hardcoded mapu (`IPON_CATEGORIES` / `PCX_CATEGORIES`).
 */
export async function getSupplierCategories(
  supplierId: string,
  options?: RegistryOptions
): Promise<RegistryCategory[]> {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const cached = readCache(categoryCache, supplierId);
  if (cached) return cached;

  const supabase = getSupabase(options);
  if (!supabase) {
    const fb = fallbackCategoriesForSupplier(supplierId);
    writeCache(categoryCache, supplierId, fb, ttlMs);
    return fb;
  }

  const { data, error } = await supabase
    .from("supplier_categories")
    .select("internal_category_id, supplier_category_key, listing_url, is_active, sort_order")
    .eq("supplier_id", supplierId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("[registry] getSupplierCategories DB error:", error.message, "→ fallback to hardcoded");
    const fb = fallbackCategoriesForSupplier(supplierId);
    writeCache(categoryCache, supplierId, fb, ttlMs);
    return fb;
  }

  const rows = (data ?? []) as Array<{
    internal_category_id: string;
    supplier_category_key: string | null;
    listing_url: string | null;
    sort_order: number | null;
  }>;

  if (rows.length === 0) {
    const fb = fallbackCategoriesForSupplier(supplierId);
    writeCache(categoryCache, supplierId, fb, ttlMs);
    return fb;
  }

  const mapped: RegistryCategory[] = rows.map((r, idx) => ({
    internalCategoryId: r.internal_category_id,
    supplierCategoryKey: r.supplier_category_key,
    listingUrl: r.listing_url,
    sortOrder: r.sort_order ?? (idx + 1) * 10
  }));
  writeCache(categoryCache, supplierId, mapped, ttlMs);
  return mapped;
}

// ---------------------------------------------------------------------------
// Attribute mappings
// ---------------------------------------------------------------------------

export async function loadAttributeMappings(
  supplierId: string,
  options?: RegistryOptions
): Promise<AttributeMappingRow[]> {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const cached = readCache(mappingsCache, supplierId);
  if (cached) return cached;

  const supabase = getSupabase(options);
  if (!supabase) {
    writeCache(mappingsCache, supplierId, [], ttlMs);
    return [];
  }

  const { data, error } = await supabase
    .from("supplier_attribute_mappings")
    .select(
      "id, supplier_id, internal_category_id, attribute_id, source_field_name, match_mode, priority, is_active, attributes(slug)"
    )
    .eq("supplier_id", supplierId)
    .eq("is_active", true)
    .order("priority", { ascending: true });

  if (error) {
    console.warn("[registry] loadAttributeMappings DB error:", error.message);
    writeCache(mappingsCache, supplierId, [], ttlMs);
    return [];
  }

  const rows: AttributeMappingRow[] = ((data ?? []) as Array<{
    supplier_id: string;
    internal_category_id: string | null;
    attribute_id: string;
    source_field_name: string;
    match_mode: "exact" | "contains" | "regex";
    priority: number;
    attributes: { slug: string } | { slug: string }[] | null;
  }>).map((r) => {
    const slug = Array.isArray(r.attributes) ? r.attributes[0]?.slug ?? "" : r.attributes?.slug ?? "";
    return {
      supplierId: r.supplier_id,
      internalCategoryId: r.internal_category_id,
      attributeId: r.attribute_id,
      attributeSlug: slug,
      sourceFieldName: r.source_field_name,
      matchMode: r.match_mode,
      priority: r.priority
    };
  });
  writeCache(mappingsCache, supplierId, rows, ttlMs);
  return rows;
}

/**
 * Build a synchronous resolver from a pre-loaded mappings list. Useful inside
 * tight scrape loops where we want zero per-row I/O. Mappings are filtered by
 * category (NULL category mappings are global). Lower priority comes first;
 * category-specific mappings outrank generic ones when both match.
 */
export function buildAttributeSlugResolver(
  mappings: AttributeMappingRow[],
  internalCategoryId: string | null,
  fallback?: (sourceName: string) => string | null
): (sourceName: string) => string | null {
  const scoped = mappings
    .filter((m) => m.internalCategoryId === internalCategoryId || m.internalCategoryId == null)
    .sort((a, b) => {
      const aSpecific = a.internalCategoryId === internalCategoryId ? 0 : 1;
      const bSpecific = b.internalCategoryId === internalCategoryId ? 0 : 1;
      if (aSpecific !== bSpecific) return aSpecific - bSpecific;
      return a.priority - b.priority;
    });

  return (sourceName: string): string | null => {
    const trimmed = sourceName.trim();
    if (!trimmed) return null;
    const normalized = trimmed.toLowerCase();
    for (const m of scoped) {
      if (evaluateMapping(m, normalized) && m.attributeSlug) return m.attributeSlug;
    }
    return fallback ? fallback(sourceName) : null;
  };
}

function evaluateMapping(mapping: AttributeMappingRow, normalizedSource: string): boolean {
  const target = mapping.sourceFieldName.trim().toLowerCase();
  if (!target) return false;
  if (mapping.matchMode === "exact") return normalizedSource === target;
  if (mapping.matchMode === "contains") return normalizedSource.includes(target);
  if (mapping.matchMode === "regex") {
    try {
      return new RegExp(target, "i").test(normalizedSource);
    } catch {
      return false;
    }
  }
  return false;
}

export type MapSourceFieldOptions = RegistryOptions & {
  /**
   * Optional fallback resolver (e.g. existing hardcoded `mapSpecNameToSlug`).
   * Called only when the DB returns no match.
   */
  fallback?: (sourceName: string) => string | null;
};

/**
 * DB-first attribute mapping resolver. Returns the internal attribute slug for
 * a given supplier-specific source field name, optionally scoped to a category.
 *
 * - DB mappings with `internal_category_id = NULL` apply to all categories.
 * - DB mappings with a specific `internal_category_id` outrank generic ones if
 *   they match (priority numeric, lower = earlier in fallback resolution).
 * - When no DB mapping matches and a `fallback` is supplied, the fallback is
 *   consulted. This keeps the hardcoded `mapSpecNameToSlug` behaviour intact.
 */
export async function mapSourceFieldToAttributeSlug(
  supplierId: string,
  internalCategoryId: string | null,
  sourceName: string,
  options?: MapSourceFieldOptions
): Promise<string | null> {
  const trimmed = sourceName.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();

  const mappings = await loadAttributeMappings(supplierId, options);
  if (mappings.length > 0) {
    const scoped = mappings
      .filter((m) => m.internalCategoryId === internalCategoryId || m.internalCategoryId == null)
      .sort((a, b) => {
        const aSpecific = a.internalCategoryId === internalCategoryId ? 0 : 1;
        const bSpecific = b.internalCategoryId === internalCategoryId ? 0 : 1;
        if (aSpecific !== bSpecific) return aSpecific - bSpecific;
        return a.priority - b.priority;
      });

    for (const mapping of scoped) {
      if (evaluateMapping(mapping, normalized) && mapping.attributeSlug) {
        return mapping.attributeSlug;
      }
    }
  }

  if (options?.fallback) {
    return options.fallback(sourceName);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Category attribute slugs
// ---------------------------------------------------------------------------

/**
 * Vraća listu attribute slugova vezanih za kategoriju (iz category_attributes JOIN attributes).
 * Koristi se u enrichment job-u i u iPon scrape queue-u umjesto hardkodiranog
 * CATEGORY_SCRAPE_CONFIG. Cache po categoryId (isti TTL kao ostale keševe).
 */
export async function loadCategoryAttributeSlugs(
  categoryId: string,
  options?: RegistryOptions
): Promise<string[]> {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const cached = readCache(categorySlugCache, categoryId);
  if (cached) return cached;

  const supabase = getSupabase(options);
  if (!supabase) {
    writeCache(categorySlugCache, categoryId, [], ttlMs);
    return [];
  }

  const { data, error } = await supabase
    .from("category_attributes")
    .select("attributes(slug)")
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("[registry] loadCategoryAttributeSlugs DB error:", error.message);
    writeCache(categorySlugCache, categoryId, [], ttlMs);
    return [];
  }

  const slugs: string[] = ((data ?? []) as Array<{ attributes: { slug: string } | { slug: string }[] | null }>)
    .map((r) => {
      const a = Array.isArray(r.attributes) ? r.attributes[0] : r.attributes;
      return a?.slug ?? "";
    })
    .filter(Boolean);

  writeCache(categorySlugCache, categoryId, slugs, ttlMs);
  return slugs;
}

// ---------------------------------------------------------------------------
// Scrape config
// ---------------------------------------------------------------------------

async function loadScrapeConfig(
  supplierId: string,
  options?: RegistryOptions
): Promise<Record<string, unknown>> {
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const cached = readCache(configCache, supplierId);
  if (cached) return cached;

  const supabase = getSupabase(options);
  if (!supabase) {
    writeCache(configCache, supplierId, {}, ttlMs);
    return {};
  }

  const { data, error } = await supabase
    .from("supplier_scrape_config")
    .select("key, value, is_active")
    .eq("supplier_id", supplierId)
    .eq("is_active", true);

  if (error) {
    console.warn("[registry] loadScrapeConfig DB error:", error.message);
    writeCache(configCache, supplierId, {}, ttlMs);
    return {};
  }

  const result: Record<string, unknown> = {};
  for (const row of (data ?? []) as Array<{ key: string; value: unknown }>) {
    result[row.key] = row.value;
  }
  writeCache(configCache, supplierId, result, ttlMs);
  return result;
}

/**
 * Vraća konkretnu konfiguracionu vrijednost, sa generičnim fallback-om. Tipično
 * koristi se ovako:
 *   `const delay = await getSupplierScrapeConfig<number>(SUPPLIER_ID, "detail_delay_ms", 4000);`
 */
export async function getSupplierScrapeConfig<T = unknown>(
  supplierId: string,
  key: string,
  fallback: T,
  options?: RegistryOptions
): Promise<T> {
  const conf = await loadScrapeConfig(supplierId, options);
  if (key in conf && conf[key] != null) {
    return conf[key] as T;
  }
  return fallback;
}
