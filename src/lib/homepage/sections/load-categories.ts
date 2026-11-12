import { categoryImageDisplayUrl } from "lib/images/category-display-url";
import {
  categoryPublicHref,
  indexCategoryLinks,
  type CategoryLinkRow
} from "lib/shop/category-view-href";
import { createSupabaseServiceClient } from "utils/supabase";

export type HomepageCategoryItem = {
  id: string;
  name: string;
  slug: string;
  href: string;
  icon: null;
  image: string;
  description: null;
  parent: HomepageCategoryItem[];
};

type DbCategory = CategoryLinkRow & {
  name: string;
  image_url: string | null;
};

type TreeNode = DbCategory & { children: TreeNode[] };

function buildCategoryTree(rows: DbCategory[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();

  for (const row of rows) {
    byId.set(row.id, { ...row, children: [] });
  }

  const roots: TreeNode[] = [];

  for (const row of rows) {
    const node = byId.get(row.id)!;
    if (row.parent_id == null) {
      roots.push(node);
    } else {
      const parent = byId.get(row.parent_id);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }

  return roots;
}

const DEFAULT_CATEGORY_IMAGE = "/assets/images/categories/default-category.jpg";

function toHomepageCategoryItem(
  node: TreeNode,
  byId: Map<string, CategoryLinkRow>
): HomepageCategoryItem {
  return {
    id: node.id,
    name: node.name,
    slug: node.slug,
    href: categoryPublicHref(node, byId),
    icon: null,
    image: categoryImageDisplayUrl(node.image_url?.trim() || DEFAULT_CATEGORY_IMAGE),
    description: null,
    parent: node.children.map((child) => toHomepageCategoryItem(child, byId))
  };
}

export async function loadHomepageCategories(): Promise<HomepageCategoryItem[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("categories")
    .select(
      "id, name, slug, parent_id, image_url, view_source_category_id, view_filter_attribute_slug, view_filter_value"
    )
    .order("name");

  if (error) {
    console.error("[homepage/categories]", error.message);
    return [];
  }

  const rows = (data ?? []) as DbCategory[];
  const linkById = indexCategoryLinks(rows);
  return buildCategoryTree(rows).map((root) => toHomepageCategoryItem(root, linkById));
}
