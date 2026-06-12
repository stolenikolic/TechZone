import type Product from "models/Product.model";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function buildProductJsonLd(product: Product, canonicalUrl: string): Record<string, unknown> {
  const images =
    product.images?.length > 0
      ? product.images
      : product.thumbnail
        ? [product.thumbnail]
        : [];

  const hasOffers = (product.productOffers?.offers?.length ?? 0) > 0;
  const activeOffer =
    product.productOffers?.offers.find((o) => o.id === product.productOffers?.cheapestOfferId) ??
    product.productOffers?.offers[0];

  const offerPrice = activeOffer?.sellingPrice ?? product.price;
  const offer: Record<string, unknown> = {
    "@type": "Offer",
    priceCurrency: "BAM",
    availability: hasOffers ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    url: canonicalUrl
  };
  if (offerPrice != null && offerPrice > 0) {
    offer.price = offerPrice.toFixed(2);
  }

  if (activeOffer?.estimatedDaysFromToday != null) {
    const days = Math.max(0, Math.round(activeOffer.estimatedDaysFromToday));
    offer.shippingDetails = {
      "@type": "OfferShippingDetails",
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: {
          "@type": "QuantitativeValue",
          minValue: 0,
          maxValue: days,
          unitCode: "DAY"
        },
        transitTime: {
          "@type": "QuantitativeValue",
          minValue: 0,
          maxValue: days,
          unitCode: "DAY"
        }
      }
    };
  }

  const schemaDescription =
    product.metaDescription ??
    product.ogDescription ??
    (product.description ? stripHtml(product.description).slice(0, 300) : undefined);

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    image: images,
    offers: offer
  };

  if (schemaDescription) schema.description = schemaDescription;
  if (product.brand) schema.brand = { "@type": "Brand", name: product.brand };
  if (product.mpn) schema.mpn = product.mpn;
  if (product.ean) schema.gtin13 = product.ean;

  if (product.specifications?.length) {
    schema.additionalProperty = product.specifications.map((spec) => ({
      "@type": "PropertyValue",
      name: spec.name,
      value: spec.value
    }));
  }

  return schema;
}

export function buildFaqPageJsonLd(
  faq: Array<{ q: string; a: string }> | undefined
): Record<string, unknown> | null {
  if (!faq?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a
      }
    }))
  };
}

export function buildBreadcrumbJsonLd(
  product: Product,
  baseUrl: string
): Record<string, unknown> | null {
  const items: Array<{ name: string; item?: string }> = [{ name: "Početna", item: baseUrl }];
  if (product.parentCategory) {
    items.push({
      name: product.parentCategory.name,
      item: `${baseUrl}/categories/${product.parentCategory.slug}`
    });
  }
  if (product.category) {
    items.push({
      name: product.category.name,
      item: `${baseUrl}/categories/${product.category.slug}`
    });
  }
  items.push({ name: product.title });

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      ...(entry.item ? { item: entry.item } : {})
    }))
  };
}
