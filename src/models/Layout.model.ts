import { Menu } from "./Navigation.model";
import { CategoryMenuItem } from "models/Category.model";

export interface Socials {
  google: string;
  twitter: string;
  youtube: string;
  facebook: string;
  instagram: string;
}

export interface Link {
  url: string;
  title: string;
}

export interface CategoryLink {
  title: string;
  value: string;
}

export interface MobileNavItem {
  title: string;
  icon: string;
  href: string;
  badge: boolean;
}

interface LanguageOptions {
  [key: string]: { title: string; value: string };
}

interface MobileNavigation {
  logo: string;
  version1: MobileNavItem[];
  version2: MobileNavItem[];
}

export interface Footer {
  logo: string;
  description: string;
  appStoreUrl: string;
  playStoreUrl: string;
  about: Link[];
  customers: Link[];
  socials: Socials;
  contact: { phone: string; email: string; address: string };
}

export interface Topbar {
  title: string;
  label: string;
  socials: Partial<Socials>;
  languageOptions: LanguageOptions;
}

export interface Header {
  logo: string;
  categories: CategoryLink[];
  categoryMenus: CategoryMenuItem[];
  navigation: Menu[];
}

export default interface LayoutModel {
  footer: Footer;
  header: Header;
  topbar: Topbar;
  mobileNavigation: MobileNavigation;
}
