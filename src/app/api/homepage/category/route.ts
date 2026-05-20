import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";

/** Homepage category item (top-level only in this API). */
export type HomepageCategoryItem = {
  id: string;
  name: string;
  icon: null;
  image: null;
  slug: string;
  parent: HomepageCategoryItem[];
  description: null;
};

type DbCategory = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
};

/**
 * Builds a tree from flat rows using parent_id.
 * - Creates a map of id -> node (with a children array).
 * - Attaches each node to its parent's children (or keeps as root if parent_id is null).
 * - Returns roots: nodes that have no parent (parent_id === null).
 */
function buildCategoryTree(rows: DbCategory[]): DbCategory[] {
  const byId = new Map<string, DbCategory & { children: DbCategory[] }>();

  for (const row of rows) {
    byId.set(row.id, { ...row, children: [] });
  }

  const roots: (DbCategory & { children: DbCategory[] })[] = [];

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

function toHomepageCategoryItem(category: DbCategory): HomepageCategoryItem {
  return {
    id: category.id,
    name: category.name,
    icon: null,
    image: null,
    slug: category.slug,
    parent: [],
    description: null,
  };
}

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id")
      .order("name");

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as DbCategory[];
    const treeRoots = buildCategoryTree(rows);
    const body: HomepageCategoryItem[] = treeRoots.map(toHomepageCategoryItem);

    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
