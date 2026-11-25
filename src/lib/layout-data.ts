import type LayoutModel from "models/Layout.model";
import type { CategoryMenuItem } from "models/Category.model";
import type { Menu } from "models/Navigation.model";
import { mobileNavigation as mobileNavigationItems } from "data/layout-data";
import {
  categoryPublicHref,
  indexCategoryLinks,
  type CategoryLinkRow
} from "lib/shop/category-view-href";
import { siteContact } from "lib/site-contact";
import {
  createSupabaseClient,
  createSupabaseServiceClient,
  hasSupabasePublicConfig,
  hasSupabaseServerConfig
} from "utils/supabase";

type DbCategory = CategoryLinkRow & { name: string; sort_order: number };
type TreeNode = DbCategory & { children: TreeNode[] };

function compareCategoryOrder(a: DbCategory, b: DbCategory): number {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
}

const CATEGORY_ICON_BY_SLUG: Record<string, string> = {
  "racunarske-komponente": "Microchip",
  "racunarska-periferija": "Headset",
  "televizori-projektori-vr": "Desktop",
  "mreza-serveri-sigurnost": "HouseSignal",
  "konzole-i-gaming": "Robot",
  "audio-i-multimedija": "MicrophoneLines",
  "telefoni-tableti-pametni-uredjaji": "MobileNotch",
  "foto-video-dronovi": "Camera",
  "racunarski-dodaci-softver": "Gear",
  "laptopi-racunari": "Laptop"
};

const MAIN_NAVIGATION: Menu[] = [
  { title: "Početna", url: "/", megaMenu: false, megaMenuWithSub: false },
  { title: "Kategorije", url: "/kategorije", megaMenu: false, megaMenuWithSub: false },
  { title: "Laptopi i računari", url: "/kategorije/laptopi-racunari", megaMenu: false, megaMenuWithSub: false },
  { title: "Računarske komponente", url: "/kategorije/racunarske-komponente", megaMenu: false, megaMenuWithSub: false },
  { title: "Kako naručiti", url: "/kako-naruciti", megaMenu: false, megaMenuWithSub: false },
  { title: "Kontakt", url: "/kontakt", megaMenu: false, megaMenuWithSub: false }
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

  const sortTree = (nodes: TreeNode[]): void => {
    nodes.sort(compareCategoryOrder);
    nodes.forEach((node) => sortTree(node.children));
  };
  sortTree(roots);

  return roots;
}

function toCategoryMenuItem(
  node: TreeNode,
  byId: Map<string, CategoryLinkRow>
): CategoryMenuItem {
  return {
    href: categoryPublicHref(node, byId),
    title: node.name,
    ...(CATEGORY_ICON_BY_SLUG[node.slug] ? { icon: CATEGORY_ICON_BY_SLUG[node.slug] } : {}),
    ...(node.children.length > 0
      ? { children: node.children.map((child) => toCategoryMenuItem(child, byId)) }
      : {})
  };
}

function createLayout(categories: LayoutModel["header"]["categories"], categoryMenus: CategoryMenuItem[]): LayoutModel {
  return {
    footer: {
      logo: "/assets/images/logo.svg",
      description:
        "Tech Zone - Sva tehnologija na jednom mjestu.",
      appStoreUrl: "",
      playStoreUrl: "",
      about: [
        { title: "O nama", url: "/o-nama" },
        { title: "Uslovi kupovine", url: "/uslovi-kupovine" },
        { title: "Politika privatnosti", url: "/politika-privatnosti" }
      ],
      customers: [
        { title: "Kako naručiti", url: "/kako-naruciti" },
        { title: "Dostava", url: "/dostava" },
        { title: "Plaćanje", url: "/nacin-placanja" },
        { title: "Reklamacije i povrat", url: "/reklamacije" }
      ],
      socials: {
        google: "",
        twitter: "",
        youtube: "",
        facebook: "",
        instagram: ""
      },
      contact: {
        phone: siteContact.phoneDisplay,
        email: siteContact.email,
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
      title: "",
      label: "",
      socials: {},
      languageOptions: {}
    },
    mobileNavigation: {
      logo: "/assets/images/logo.svg",
      version1: mobileNavigationItems,
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
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    const mappedCategories = (rootCategories ?? []).map((row) => ({
      title: row.name,
      value: row.slug
    }));

    const { data: allCategories } = await supabase
      .from("categories")
      .select(
        "id, name, slug, parent_id, sort_order, view_source_category_id, view_filter_attribute_slug, view_filter_value"
      )
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    const rows = (allCategories ?? []) as DbCategory[];
    const linkById = indexCategoryLinks(rows);
    const treeRoots = buildCategoryTree(rows);
    const builtMenu: CategoryMenuItem[] = treeRoots.map((root) => {
      const item = toCategoryMenuItem(root, linkById);
      return {
        ...item,
        ...(item.children?.length ? { component: "List" as const } : {})
      };
    });

    return createLayout(mappedCategories, builtMenu);
  } catch (error) {
    console.error("[layout-data]", error);
    return createLayout([], []);
  }
}
