import type LayoutModel from "models/Layout.model";
import type { CategoryMenuItem } from "models/Category.model";
import type { Menu } from "models/Navigation.model";
import {
  createSupabaseClient,
  createSupabaseServiceClient,
  hasSupabasePublicConfig,
  hasSupabaseServerConfig
} from "utils/supabase";

type DbCategory = { id: string; name: string; slug: string; parent_id: string | null };
type TreeNode = DbCategory & { children: TreeNode[] };

const CATEGORY_ICON_BY_SLUG: Record<string, string> = {
  "racunarske-komponente": "Microchip"
};

const MAIN_NAVIGATION: Menu[] = [
  { title: "Početna", url: "/", megaMenu: false, megaMenuWithSub: false },
  { title: "Kategorije", url: "/categories", megaMenu: false, megaMenuWithSub: false },
  { title: "Akcije", url: "#", megaMenu: false, megaMenuWithSub: false },
  { title: "Najprodavanije", url: "#", megaMenu: false, megaMenuWithSub: false },
  { title: "Novo u ponudi", url: "#", megaMenu: false, megaMenuWithSub: false },
  { title: "Za firme", url: "#", megaMenu: false, megaMenuWithSub: false },
  { title: "Kako naručiti", url: "#", megaMenu: false, megaMenuWithSub: false },
  { title: "Kontakt", url: "#", megaMenu: false, megaMenuWithSub: false }
];

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

function toCategoryMenuItem(node: TreeNode, pathPrefix: string[] = []): CategoryMenuItem {
  const pathSegments = [...pathPrefix, node.slug];
  const href = `/categories/${pathSegments.join("/")}`;

  return {
    href,
    title: node.name,
    ...(CATEGORY_ICON_BY_SLUG[node.slug] ? { icon: CATEGORY_ICON_BY_SLUG[node.slug] } : {}),
    ...(node.children.length > 0
      ? { children: node.children.map((child) => toCategoryMenuItem(child, pathSegments)) }
      : {})
  };
}

function createLayout(categories: LayoutModel["header"]["categories"], categoryMenus: CategoryMenuItem[]): LayoutModel {
  return {
    footer: {
      logo: "/assets/images/logo.svg",
      description: "Tech Zone - your one-stop shop.",
      appStoreUrl: "#",
      playStoreUrl: "#",
      about: [],
      customers: [],
      socials: {
        google: "",
        twitter: "",
        youtube: "",
        facebook: "",
        instagram: ""
      },
      contact: {
        phone: "",
        email: "",
        address: ""
      }
    },
    header: {
      logo: "/assets/images/logo.svg",
      categories,
      categoryMenus,
      navigation: MAIN_NAVIGATION
    },
    topbar: {
      title: "Welcome",
      label: "",
      socials: {},
      languageOptions: {
        en: { title: "English", value: "en" }
      }
    },
    mobileNavigation: {
      logo: "/assets/images/logo.svg",
      version1: [],
      version2: []
    }
  };
}

export async function getLayoutData(): Promise<LayoutModel> {
  if (!hasSupabaseServerConfig() && !hasSupabasePublicConfig()) {
    return createLayout([], []);
  }

  const supabase = hasSupabaseServerConfig()
    ? createSupabaseServiceClient()
    : createSupabaseClient();

  try {
    const { data: rootCategories } = await supabase
      .from("categories")
      .select("id, name, slug")
      .is("parent_id", null)
      .order("name");

    const mappedCategories = (rootCategories ?? []).map((row) => ({
      title: row.name,
      value: row.slug
    }));

    const { data: allCategories } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id")
      .order("name");

    const rows = (allCategories ?? []) as DbCategory[];
    const treeRoots = buildCategoryTree(rows);
    const builtMenu: CategoryMenuItem[] = treeRoots.map((root) => ({
      ...toCategoryMenuItem(root),
      component: "List"
    }));

    return createLayout(mappedCategories, builtMenu);
  } catch (error) {
    console.error("[layout-data]", error);
    return createLayout([], []);
  }
}
