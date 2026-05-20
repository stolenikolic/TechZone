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
import { absoluteOgImageUrl } from "lib/og-image-url";
import { SITE_NAME } from "lib/site-metadata";

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
  const title = `${product.title} | Tech Zone`;
  const description =
    product.description ??
    `Kupite ${product.title} na Tech Zone — računarska oprema i komponente u BiH.`;
  const mainImage = absoluteOgImageUrl(
    product.images?.[0] ?? product.thumbnail ?? "/assets/images/categories/default-category.jpg"
  );

  return {
    title,
    description,
    keywords: ["tech zone", "računari", "komponente", product.title],
    openGraph: {
      title: product.title,
      description,
      type: "website",
      url: canonicalUrl,
      siteName: SITE_NAME,
      images: [{ url: mainImage, width: 1200, height: 630, alt: product.title }]
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
