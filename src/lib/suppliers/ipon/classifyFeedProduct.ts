/**
 * Pure classification of one new feed product into an internal category.
 * The key is the English tracking productGroup. A shared name is resolved
 * by iPon list membership. Feed category text is not used.
 */

export type IponMembershipStatus = "complete" | "incomplete" | "failed";

export type IponMappedCategory = {
  id: string;
  internalCategoryId: string;
  /** iPon group id stored in supplier_categories.supplier_category_key. */
  groupKey: string | null;
  listingUrl: string | null;
  /** Kept for the unused path learner. Classification does not read it. */
  feedCategoryPath: string | null;
  filtered: boolean;
  /** English productGroup values learned from products already in this category. */
  productGroups: string[];
  /** True only after this run finished reading the iPon link. */
  listReady: boolean;
  /** Set when every existing id in the category has been read. */
  productGroupLearnedAt: string | null;
  membershipStatus: IponMembershipStatus | null;
  membershipSyncedAt: string | null;
};

export type ClassifyFeedInput = {
  productGroup: string | null;
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
    };

function defer(
  reason: string,
  status: ClassifyDeferStatus,
  candidateCategoryIds: string[]
): ClassifyFeedResult {
  return { kind: "defer", reason, status, candidateCategoryIds };
}

function assign(row: IponMappedCategory): ClassifyFeedResult {
  return { kind: "assign", internalCategoryId: row.internalCategoryId, supplierCategoryId: row.id };
}

export function ownersForProductGroup(rows: IponMappedCategory[], productGroup: string | null): IponMappedCategory[] {
  const group = productGroup?.trim() ?? "";
  if (!group) return [];
  return rows.filter((row) => row.productGroups.includes(group));
}

/** A single plain category is decided by the name. Filters and shared names need the iPon link. */
export function needsListCheck(owners: IponMappedCategory[]): boolean {
  return !(owners.length === 1 && owners[0] != null && !owners[0].filtered);
}

export function classifyFeedProduct(input: ClassifyFeedInput): ClassifyFeedResult {
  const group = input.productGroup?.trim() ?? "";
  if (!group) return defer("unknown_group", "pending", []);

  const owners = ownersForProductGroup(input.rows, group);
  if (owners.length === 0) return defer("unknown_group", "pending", []);

  const plain = owners.filter((row) => !row.filtered);
  const filters = owners.filter((row) => row.filtered);

  if (owners.length === 1 && plain.length === 1) {
    return assign(plain[0]!);
  }

  if (owners.some((row) => !row.listReady)) {
    return defer(
      "awaiting_list",
      "pending",
      owners.map((row) => row.id)
    );
  }

  const memberIds = new Set(input.membershipCategoryIds);
  const linkOwners = filters.length > 0 ? filters : owners;
  const hits = linkOwners.filter((row) => memberIds.has(row.id));

  if (hits.length > 1) {
    return defer(
      "ambiguous",
      "ambiguous",
      hits.map((row) => row.id)
    );
  }
  if (hits.length === 1) return assign(hits[0]!);

  if (filters.length > 0 && plain.length === 1 && filters.length === owners.length - 1) {
    return assign(plain[0]!);
  }
  return defer(
    "not_on_list",
    "unclassified",
    owners.map((row) => row.id)
  );
}
