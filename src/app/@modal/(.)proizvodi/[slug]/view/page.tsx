import type { Metadata } from "next";
import { dynamicShopMetadata } from "lib/site-metadata";
import { notFound } from "next/navigation";

import ProductQuickView from "./components/product-quick-view";

import api from "utils/__api__/products";
import { SlugParams } from "models/Common";

export async function generateMetadata({ params }: SlugParams): Promise<Metadata> {
  const { slug } = await params;
  const product = await api.getProduct(slug);

  if (!product) notFound();

  return dynamicShopMetadata(
    product.title,
    product.description ?? undefined
  );
}

export default async function QuickViewPage({ params }: SlugParams) {
  const { slug } = await params;
  const product = await api.getProduct(slug);

  if (!product) notFound();

  return <ProductQuickView product={product} />;
}
