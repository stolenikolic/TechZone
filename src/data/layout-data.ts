// CUSTOM ICON COMPONENTS
import Home from "icons/Home";
import User2 from "icons/User2";
import CategoryOutlined from "icons/CategoryOutline";
import ShoppingBagOutlined from "icons/ShoppingBagOutlined";

// TOP BAR SOCIAL LINKS
export const topbarSocialLinks = {
  facebook: "https://www.facebook.com/",
  twitter: "https://twitter.com/",
  instagram: "https://www.instagram.com/"
};

// TOP BAR LANGUAGE OPTIONS
export const languageOptions = {
  en: { title: "EN", value: "en" },
  es: { title: "DE", value: "de" }
};

// MOBILE NAVIGATION LIST
export const mobileNavigation = [
  { title: "Home", icon: "Home", href: "/", badge: false },
  { title: "Category", icon: "CategoryOutlined", href: "/products/search", badge: false },
  { title: "Cart", icon: "ShoppingBagOutlined", href: "/cart", badge: true },
  { title: "Account", icon: "User2", href: "/profile", badge: false }
];

// MOBILE NAVIGATION LIST
export const mobileNavigationTwo = [
  { title: "Home", Icon: Home, href: "/", badge: false },
  { title: "Category", Icon: CategoryOutlined, href: "", badge: false },
  { title: "Cart", Icon: ShoppingBagOutlined, href: "/cart", badge: true },
  { title: "Account", Icon: User2, href: "/profile", badge: false }
];

// CATEGORY LIST FOR HEADER
export const categories = [
  { title: "All Categories", value: "" },
  { title: "Car", value: "car" },
  { title: "Clothes", value: "clothes" },
  { title: "Electronics", value: "electronics" },
  { title: "Laptop", value: "laptop" },
  { title: "Desktop", value: "desktop" },
  { title: "Camera", value: "camera" },
  { title: "Toys", value: "toys" }
];

export const footerAboutLinks = [
  { title: "Careers", url: "#" },
  { title: "Our Stores", url: "#" },
  { title: "Our Cares", url: "#" },
  { title: "Terms & Conditions", url: "#" },
  { title: "Privacy Policy", url: "#" }
];

export const footerCustomerCareLinks = [
  { title: "Help Center", url: "#" },
  { title: "Track Your Order", url: "#" },
  { title: "Corporate & Bulk Purchasing", url: "#" },
  { title: "Returns & Refunds", url: "#" }
];

export const footerSocialLinks = {
  facebook: "https://www.facebook.com/",
  twitter: "https://twitter.com/",
  instagram: "https://www.instagram.com/",
  youtube: "https://www.instagram.com/",
  google: "https://www.instagram.com/"
};

export const footerDescription =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Auctor libero id et, in gravida. Sit diam duis mauris nulla cursus. Erat et lectus vel ut sollicitudin elit at amet.";
