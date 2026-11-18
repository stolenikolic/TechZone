/**
 * Alza.hu listing → `supplier_products` only (no new `products` rows).
 * HTTP, pause, and paging stay in `scripts/alza/fetch_category.py`.
 * Run: npx tsx scripts/run-alza-import-products.ts
 */

import { spawn } from "child_process";
import path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvent, type JobRunHandle } from "lib/jobs/job-runner";
import { aggregatePricesForProductIds } from "lib/pricing";
import { resolveSupplierProductMatchSafe } from "lib/suppliers/matchSupplierProduct";
import { eanFromMpnField, mpnMatchKeyFromMpn, normalizeMpn } from "lib/suppliers/normalizeProductIdentifiers";
import { getIdentifierSyncUpdate } from "lib/suppliers/syncSupplierIdentifiers";
import { createSupabaseServiceClient } from "utils/supabase";
import { ALZA_CATEGORIES } from "./categories";
import { ALZA_SUPPLIER_ID } from "./constants";

type AlzaProduct = {
  alza_id: number;
  code?: string | null;
  name?: string | null;
  price_huf?: number | string | null;
  currency?: string | null;
  availability?: string | null;
  can_buy?: boolean | null;
  url?: string | null;
  image_url?: string | null;
  category_id?: number;
  manufacturer?: string | null;
  supplier_code?: string | null;
  variant_type?: number | null;
  source_page?: number;
};

type PageEvent = {
  type: "page";
  category_id: number;
  name?: string;
  page: number;
  count: number;
  new_ids: number;
  total: number;
  has_next: boolean;
  source?: string;
  products: AlzaProduct[];
};

type CategoryDoneEvent = {
  type: "category_done";
  category_id: number;
  name?: string;
  complete: boolean;
  pages: number;
  unique_products: number;
};

type ErrorEvent = {
  type: "error";
  category_id: number;
  name?: string;
  message: string;
  blocked: boolean;
  pages: number;
  unique_products: number;
};

type AlzaEvent = PageEvent | CategoryDoneEvent | ErrorEvent;

type CategoryStats = {
  categoryId: number;
  name: string;
  downloaded: number;
  upserted: number;
  skippedNoPrice: number;
  linked: number;
  pendingReview: number;
  complete: boolean;
  seen: Set<string>;
  linkedProductIds: Set<string>;
};

export type AlzaImportResult = {
  success: boolean;
  error?: string;
  summary: {
    categories: number;
    downloaded: number;
    upserted: number;
    skipped_no_price: number;
    linked: number;
    pending_review: number;
    stale_deactivated: number;
    rows_in_db: number;
    pages: number;
    blocked: boolean;
    aggregate_updated: number;
    aggregate_batches: number;
    aggregate_error?: string;
    aggregate_warnings?: string[];
    error?: string;
    category_results: Array<{
      category_id: number;
      name: string;
      downloaded: number;
      upserted: number;
      skipped_no_price: number;
      linked: number;
      pending_review: number;
      complete: boolean;
      rows_in_db: number;
    }>;
  };
};

function pythonBin(): string {
  const fromEnv = process.env.ALZA_PYTHON?.trim();
  if (fromEnv) return fromEnv;
  return process.platform === "win32" ? "python" : "python3";
}

export function selectedAlzaCategoryIds(): number[] {
  const known = ALZA_CATEGORIES.map((category) => category.categoryId);
  const raw = process.env.ALZA_CATEGORY_IDS?.trim();
  if (!raw) return known;
  const wanted = raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id));
  const knownSet = new Set(known);
  const unknown = wanted.filter((id) => !knownSet.has(id));
  if (unknown.length > 0) {
    throw new Error(`Nepoznat ALZA_CATEGORY_IDS: ${unknown.join(", ")}`);
  }
  const picked = known.filter((id) => wanted.includes(id));
  if (picked.length === 0) {
    throw new Error("ALZA_CATEGORY_IDS ne pogađa nijednu Alza kategoriju.");
  }
  return picked;
}

/** In stock only when Alza says it can be bought and at least one piece is available. */
export function isAlzaOfferActive(canBuy: boolean | null | undefined, availability: string | null | undefined): boolean {
  if (canBuy !== true) return false;
  const text = (availability ?? "")
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return false;
  if (/kérés esetén/i.test(text) || /nincs/i.test(text)) return false;
  const moreThan = text.match(/raktáron\s*>\s*(\d+)/i);
  if (moreThan) return Number(moreThan[1]) >= 1;
  const exact = text.match(/raktáron\s*(\d+)/i);
  if (exact) return Number(exact[1]) >= 1;
  return /raktáron/i.test(text);
}

function priceAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

function categoryIdsFromRaw(raw: unknown): number[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const value = (raw as { category_ids?: unknown }).category_ids;
  if (!Array.isArray(value)) return [];
  const ids = new Set<number>();
  for (const item of value) {
    const id = Number(item);
    if (Number.isInteger(id)) ids.add(id);
  }
  return [...ids].sort((a, b) => a - b);
}

function runFetch(categoryIds: number[], onEvent: (event: AlzaEvent) => Promise<void>): Promise<number> {
  const script = path.resolve(process.cwd(), "scripts", "alza", "fetch_category.py");
  const child = spawn(pythonBin(), [script, ...categoryIds.map(String)], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" }
  });

  return new Promise((resolve, reject) => {
    let buffer = "";
    let chain = Promise.resolve();
    let settled = false;

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      if (!child.killed) child.kill();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    child.stderr.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk);
    });

    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
        if (!line) continue;
        chain = chain
          .then(async () => {
            const event = JSON.parse(line) as AlzaEvent;
            await onEvent(event);
            if (!child.stdin.destroyed) child.stdin.write("ok\n");
          })
          .catch(fail);
      }
    });

    child.on("error", fail);
    child.on("close", (code) => {
      chain
        .then(() => {
          if (settled) return;
          settled = true;
          resolve(code ?? 1);
        })
        .catch(fail);
    });
  });
}

async function loadExistingRaw(supabase: SupabaseClient, supplierProductIds: string[]) {
  const found = new Map<string, unknown>();
  if (supplierProductIds.length === 0) return found;
  const { data, error } = await supabase
    .from("supplier_products")
    .select("supplier_product_id, raw_json")
    .eq("supplier_id", ALZA_SUPPLIER_ID)
    .in("supplier_product_id", supplierProductIds);
  if (error) throw new Error(`[Alza] postojeće ponude: ${error.message}`);
  for (const row of data ?? []) {
    found.set(row.supplier_product_id as string, row.raw_json);
  }
  return found;
}

async function countRowsInCategory(supabase: SupabaseClient, categoryId: number): Promise<number> {
  const { count, error } = await supabase
    .from("supplier_products")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", ALZA_SUPPLIER_ID)
    .contains("raw_json", { category_ids: [categoryId] });
  if (error) throw new Error(`[Alza] broj redova: ${error.message}`);
  return count ?? 0;
}

async function removeCategoryFromUnseen(
  supabase: SupabaseClient,
  categoryId: number,
  seen: Set<string>
): Promise<number> {
  const stale: Array<{ supplier_product_id: string; raw_json: unknown }> = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("supplier_products")
      .select("supplier_product_id, raw_json")
      .eq("supplier_id", ALZA_SUPPLIER_ID)
      .contains("raw_json", { category_ids: [categoryId] })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`[Alza] stare ponude: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) {
      if (!seen.has(row.supplier_product_id as string)) stale.push(row);
    }
    if (rows.length < pageSize) break;
  }

  let removed = 0;
  for (const row of stale) {
    const categoryIds = categoryIdsFromRaw(row.raw_json).filter((id) => id !== categoryId);
    const raw =
      row.raw_json && typeof row.raw_json === "object" && !Array.isArray(row.raw_json)
        ? { ...(row.raw_json as Record<string, unknown>) }
        : {};
    raw.category_ids = categoryIds;
    const patch: Record<string, unknown> = {
      raw_json: raw,
      updated_at: new Date().toISOString()
    };
    if (categoryIds.length === 0) patch.is_active = false;
    const { error } = await supabase
      .from("supplier_products")
      .update(patch)
      .eq("supplier_id", ALZA_SUPPLIER_ID)
      .eq("supplier_product_id", row.supplier_product_id);
    if (error) throw new Error(`[Alza] gašenje ponude ${row.supplier_product_id}: ${error.message}`);
    removed += 1;
  }
  return removed;
}

async function upsertPage(
  supabase: SupabaseClient,
  event: PageEvent,
  stats: CategoryStats
): Promise<void> {
  const byId = new Map<string, AlzaProduct>();
  for (const product of event.products) {
    if (!Number.isInteger(product.alza_id)) continue;
    const supplierProductId = String(product.alza_id);
    stats.seen.add(`downloaded:${supplierProductId}`);
    byId.set(supplierProductId, product);
  }
  stats.downloaded = new Set(
    [...stats.seen].filter((id) => id.startsWith("downloaded:")).map((id) => id.slice("downloaded:".length))
  ).size;

  const existing = await loadExistingRaw(supabase, [...byId.keys()]);
  for (const [supplierProductId, product] of byId) {
    const price = priceAmount(product.price_huf);
    if (price == null || price <= 0) {
      stats.skippedNoPrice += 1;
      console.warn(`[Alza] Skip (no price): ${supplierProductId} ${product.name ?? ""}`);
      continue;
    }

    const supplierCode = asText(product.supplier_code);
    const mpn = normalizeMpn(supplierCode);
    const ean = eanFromMpnField(supplierCode);
    const match = await resolveSupplierProductMatchSafe(supabase, { ean: supplierCode, mpn: supplierCode });
    const productId = match.productId;
    let resolvedMpn = mpn;
    let resolvedEan = ean;
    if (productId) {
      const { data: master, error: masterError } = await supabase
        .from("products")
        .select("mpn, ean")
        .eq("id", productId)
        .maybeSingle();
      if (masterError) throw new Error(`[Alza] products identifiers: ${masterError.message}`);
      const identifierSync = getIdentifierSyncUpdate(
        { mpn, ean },
        { mpn: master?.mpn ?? null, ean: master?.ean ?? null }
      );
      resolvedMpn = identifierSync.update.mpn ?? mpn;
      resolvedEan = identifierSync.update.ean ?? ean;
    }

    const categoryIds = categoryIdsFromRaw(existing.get(supplierProductId));
    if (!categoryIds.includes(event.category_id)) categoryIds.push(event.category_id);
    categoryIds.sort((a, b) => a - b);

    const rawJson: Record<string, unknown> = {
      source: "alza",
      alza_id: product.alza_id,
      code: asText(product.code),
      supplier_code: supplierCode,
      name: asText(product.name),
      url: asText(product.url),
      image_url: asText(product.image_url),
      availability: asText(product.availability),
      can_buy: product.can_buy === true,
      manufacturer: asText(product.manufacturer),
      variant_type: product.variant_type ?? null,
      source_page: product.source_page ?? event.page,
      category_ids: categoryIds,
      matchAudit: match.audit
    };

    const { error } = await supabase.from("supplier_products").upsert(
      {
        supplier_id: ALZA_SUPPLIER_ID,
        supplier_product_id: supplierProductId,
        product_id: productId,
        price_amount: price,
        currency: "HUF",
        mpn: resolvedMpn,
        mpn_match_key: mpnMatchKeyFromMpn(resolvedMpn),
        ean: resolvedEan,
        is_active: isAlzaOfferActive(product.can_buy, asText(product.availability)),
        enrichment_status: "complete",
        master_match_status: productId ? "linked" : "pending_review",
        raw_json: rawJson,
        updated_at: new Date().toISOString()
      },
      { onConflict: "supplier_id,supplier_product_id" }
    );
    if (error) throw new Error(`[Alza] upsert ${supplierProductId}: ${error.message}`);

    stats.seen.add(supplierProductId);
    stats.upserted += 1;
    if (productId) {
      stats.linked += 1;
      stats.linkedProductIds.add(productId);
    } else {
      stats.pendingReview += 1;
    }
  }
}

function emptyStats(categoryId: number, name: string): CategoryStats {
  return {
    categoryId,
    name,
    downloaded: 0,
    upserted: 0,
    skippedNoPrice: 0,
    linked: 0,
    pendingReview: 0,
    complete: false,
    seen: new Set<string>(),
    linkedProductIds: new Set<string>()
  };
}

export async function runAlzaImportProducts(
  handle?: JobRunHandle,
  categoryIdsOverride?: number[]
): Promise<AlzaImportResult> {
  const categoryIds = categoryIdsOverride ?? selectedAlzaCategoryIds();
  const known = new Set(ALZA_CATEGORIES.map((category) => category.categoryId));
  const unknown = categoryIds.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new Error(`Nepoznata Alza kategorija: ${unknown.join(", ")}`);
  }
  const supabase = createSupabaseServiceClient();
  const statsByCategory = new Map<number, CategoryStats>();
  let pages = 0;
  let blocked = false;
  let errorMessage: string | undefined;

  for (const categoryId of categoryIds) {
    const known = ALZA_CATEGORIES.find((category) => category.categoryId === categoryId);
    statsByCategory.set(categoryId, emptyStats(categoryId, known?.name ?? ""));
  }

  const exitCode = await runFetch(categoryIds, async (event) => {
    const stats = statsByCategory.get(event.category_id) ?? emptyStats(event.category_id, event.name ?? "");
    statsByCategory.set(event.category_id, stats);
    if (event.name) stats.name = event.name;

    if (event.type === "page") {
      pages += 1;
      await upsertPage(supabase, event, stats);
      const message = `${stats.name || event.category_id} str. ${event.page} | +${event.new_ids} | skinuto ${stats.downloaded} / ${event.total} | upisano ${stats.upserted} | ${event.source ?? ""}`;
      console.log(`[Alza] ${message}`);
      await logEvent(handle ?? { runId: null }, { message });
      return;
    }

    if (event.type === "category_done") {
      stats.complete = event.complete;
      await logEvent(handle ?? { runId: null }, {
        message: `${stats.name || event.category_id} gotovo: skinuto ${event.unique_products}, upisano ${stats.upserted}`
      });
      return;
    }

    errorMessage = event.message;
    blocked = event.blocked;
    await logEvent(handle ?? { runId: null }, { level: "error", message: event.message });
  });

  if (exitCode !== 0 && !errorMessage) {
    errorMessage = `Alza fetch završio sa kodom ${exitCode}`;
  }

  let staleDeactivated = 0;
  if (exitCode === 0) {
    for (const stats of statsByCategory.values()) {
      if (!stats.complete) continue;
      const upsertedIds = new Set([...stats.seen].filter((id) => !id.startsWith("downloaded:")));
      staleDeactivated += await removeCategoryFromUnseen(supabase, stats.categoryId, upsertedIds);
    }
  }

  const linkedProductIds = [
    ...new Set([...statsByCategory.values()].flatMap((stats) => [...stats.linkedProductIds]))
  ];
  const agg = await aggregatePricesForProductIds(linkedProductIds, { reconcile: true });
  if (agg.error) console.warn("[Alza] aggregate-prices:", agg.error);

  const categoryResults = [];
  let rowsInDb = 0;
  for (const stats of statsByCategory.values()) {
    const rows = await countRowsInCategory(supabase, stats.categoryId);
    rowsInDb += rows;
    categoryResults.push({
      category_id: stats.categoryId,
      name: stats.name,
      downloaded: stats.downloaded,
      upserted: stats.upserted,
      skipped_no_price: stats.skippedNoPrice,
      linked: stats.linked,
      pending_review: stats.pendingReview,
      complete: stats.complete,
      rows_in_db: rows
    });
  }

  const downloaded = categoryResults.reduce((sum, row) => sum + row.downloaded, 0);
  const upserted = categoryResults.reduce((sum, row) => sum + row.upserted, 0);
  const success = exitCode === 0 && !agg.error;

  return {
    success,
    ...(errorMessage ? { error: errorMessage } : {}),
    summary: {
      categories: categoryIds.length,
      downloaded,
      upserted,
      skipped_no_price: categoryResults.reduce((sum, row) => sum + row.skipped_no_price, 0),
      linked: categoryResults.reduce((sum, row) => sum + row.linked, 0),
      pending_review: categoryResults.reduce((sum, row) => sum + row.pending_review, 0),
      stale_deactivated: staleDeactivated,
      rows_in_db: rowsInDb,
      pages,
      blocked,
      aggregate_updated: agg.updated,
      aggregate_batches: agg.batches,
      ...(agg.error ? { aggregate_error: agg.error } : {}),
      ...(agg.warnings?.length ? { aggregate_warnings: agg.warnings } : {}),
      ...(errorMessage ? { error: errorMessage } : {}),
      category_results: categoryResults
    }
  };
}
