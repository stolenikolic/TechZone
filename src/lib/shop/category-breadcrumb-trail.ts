import type { CategoryTreeNode } from "pages-sections/categories";

export type CategoryBreadcrumbSegment = {
  name: string;
  /** Path without leading slash, e.g. parent/child */
  slugPath: string;
};

/**
 * Gradi lanac kategorija od korijena stabla do zadatih slug segmenata (isti obhod kao findCategoryNode).
 */
export function getCategoryBreadcrumbTrail(
  categories: CategoryTreeNode[],
  pathSegments: string[]
): CategoryBreadcrumbSegment[] {
  const trail: CategoryBreadcrumbSegment[] = [];
  let level = categories ?? [];
  const acc: string[] = [];

  for (const segment of pathSegments) {
    const node = level.find((item) => item.slug === segment);
    if (!node) break;
    acc.push(segment);
    trail.push({ name: node.name, slugPath: acc.join("/") });
    level = node.parent ?? [];
  }

  return trail;
}
