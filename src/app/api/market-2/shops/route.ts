import { NextResponse } from "next/server";
import type Shop from "models/Shop.model";

type ShopWithThumbnail = Shop & { thumbnail?: string };

const SHOP_LIST: ShopWithThumbnail[] = [
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

export async function GET() {
  return NextResponse.json(SHOP_LIST);
}
