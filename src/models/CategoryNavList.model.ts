export interface CategoryNavItem {
  icon: string;
  title: string;
  href?: string;
  child?: { title: string; href: string }[];
}

export default interface CategoryNavList {
  category: string;
  categoryItem: CategoryNavItem[];
}
