import { cache } from "react";
import { unstable_cache } from "next/cache";
import axios from "utils/axiosInstance";
import { mapProductSpecifications } from "lib/shop/map-product-specifications";
import { createSupabaseServiceClient } from "utils/supabase";
import { getEffectivePrice, getOriginalPriceForDisplay } from "lib/effective-price";
import { applyStorefrontProductVisibility } from "lib/storefront-product-visibility";
import { resolveProductOffersForStorefront } from "lib/product-offers";
// CUSTOM DATA MODEL
import { SlugParams } from "models/Common";
import Product from "models/Product.model";

/** Data Cache TTL for a product detail page. Admin edits call revalidatePath(`/products/:slug`) directly. */
const PRODUCT_DETAIL_REVALIDATE_SECONDS = 60;

type DbCategory = { id: string; name: string; slug: string; parent_id: string | null };

type DbProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  main_image: string | null;
  rating: number | null;
  price: number | null;
  custom_price: number | null;
  original_price: number | null;
  mpn: string | null;
  ean: string | null;
  ai_meta_description: string | null;
  ai_og_description: string | null;
  ai_faq: unknown;
  ai_description_status: string | null;
  categories: DbCategory | DbCategory[] | null;
};

function rowToProduct(product: DbProduct, parentCategory?: { name: string; slug: string } | null): Product {
  const thumbnail = product.main_image ?? "/assets/images/placeholder.png";
  const raw = product.categories;
  const category = raw == null ? null : Array.isArray(raw) ? raw[0] ?? null : raw;
  const rating = product.rating != null ? Number(product.rating) : 0;
  const price = getEffectivePrice(product.custom_price, product.price);
  const originalPrice = getOriginalPriceForDisplay(product.original_price, price);

  return {
    id: product.id,
    slug: product.slug,
    title: product.name,
    price,
    ...(originalPrice != null && { originalPrice }),
    rating: Math.min(5, Math.max(0, rating)),
    discount: 0,
    thumbnail,
    images: [thumbnail],
    brand: product.brand ?? undefined,
    categories: category ? [category.name] : [],
    ...(category && { category: { name: category.name, slug: category.slug } }),
    ...(parentCategory && { parentCategory }),
    description: product.description ?? undefined,
    published: true
  };
}

// get all product slug
const getSlugs = cache(async () => {
  const response = await axios.get<SlugParams[]>("/api/products/slug-list");
  return response.data;
});

// get product based on slug. Server-side reads DB directly; no axios hop to our own API during RSC render.
// Data-Cached (60s) + de-duped per request; admin edits call revalidatePath(`/products/:slug`) on save.
const getProduct = cache(
  unstable_cache(
    async (slug: string): Promise<Product | null> => {
      try {
        const supabase = createSupabaseServiceClient();
        const { data, error } = await applyStorefrontProductVisibility(
          supabase
            .from("products")
            .select(
              "id, name, slug, description, brand, main_image, rating, price, custom_price, original_price, mpn, ean, ai_meta_description, ai_og_description, ai_faq, ai_description_status, categories(id, name, slug, parent_id)"
            )
            .eq("slug", slug)
        ).maybeSingle();

        if (error) {
          console.warn("[product-details]", error.message);
          return null;
        }
        if (!data) return null;

        const row = data as DbProduct;
        const category =
          row.categories == null ? null : Array.isArray(row.categories) ? row.categories[0] ?? null : row.categories;

        const product = rowToProduct(row, null);

        // None of these depend on each other — only on `row`/`category` already
        // resolved above — so run them as a single parallel wave instead of one
        // network round trip after another (costly when app server and DB are in
        // different regions).
        const [parentCategoryResult, productImagesResult, categoryAttributesResult, specRowsResult, productOffers] =
          await Promise.all([
            category?.parent_id
              ? supabase.from("categories").select("name, slug").eq("id", category.parent_id).maybeSingle()
              : Promise.resolve({ data: null }),
            supabase
              .from("product_images")
              .select("image_url")
              .eq("product_id", row.id)
              .order("sort_order", { ascending: true }),
            category?.id
              ? supabase
                  .from("category_attributes")
                  .select("attribute_id, sort_order, attributes(id, name, slug, filter_display_type)")
                  .eq("category_id", category.id)
                  .order("sort_order", { ascending: true })
              : Promise.resolve({ data: null as Parameters<typeof mapProductSpecifications>[1] }),
            supabase
              .from("product_attributes")
              .select("value, attributes(id, name, slug, filter_display_type)")
              .eq("product_id", row.id),
            resolveProductOffersForStorefront(supabase, row.id, product.price ?? 0)
          ]);

        if (parentCategoryResult.data) {
          product.parentCategory = {
            name: parentCategoryResult.data.name,
            slug: parentCategoryResult.data.slug
          };
        }

        if (productImagesResult.data?.length) {
          product.images = productImagesResult.data.map((r) => r.image_url);
          product.thumbnail = product.images[0];
        }

        if (specRowsResult.data?.length) {
          const applicable = mapProductSpecifications(specRowsResult.data, categoryAttributesResult.data);
          if (applicable.length) product.specifications = applicable;
        }

        product.productOffers = productOffers;

        if (row.mpn) product.mpn = row.mpn;
        if (row.ean) product.ean = row.ean;
        product.aiDescriptionStatus = row.ai_description_status ?? undefined;

        const aiApproved =
          row.ai_description_status === "approved" || row.ai_description_status === "generated";

        if (aiApproved && row.ai_meta_description) {
          product.metaDescription = row.ai_meta_description;
        }
        if (aiApproved && row.ai_og_description) {
          product.ogDescription = row.ai_og_description;
        }
        if (aiApproved && row.ai_faq && Array.isArray(row.ai_faq)) {
          product.faq = (row.ai_faq as Array<{ q?: string; a?: string }>)
            .filter((item) => item.q && item.a)
            .map((item) => ({ q: String(item.q), a: String(item.a) }));
        }

        return product;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn("[product-details]", message);
        return null;
      }
    },
    ["product-detail"],
    { revalidate: PRODUCT_DETAIL_REVALIDATE_SECONDS }
  )
);

// search products
const searchProducts = cache(async (name?: string, category?: string) => {
  const response = await axios.get<string[]>("/api/products/search", {
    params: { name, category }
  });
  return response.data;
});

export default { getSlugs, getProduct, searchProducts };
