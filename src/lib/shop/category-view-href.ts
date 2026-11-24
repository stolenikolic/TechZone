export type CategoryLinkRow = {
  id: string;
  slug: string;
  parent_id: string | null;
  view_source_category_id?: string | null;
  view_filter_attribute_slug?: string | null;
  view_filter_value?: string | null;
};

export function indexCategoryLinks(rows: CategoryLinkRow[]): Map<string, CategoryLinkRow> {
  return new Map(rows.map((row) => [row.id, row]));
}

export function isCategoryViewPointer(row: {
  view_source_category_id?: string | null;
  view_filter_attribute_slug?: string | null;
  view_filter_value?: string | null;
}): boolean {
  return Boolean(
    row.view_source_category_id &&
      row.view_filter_attribute_slug?.trim() &&
      row.view_filter_value?.trim()
  );
}

export function categoryPathForId(
  id: string,
  byId: Map<string, CategoryLinkRow>
): string | null {
  const parts: string[] = [];
  const seen = new Set<string>();
  let current = byId.get(id);

  while (current) {
    if (seen.has(current.id)) return null;
    seen.add(current.id);
    parts.push(current.slug);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }

  return parts.reverse().join("/");
}

/** Menu and card target. Pointers open the source category with the attribute query. */
export function categoryPublicHref(
  row: CategoryLinkRow,
  byId: Map<string, CategoryLinkRow>
): string {
  if (isCategoryViewPointer(row) && row.view_source_category_id) {
    const sourcePath = categoryPathForId(row.view_source_category_id, byId);
    const attributeSlug = row.view_filter_attribute_slug?.trim();
    const attributeValue = row.view_filter_value?.trim();
    if (sourcePath && attributeSlug && attributeValue) {
      const params = new URLSearchParams();
      params.set(attributeSlug, attributeValue);
      return `/kategorije/${sourcePath}?${params.toString()}`;
    }
  }

  const ownPath = categoryPathForId(row.id, byId);
  return `/kategorije/${ownPath ?? row.slug}`;
}
