import { NextResponse } from "next/server";
import type Brand from "models/Brand.model";

const BRANDS: Brand[] = [
  { id: "brand-1", slug: "adidas", name: "Adidas", image: "/assets/images/brands/adidas.png", type: "mobile" },
  { id: "brand-2", slug: "chanel", name: "Chanel", image: "/assets/images/brands/chanel.png", type: "mobile" },
  { id: "brand-3", slug: "puma", name: "Puma", image: "/assets/images/brands/puma.png", type: "mobile" },
  { id: "brand-4", slug: "louis-vuitton", name: "Louis Vuitton", image: "/assets/images/brands/louis-vuitton.png", type: "mobile" },
  { id: "brand-5", slug: "gucci", name: "Gucci", image: "/assets/images/brands/gucci.png", type: "mobile" },
  { id: "brand-6", slug: "lacoste", name: "Lacoste", image: "/assets/images/brands/lacoste.png", type: "optics" }
];

export async function GET() {
  return NextResponse.json(BRANDS);
}
