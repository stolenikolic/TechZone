import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";

/** Category tree item: nested children in `parent`. Same shape as market-2 for navbar compatibility. */
export type CategoryTreeItem = {
  id: string;
  name: string;
  slug: string;
  icon: null;
  image: string;
  description: null;
  parent: CategoryTreeItem[];
};

type DbCategory = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  image_url: string | null;
};

type TreeNode = DbCategory & { children: TreeNode[] };

/**
 * Builds a full tree from flat rows using parent_id.
 * Roots have parent_id null; children are attached to their parent's children array.
 * Sorts each level by name.
 */
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

  const sortByName = (a: TreeNode, b: TreeNode) => a.name.localeCompare(b.name);
  const sortTree = (nodes: TreeNode[]): void => {
    nodes.sort(sortByName);
    nodes.forEach((n) => sortTree(n.children));
  };
  sortTree(roots);

  return roots;
}

const DEFAULT_CATEGORY_IMAGE = "/assets/images/categories/default-category.jpg";

const LOCAL_CATEGORY_IMAGES: Record<string, string> = {
  "racunarske-komponente": "/assets/images/categories/racunarske-komponente.webp",
  "graficke-kartice": "/assets/images/categories/graficke-kartice.webp",
  "hard-diskovi": "/assets/images/categories/hard-diskovi.webp",
  "maticne-ploce": "/assets/images/categories/maticne-ploce.webp",
  procesori: "/assets/images/categories/procesori.webp",
  ssd: "/assets/images/categories/ssd.webp"
};

function toTreeItem(node: TreeNode): CategoryTreeItem {
  return {
    id: node.id,
    name: node.name,
    slug: node.slug,
    icon: null,
    image: LOCAL_CATEGORY_IMAGES[node.slug] ?? node.image_url ?? DEFAULT_CATEGORY_IMAGE,
    description: null,
    parent: node.children.map(toTreeItem),
  };
}

/**
 * GET /api/categories
 * Returns the full category tree from the database for the navbar dropdown.
 * Ordered by name at each level of the hierarchy.
 */
export async function GET() {
  try {
    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id, image_url")
      .order("name");

    if (error) {
      console.error("[api/categories]", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as DbCategory[];
    const treeRoots = buildCategoryTree(rows);
    const body: CategoryTreeItem[] = treeRoots.map(toTreeItem);

    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api/categories]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
