import type Blog from "models/Blog.model";
import type Brand from "models/Brand.model";
import type Service from "models/Service.model";
import type Shop from "models/Shop.model";

export const HOMEPAGE_SERVICES: Service[] = [
  { id: "1", icon: "Truck", title: "Fast Delivery", description: "Start from $10" },
  { id: "2", icon: "MoneyGuarantee", title: "Money Guarantee", description: "7 Days Back" },
  { id: "3", icon: "AlarmClock", title: "365 Days", description: "For free return" },
  { id: "4", icon: "Payment", title: "Payment", description: "Secure system" }
];

export const HOMEPAGE_BRANDS: Brand[] = [
  { id: "brand-1", slug: "adidas", name: "Adidas", image: "/assets/images/brands/adidas.png", type: "mobile" },
  { id: "brand-2", slug: "chanel", name: "Chanel", image: "/assets/images/brands/chanel.png", type: "mobile" },
  { id: "brand-3", slug: "puma", name: "Puma", image: "/assets/images/brands/puma.png", type: "mobile" },
  { id: "brand-4", slug: "louis-vuitton", name: "Louis Vuitton", image: "/assets/images/brands/louis-vuitton.png", type: "mobile" },
  { id: "brand-5", slug: "gucci", name: "Gucci", image: "/assets/images/brands/gucci.png", type: "mobile" },
  { id: "brand-6", slug: "lacoste", name: "Lacoste", image: "/assets/images/brands/lacoste.png", type: "optics" }
];

export const HOMEPAGE_SHOPS: (Shop & { thumbnail?: string })[] = [
  {
    id: "shop-1",
    slug: "tech-store",
    thumbnail: "herman miller",
    user: {
      id: "user-1",
      email: "contact@techstore.com",
      phone: "",
      avatar: "/assets/images/avatars/001-man.svg",
      password: "",
      dateOfBirth: "",
      verified: true,
      name: { firstName: "Tech", lastName: "Store" }
    },
    email: "contact@techstore.com",
    name: "Tech Store",
    phone: "",
    address: "",
    verified: true,
    coverPicture: "/assets/images/banners/banner-6.png",
    profilePicture: "/assets/images/faces/propic.png",
    socialLinks: { facebook: null, youtube: null, twitter: null, instagram: null }
  },
  {
    id: "shop-2",
    slug: "gadget-hub",
    thumbnail: "otobi",
    user: {
      id: "user-2",
      email: "info@gadgethub.com",
      phone: "",
      avatar: "/assets/images/avatars/002-girl.svg",
      password: "",
      dateOfBirth: "",
      verified: true,
      name: { firstName: "Gadget", lastName: "Hub" }
    },
    email: "info@gadgethub.com",
    name: "Gadget Hub",
    phone: "",
    address: "",
    verified: true,
    coverPicture: "/assets/images/banners/banner.png",
    profilePicture: "/assets/images/faces/propic(1).png",
    socialLinks: { facebook: null, youtube: null, twitter: null, instagram: null }
  }
];

export const HOMEPAGE_ARTICLES: Blog[] = [
  {
    id: "article-1",
    slug: "coastal-charm-a-lone-seagull-s-morning",
    title: "Coastal Charm: A Lone Seagull's Morning",
    createdAt: "21 SEP",
    thumbnail: "/assets/images/blogs/blog-1.jpg",
    description: "Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Phasellus hendrerit.…"
  },
  {
    id: "article-2",
    slug: "serenity-on-the-water",
    title: "Serenity on the Water: A Glimpse into Nature's Calm",
    createdAt: "21 SEP",
    thumbnail: "/assets/images/blogs/blog-2.jpg",
    description: "Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Phasellus hendrerit.…"
  },
  {
    id: "article-3",
    slug: "tech-tips-and-tricks",
    title: "Tech Tips and Tricks for Everyday Use",
    createdAt: "20 SEP",
    thumbnail: "/assets/images/blogs/blog-1.jpg",
    description: "Discover the latest tips to get the most out of your devices."
  }
];

export const HOMEPAGE_CLIENTS: Brand[] = [
  { id: "client-1", slug: "alibaba", name: "AliBaba", image: "/assets/images/brands/alibaba.png", type: "fashion" },
  { id: "client-2", slug: "levis", name: "Levis", image: "/assets/images/brands/levis.png", type: "fashion" },
  { id: "client-3", slug: "lotto", name: "Lotto", image: "/assets/images/brands/lotto.png", type: "fashion" },
  { id: "client-4", slug: "raymond", name: "Raymond", image: "/assets/images/brands/raymond.png", type: "fashion" },
  { id: "client-5", slug: "samsung", name: "Samsung", image: "/assets/images/brands/samsung.png", type: "fashion" }
];
