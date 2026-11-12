/**
 * Learn English productGroup names from iPon products already in each category.
 * A category is saved only after every one of its existing ids has been read.
 * A captcha leaves the finished reads in ipon_product_group_seen and continues next run.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { IPON_SUPPLIER_ID } from "./constants";
import type { IponMappedCategory } from "./classifyFeedProduct";
import { IponCaptchaError } from "./ipon-fetch";
import { withPostgrestTransientRetry } from "./transient-retry";
import {
  IPON_TRACKING_BATCH_SIZE,
  fetchIponTrackingBatch,
  pauseBetweenIponCalls,
  type IponTrackingProduct
} from "./trackingApi";
import type { IponXhrSession } from "./xhrToken";

const DB_PAGE = 1000;
const DB_CHUNK = 200;

type MutableSession = { current: IponXhrSession | null };

export type LearnProductGroupsResult = {
  learned: number;
  skippedEmpty: number;
  requests: number;
  captcha: boolean;
};

async function loadCategoryProductIds(supabase: SupabaseClient, internalCategoryId: string): Promise<string[]> {
  const productIds: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await withPostgrestTransientRetry("learn.product-ids", async () =>
      supabase
        .from("products")
        .select("id")
        .eq("category_id", internalCategoryId)
        .order("id", { ascending: true })
        .range(offset, offset + DB_PAGE - 1)
    );
    if (error) throw new Error(`product ids ${internalCategoryId}: ${error.message}`);
    const page = (data ?? []) as Array<{ id: string }>;
    for (const row of page) productIds.push(row.id);
    if (page.length < DB_PAGE) break;
    offset += page.length;
  }

  const ids: string[] = [];
  for (let i = 0; i < productIds.length; i += DB_CHUNK) {
    const part = productIds.slice(i, i + DB_CHUNK);
    const { data, error } = await withPostgrestTransientRetry("learn.supplier-ids", async () =>
      supabase
        .from("supplier_products")
        .select("supplier_product_id")
        .eq("supplier_id", IPON_SUPPLIER_ID)
        .in("product_id", part)
    );
    if (error) throw new Error(`supplier ids ${internalCategoryId}: ${error.message}`);
    for (const row of (data ?? []) as Array<{ supplier_product_id: string | null }>) {
      if (row.supplier_product_id) ids.push(String(row.supplier_product_id));
    }
  }
  return ids;
}

async function loadSeenIds(supabase: SupabaseClient, supplierCategoryId: string): Promise<Set<string>> {
  const seen = new Set<string>();
  let offset = 0;
  for (;;) {
    const { data, error } = await withPostgrestTransientRetry("learn.seen", async () =>
      supabase
        .from("ipon_product_group_seen")
        .select("supplier_product_id")
        .eq("supplier_category_id", supplierCategoryId)
        .order("supplier_product_id", { ascending: true })
        .range(offset, offset + DB_PAGE - 1)
    );
    if (error) throw new Error(`seen ids: ${error.message}`);
    const page = (data ?? []) as Array<{ supplier_product_id: string }>;
    for (const row of page) seen.add(String(row.supplier_product_id));
    if (page.length < DB_PAGE) break;
    offset += page.length;
  }
  return seen;
}

async function saveSeen(
  supabase: SupabaseClient,
  supplierCategoryId: string,
  rows: Array<{ supplier_product_id: string; product_group: string | null }>
): Promise<void> {
  for (let i = 0; i < rows.length; i += DB_CHUNK) {
    const part = rows.slice(i, i + DB_CHUNK).map((row) => ({
      supplier_category_id: supplierCategoryId,
      supplier_product_id: row.supplier_product_id,
      product_group: row.product_group
    }));
    const { error } = await supabase.from("ipon_product_group_seen").upsert(part, {
      onConflict: "supplier_category_id,supplier_product_id"
    });
    if (error) throw new Error(`seen upsert: ${error.message}`);
  }
}

async function trackBatch(
  ids: string[],
  jar: Map<string, string>,
  session: MutableSession
): Promise<{ products: IponTrackingProduct[]; missing: string[] }> {
  const first = await fetchIponTrackingBatch(ids, jar, session.current);
  session.current = first.session;
  const found = new Set(first.products.map((product) => product.id));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length === 0) return { products: first.products, missing: [] };
  await pauseBetweenIponCalls();
  const second = await fetchIponTrackingBatch(missing, jar, session.current);
  session.current = second.session;
  const foundAgain = new Set(second.products.map((product) => product.id));
  return {
    products: first.products.concat(second.products),
    missing: missing.filter((id) => !foundAgain.has(id))
  };
}

async function finalizeCategory(
  supabase: SupabaseClient,
  supplierCategoryId: string
): Promise<string[]> {
  const names = new Set<string>();
  let offset = 0;
  for (;;) {
    const { data, error } = await withPostgrestTransientRetry("learn.seen-names", async () =>
      supabase
        .from("ipon_product_group_seen")
        .select("supplier_product_id, product_group")
        .eq("supplier_category_id", supplierCategoryId)
        .order("supplier_product_id", { ascending: true })
        .range(offset, offset + DB_PAGE - 1)
    );
    if (error) throw new Error(`seen names: ${error.message}`);
    const page = (data ?? []) as Array<{ product_group: string | null }>;
    for (const row of page) {
      const name = row.product_group?.trim();
      if (name) names.add(name);
    }
    if (page.length < DB_PAGE) break;
    offset += page.length;
  }

  const { error: deleteGroupsError } = await supabase
    .from("ipon_product_groups")
    .delete()
    .eq("supplier_category_id", supplierCategoryId);
  if (deleteGroupsError) throw new Error(`product groups delete: ${deleteGroupsError.message}`);

  const groupRows = Array.from(names).map((product_group) => ({
    supplier_category_id: supplierCategoryId,
    product_group
  }));
  for (let i = 0; i < groupRows.length; i += DB_CHUNK) {
    const { error } = await supabase.from("ipon_product_groups").insert(groupRows.slice(i, i + DB_CHUNK));
    if (error) throw new Error(`product groups insert: ${error.message}`);
  }

  const learnedAt = new Date().toISOString();
  const { error: stampError } = await supabase
    .from("supplier_categories")
    .update({ product_group_learned_at: learnedAt, updated_at: learnedAt })
    .eq("id", supplierCategoryId);
  if (stampError) throw new Error(`learned stamp: ${stampError.message}`);

  const { error: clearError } = await supabase
    .from("ipon_product_group_seen")
    .delete()
    .eq("supplier_category_id", supplierCategoryId);
  if (clearError) throw new Error(`seen clear: ${clearError.message}`);

  return Array.from(names);
}

export async function learnProductGroups(
  supabase: SupabaseClient,
  rows: IponMappedCategory[],
  jar: Map<string, string>,
  session: MutableSession
): Promise<LearnProductGroupsResult> {
  let learned = 0;
  let skippedEmpty = 0;
  let requests = 0;
  let captcha = false;

  for (const row of rows) {
    if (captcha) break;
    if (row.productGroupLearnedAt) continue;

    const productIds = Array.from(new Set(await loadCategoryProductIds(supabase, row.internalCategoryId)));
    if (productIds.length === 0) {
      skippedEmpty += 1;
      console.log(`[iPon groups] ${row.groupKey ?? row.id}: nema postojećih artikala, čeka ručni import.`);
      continue;
    }

    const seen = await loadSeenIds(supabase, row.id);
    const remaining = productIds.filter((id) => !seen.has(id));
    console.log(
      `[iPon groups] ${row.groupKey ?? row.id}: ${productIds.length} artikala, pročitano ${seen.size}, ostalo ${remaining.length}`
    );

    for (let offset = 0; offset < remaining.length; offset += IPON_TRACKING_BATCH_SIZE) {
      if (captcha) break;
      const slice = remaining.slice(offset, offset + IPON_TRACKING_BATCH_SIZE);
      if (requests > 0) await pauseBetweenIponCalls();
      requests += 1;
      try {
        const tracked = await trackBatch(slice, jar, session);
        if (tracked.missing.length > 0) requests += 1;
        const byId = new Map(tracked.products.map((product) => [product.id, product.productGroup?.trim() || null]));
        const seenRows = slice.map((id) => ({
          supplier_product_id: id,
          product_group: byId.has(id) ? byId.get(id) ?? null : null
        }));
        await saveSeen(supabase, row.id, seenRows);
        for (const id of slice) seen.add(id);
      } catch (error) {
        if (error instanceof IponCaptchaError) {
          captcha = true;
          console.warn(`[iPon groups] ${row.groupKey ?? row.id}: captcha, kategorija ostaje nesnimljena.`);
          break;
        }
        throw error;
      }
    }

    if (captcha) break;
    if (seen.size < productIds.length) continue;

    const names = await finalizeCategory(supabase, row.id);
    row.productGroupLearnedAt = new Date().toISOString();
    row.productGroups = names;
    learned += 1;
    console.log(`[iPon groups] ${row.groupKey ?? row.id}: snimljeno ${names.length} naziva.`);
  }

  return { learned, skippedEmpty, requests, captcha };
}
