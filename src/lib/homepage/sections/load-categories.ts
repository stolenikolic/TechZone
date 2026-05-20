import { categoryImageDisplayUrl } from "lib/images/category-display-url";
import { createSupabaseServiceClient } from "utils/supabase";

export type HomepageCategoryItem = {
  id: string;
  name: string;
  slug: string;
  icon: null;
  image: string;
  description: null;
  parent: HomepageCategoryItem[];
};

type DbCategory = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
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

function toHomepageCategoryItem(node: TreeNode): HomepageCategoryItem {
  return {
    id: node.id,
    name: node.name,
    slug: node.slug,
    icon: null,
    image: categoryImageDisplayUrl(node.image_url?.trim() || DEFAULT_CATEGORY_IMAGE),
    description: null,
    parent: node.children.map(toHomepageCategoryItem)
  };
}

export async function loadHomepageCategories(): Promise<HomepageCategoryItem[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, image_url")
    .order("name");

  if (error) {
    console.error("[homepage/categories]", error.message);
    return [];
  }

  const rows = (data ?? []) as DbCategory[];
  return buildCategoryTree(rows).map(toHomepageCategoryItem);
}
