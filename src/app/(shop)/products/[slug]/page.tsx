import type { Metadata } from "next";
import { notFound } from "next/navigation";
// PAGE VIEW COMPONENT
import { ProductDetailsPageView } from "pages-sections/product-details/page-view";
// API FUNCTIONS
import api from "utils/__api__/products";
import { getFrequentlyBought, getRelatedProducts } from "utils/__api__/related-products";
// CUSTOM DATA MODEL
import { SlugParams } from "models/Common";
import type Product from "models/Product.model";

/** Build schema.org Product JSON-LD for rich results (no layout/UI changes). */
function buildProductSchema(product: Product): Record<string, unknown> {
  const images =
    product.images?.length > 0
      ? product.images
      : product.thumbnail
        ? [product.thumbnail]
        : [];

  const offer: Record<string, unknown> = {
    "@type": "Offer",
    priceCurrency: "BAM",
    availability: "https://schema.org/InStock"
  };
  if (product.price != null && product.price > 0) {
    offer.price = product.price;
  }

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: images,
    offers: offer
  };
  if (product.brand) {
    schema.brand = { "@type": "Brand", name: product.brand };
  }
  return schema;
}

/** Base URL for canonical and OG URLs (server-only). Set NEXT_PUBLIC_SITE_URL in production. */
function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (url) return url.replace(/\/$/, "");
  return "https://techzone.ba";
}

export async function generateMetadata({ params }: SlugParams): Promise<Metadata> {
  const { slug } = await params;
  const product = await api.getProduct(slug);
  if (!product) notFound();

  const baseUrl = getBaseUrl();
  // Canonical always uses product.slug so it points to the main product page (prevents duplicate content).
  const canonicalUrl = `${baseUrl}/products/${product.slug}`;
  const title = `${product.title} – TechZone`;
  const description = product.description ?? "TechZone product.";
  const mainImage =
    product.images?.[0] ?? product.thumbnail ?? `${baseUrl}/assets/images/placeholder.png`;

  return {
    title,
    description,
    keywords: ["e-commerce", "tech", "TechZone"],
    openGraph: {
      title: product.title,
      description,
      type: "website",
      url: canonicalUrl,
      images: [{ url: mainImage, alt: product.title }]
    },
    twitter: {
      card: "summary_large_image",
      title: product.title,
      description,
      images: [mainImage]
    },
    alternates: { canonical: canonicalUrl }
  };
}

export default async function ProductDetails({ params }: SlugParams) {
  const { slug } = await params;
  const [product, relatedProducts, frequentlyBought] = await Promise.all([
    api.getProduct(slug),
    getRelatedProducts(),
    getFrequentlyBought()
  ]);

  if (!product) notFound();

  const schemaData = buildProductSchema(product);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />
      <ProductDetailsPageView
        product={product}
        relatedProducts={relatedProducts}
        frequentlyBought={frequentlyBought}
      />
    </>
  );
}
