import { redirect } from "next/navigation";
// CUSTOM DATA MODEL
import { SlugParams } from "models/Common";

export default async function ProductQuickView({ params }: SlugParams) {
  const { slug } = await params;
  redirect(`/products/${slug}`);
}
