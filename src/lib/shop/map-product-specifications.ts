import { filterApplicableSpecificationRows } from "lib/attributes/not-applicable-value";
import type { ProductSpecFilterItem } from "lib/shop/category-filter-url";

type AttributeMeta = {
  id: string;
  name: string;
  slug: string;
  filter_display_type: string | null;
};

type SpecRowInput = {
  value: string;
  attributes: AttributeMeta | AttributeMeta[] | null;
};

type CategoryAttributeRow = {
  attribute_id: string | null;
  sort_order: number | null;
  attributes: AttributeMeta | AttributeMeta[] | null;
};

function unwrapAttribute<T>(raw: T | T[] | null): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

/**
 * Map product_attributes rows to shop specifications with filter display metadata.
 */
export function mapProductSpecifications(
  specRows: SpecRowInput[],
  categoryAttributeRows: CategoryAttributeRow[] | null | undefined
): ProductSpecFilterItem[] {
  const categoryAttrIds = new Set<string>();
  const attributeSortOrder = new Map<string, number>();
  const filterDisplayByAttrId = new Map<string, "checkbox" | "range">();

  for (const row of categoryAttributeRows ?? []) {
    const attr = unwrapAttribute(row.attributes);
    if (!row.attribute_id || !attr?.slug) continue;
    categoryAttrIds.add(row.attribute_id);
    attributeSortOrder.set(row.attribute_id, row.sort_order ?? 0);
    filterDisplayByAttrId.set(
      row.attribute_id,
      attr.filter_display_type === "range" ? "range" : "checkbox"
    );
  }

  const specifications = specRows
    .map((r) => {
      const a = unwrapAttribute(r.attributes);
      return a ? { id: a.id, name: a.name, slug: a.slug, value: r.value } : null;
    })
    .filter((x): x is { id: string; name: string; slug: string; value: string } => x != null);

  const applicable = filterApplicableSpecificationRows(specifications)
    .sort((a, b) => {
      const aOrder = attributeSortOrder.get(a.id);
      const bOrder = attributeSortOrder.get(b.id);
      if (aOrder != null && bOrder != null && aOrder !== bOrder) return aOrder - bOrder;
      if (aOrder != null && bOrder == null) return -1;
      if (aOrder == null && bOrder != null) return 1;
      return a.name.localeCompare(b.name);
    })
    .map(({ id, name, slug, value }) => ({
      name,
      slug,
      value,
      ...(categoryAttrIds.has(id) && {
        filterDisplayType: filterDisplayByAttrId.get(id) ?? "checkbox"
      })
    }));

  return applicable;
}
