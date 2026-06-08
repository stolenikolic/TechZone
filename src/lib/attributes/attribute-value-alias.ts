/**
 * Manual attribute value aliases: apply only when admin defined alias → canonical_label.
 * Unknown raw values pass through unchanged (trim only).
 */

export type AttributeValueAliasRow = {
  id: string;
  attributeId: string;
  alias: string;
  canonicalLabel: string;
  matchMode: "exact" | "contains" | "regex";
  supplierId: string | null;
  priority: number;
  isActive: boolean;
};

export type AttributeValueAliasDbRow = {
  id: string;
  attribute_id: string;
  alias: string;
  canonical_label: string;
  match_mode: string;
  supplier_id: string | null;
  priority: number;
  is_active: boolean;
};

export function mapAttributeValueAliasRow(row: AttributeValueAliasDbRow): AttributeValueAliasRow {
  const matchMode = row.match_mode;
  const mode: AttributeValueAliasRow["matchMode"] =
    matchMode === "contains" || matchMode === "regex" ? matchMode : "exact";
  return {
    id: row.id,
    attributeId: row.attribute_id,
    alias: row.alias,
    canonicalLabel: row.canonical_label,
    matchMode: mode,
    supplierId: row.supplier_id,
    priority: row.priority ?? 100,
    isActive: row.is_active !== false
  };
}

function aliasMatches(raw: string, alias: string, mode: AttributeValueAliasRow["matchMode"]): boolean {
  const r = raw.trim();
  const a = alias.trim();
  if (!r || !a) return false;
  if (mode === "exact") return r.toLowerCase() === a.toLowerCase();
  if (mode === "contains") return r.toLowerCase().includes(a.toLowerCase());
  try {
    return new RegExp(a, "i").test(r);
  } catch {
    return false;
  }
}

function sortedActiveAliases(
  aliasRows: AttributeValueAliasRow[],
  supplierId?: string | null
): AttributeValueAliasRow[] {
  return aliasRows
    .filter((row) => row.isActive)
    .sort((a, b) => {
      const aSpecific = a.supplierId ? 0 : 1;
      const bSpecific = b.supplierId ? 0 : 1;
      if (aSpecific !== bSpecific) return aSpecific - bSpecific;
      if (a.supplierId && b.supplierId && a.supplierId !== b.supplierId) {
        const aMatch = supplierId && a.supplierId === supplierId ? 0 : 1;
        const bMatch = supplierId && b.supplierId === supplierId ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }
      return a.priority - b.priority;
    });
}

/** Returns the first matching manual alias row, if any. */
export function findMatchingAttributeValueAlias(
  rawValue: string,
  aliasRows: AttributeValueAliasRow[],
  supplierId?: string | null
): AttributeValueAliasRow | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  for (const row of sortedActiveAliases(aliasRows, supplierId)) {
    if (row.supplierId && supplierId && row.supplierId !== supplierId) continue;
    if (aliasMatches(trimmed, row.alias, row.matchMode)) return row;
  }

  return null;
}

/**
 * If a manual alias matches, returns canonical_label; otherwise returns trimmed raw unchanged.
 */
export function applyAttributeValueAlias(
  rawValue: string,
  aliasRows: AttributeValueAliasRow[],
  supplierId?: string | null
): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const matched = findMatchingAttributeValueAlias(trimmed, aliasRows, supplierId);
  if (matched) return matched.canonicalLabel.trim();

  return trimmed;
}
