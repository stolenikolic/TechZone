export default interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  image?: string;
  parent: string[];
  featured?: boolean;
  description?: string;
}

export interface CategoryOffer {
  url: string;
  href: string;
  position: "right" | "bottom";
}

export interface CategoryMenuItem {
  href: string;
  title: string;
  icon?: string;
  offer?: CategoryOffer;
  children?: CategoryMenuItem[];
  component?: "Grid" | "List";
}
