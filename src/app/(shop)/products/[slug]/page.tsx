import type { Metadata } from "next";
import { notFound } from "next/navigation";
// PAGE VIEW COMPONENT
import { ProductDetailsPageView } from "pages-sections/product-details/page-view";
// API FUNCTIONS
import api from "utils/__api__/products";
import { getFrequentlyBought, getRelatedProducts } from "utils/__api__/related-products";
// CUSTOM DATA MODEL
import { SlugParams } from "models/Common";
import { absoluteOgImageUrl } from "lib/og-image-url";
import {
  buildBreadcrumbJsonLd,
  buildFaqPageJsonLd,
  buildProductJsonLd
} from "lib/product-jsonld/build-product-jsonld";
import { ogPageTitle, pageTitle, SITE_NAME } from "lib/site-metadata";

// Product/related/offers data is Data-Cached (unstable_cache, 60s) — admin edits
// call revalidatePath(`/products/:slug`) on save, so this stays fresh on change
// while avoiding a fresh DB round trip on every single visit.
export const revalidate = 60;

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
  const canonicalUrl = `${baseUrl}/products/${product.slug}`;
  const title = pageTitle(product.title, "shop");
  const ogTitle = ogPageTitle(product.title);
  const description =
    product.metaDescription ??
    product.description?.replace(/<[^>]+>/g, " ").trim() ??
    `Kupite ${product.title} na Tech Zone — računarska oprema i komponente u BiH.`;
  const ogDescription =
    product.ogDescription ?? product.metaDescription ?? description;
  const mainImage = absoluteOgImageUrl(
    product.images?.[0] ?? product.thumbnail ?? "/assets/images/categories/default-category.jpg"
  );

  return {
    title,
    description,
    keywords: ["tech zone", "računari", "komponente", product.title],
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: "website",
      url: canonicalUrl,
      siteName: SITE_NAME,
      images: [{ url: mainImage, alt: product.title }]
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
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

  const baseUrl = getBaseUrl();
  const canonicalUrl = `${baseUrl}/products/${product.slug}`;
  const productSchema = buildProductJsonLd(product, canonicalUrl);
  const faqSchema = buildFaqPageJsonLd(product.faq);
  const breadcrumbSchema = buildBreadcrumbJsonLd(product, baseUrl);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      {faqSchema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      ) : null}
      {breadcrumbSchema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
      ) : null}
      <ProductDetailsPageView
        product={product}
        relatedProducts={relatedProducts}
        frequentlyBought={frequentlyBought}
      />
    </>
  );
}
