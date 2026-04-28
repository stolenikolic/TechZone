import { NextResponse } from "next/server";
import type Brand from "models/Brand.model";

const CLIENTS: Brand[] = [
  { id: "client-1", slug: "alibaba", name: "AliBaba", image: "/assets/images/brands/alibaba.png", type: "fashion" },
  { id: "client-2", slug: "levis", name: "Levis", image: "/assets/images/brands/levis.png", type: "fashion" },
  { id: "client-3", slug: "lotto", name: "Lotto", image: "/assets/images/brands/lotto.png", type: "fashion" },
  { id: "client-4", slug: "raymond", name: "Raymond", image: "/assets/images/brands/raymond.png", type: "fashion" },
  { id: "client-5", slug: "samsung", name: "Samsung", image: "/assets/images/brands/samsung.png", type: "fashion" }
];

export async function GET() {
  return NextResponse.json(CLIENTS);
}
