/**
 * Pure classification of one new feed product into an internal category.
 * A hand-entered path wins. Otherwise the first two Hungarian levels select
 * one iPon list, and a shared or filtered list is resolved by membership.
 */

import { splitFeedPath } from "./productFeed";

export type IponMembershipStatus = "complete" | "incomplete" | "failed";

export type IponMappedCategory = {
  id: string;
  internalCategoryId: string;
  categoryName: string | null;
  /** iPon group id stored in supplier_categories.supplier_category_key. */
  groupKey: string | null;
  listingUrl: string | null;
  /** Kept for the unused path learner. Classification does not read it. */
  feedCategoryPath: string | null;
  /** Hand-entered feed path. Two or more whole levels. */
  manualFeedPath: string | null;
  filtered: boolean;
  /** English productGroup values. Nightly classification does not read them. */
  productGroups: string[];
  /** True only after this run finished reading the iPon link. */
  listReady: boolean;
  /** Set when every existing id in the category has been read. */
  productGroupLearnedAt: string | null;
  membershipStatus: IponMembershipStatus | null;
  membershipSyncedAt: string | null;
};

export type ClassifyFeedInput = {
  categoryPath: string | null;
  /** iPon list id of the plain two-level menu node. Null when the menu has no node. */
  menuListId: string | null;
  /** supplier_categories.id values whose list contained this iPon id. */
  membershipCategoryIds: string[];
  rows: IponMappedCategory[];
};

export type ClassifyDeferStatus = "pending" | "ambiguous" | "unclassified" | "no_tracking";

export type ClassifyFeedResult =
  | { kind: "assign"; internalCategoryId: string; supplierCategoryId: string }
  | {
      kind: "defer";
      reason: string;
      status: ClassifyDeferStatus;
      candidateCategoryIds: string[];
      /** Path stored on the pending row so the next night can skip tracking. */
      path?: string;
    };

function defer(
  reason: string,
  status: ClassifyDeferStatus,
  candidateCategoryIds: string[],
  path?: string
): ClassifyFeedResult {
  return { kind: "defer", reason, status, candidateCategoryIds, ...(path ? { path } : {}) };
}

function assign(row: IponMappedCategory): ClassifyFeedResult {
  return { kind: "assign", internalCategoryId: row.internalCategoryId, supplierCategoryId: row.id };
}

function pathCovers(manual: string[], product: string[]): boolean {
  if (manual.length < 2 || manual.length > product.length) return false;
  return manual.every((part, index) => part === product[index]);
}

export type ManualPathMatch =
  | { kind: "none" }
  | { kind: "assign"; row: IponMappedCategory }
  | { kind: "ambiguous"; path: string; rows: IponMappedCategory[] };

/** Longest hand-entered path that covers the feed path as whole levels. */
export function matchManualFeedPath(
  rows: IponMappedCategory[],
  categoryPath: string | null
): ManualPathMatch {
  const product = splitFeedPath(categoryPath);
  if (product.length < 2) return { kind: "none" };

  let bestLength = 0;
  let best: IponMappedCategory[] = [];
  for (const row of rows) {
    if (!row.manualFeedPath) continue;
    const manual = splitFeedPath(row.manualFeedPath);
    if (!pathCovers(manual, product)) continue;
    if (manual.length > bestLength) {
      bestLength = manual.length;
      best = [row];
    } else if (manual.length === bestLength) {
      best.push(row);
    }
  }

  if (best.length === 0 || bestLength < 2) return { kind: "none" };
  const path = splitFeedPath(best[0]?.manualFeedPath).slice(0, bestLength).join(" > ");
  if (best.length > 1) return { kind: "ambiguous", path, rows: best };
  return { kind: "assign", row: best[0]! };
}

export function ownersForListId(rows: IponMappedCategory[], menuListId: string | null): IponMappedCategory[] {
  const listId = menuListId?.trim() ?? "";
  if (!listId) return [];
  return rows.filter((row) => row.groupKey === listId);
}

/** A single plain category is decided by the list id. Filters and shared lists need the iPon link. */
export function needsListCheck(owners: IponMappedCategory[]): boolean {
  return !(owners.length === 1 && owners[0] != null && !owners[0].filtered);
}

export function classifyFeedProduct(input: ClassifyFeedInput): ClassifyFeedResult {
  const manual = matchManualFeedPath(input.rows, input.categoryPath);
  if (manual.kind === "assign") return assign(manual.row);
  if (manual.kind === "ambiguous") {
    return defer(
      "ambiguous_path",
      "ambiguous",
      manual.rows.map((row) => row.id),
      manual.path
    );
  }

  const parts = splitFeedPath(input.categoryPath);
  if (parts.length < 2) {
    const raw = input.categoryPath?.trim();
    return defer("unknown_path", "pending", [], raw || "(bez putanje)");
  }

  const twoLevel = `${parts[0]} > ${parts[1]}`;
  const owners = ownersForListId(input.rows, input.menuListId);
  if (!input.menuListId?.trim() || owners.length === 0) return defer("unknown_path", "pending", [], twoLevel);

  const plain = owners.filter((row) => !row.filtered);
  const filters = owners.filter((row) => row.filtered);

  if (owners.length === 1 && plain.length === 1) return assign(plain[0]!);

  if (owners.some((row) => !row.listReady)) {
    return defer(
      "awaiting_list",
      "pending",
      owners.map((row) => row.id),
      twoLevel
    );
  }

  const memberIds = new Set(input.membershipCategoryIds);
  const linkOwners = filters.length > 0 ? filters : owners;
  const hits = linkOwners.filter((row) => memberIds.has(row.id));

  if (hits.length > 1) {
    return defer(
      "ambiguous",
      "ambiguous",
      hits.map((row) => row.id),
      twoLevel
    );
  }
  if (hits.length === 1) return assign(hits[0]!);

  if (filters.length > 0 && plain.length === 1 && filters.length === owners.length - 1) {
    return assign(plain[0]!);
  }
  return defer(
    "not_on_list",
    "unclassified",
    owners.map((row) => row.id),
    twoLevel
  );
}
