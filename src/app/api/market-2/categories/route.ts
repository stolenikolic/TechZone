import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";

/** Bazaar Market-2 category item with nested children in `parent`. */
export type Market2CategoryItem = {
  id: string;
  name: string;
  slug: string;
  icon: null;
  image: string;
  description: null;
  parent: Market2CategoryItem[];
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
 * - Creates a map of id -> node (with a children array).
 * - Attaches each node to its parent's children; nodes with parent_id null are roots.
 * - Returns root nodes; each node's children are populated recursively.
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

function toMarket2Item(node: TreeNode): Market2CategoryItem {
  return {
    id: node.id,
    name: node.name,
    slug: node.slug,
    icon: null,
    image: LOCAL_CATEGORY_IMAGES[node.slug] ?? node.image_url ?? DEFAULT_CATEGORY_IMAGE,
    description: null,
    parent: node.children.map(toMarket2Item),
  };
}

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id, image_url")
      .order("name");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as DbCategory[];
    const treeRoots = buildCategoryTree(rows);
    const body: Market2CategoryItem[] = treeRoots.map(toMarket2Item);

    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
