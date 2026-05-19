import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  computeAcquisitionKm,
  computeFinalSellingKm,
  resolvePricingSettingsRow,
  resolveSellingMultiplier,
  syncProductOriginalPrice,
  type PricingMarginTierRow,
  type PricingSettingsRow
} from "lib/pricing";
import { guardAdminApi } from "lib/auth/admin-route";
import { syncAdminProductImages } from "lib/images/sync-admin-product-images";
import { createSupabaseServiceClient } from "utils/supabase";

type DbCategory = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  selling_margin_default: number | null;
};

type DbProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  category_id: string | null;
  main_image: string | null;
  price: number | null;
  custom_price: number | null;
  is_active: boolean;
  mpn: string | null;
  ean: string | null;
  selling_margin_override: number | null;
  categories: DbCategory | DbCategory[] | null;
};

type LinkedOfferRow = {
  id: string;
  supplier_product_id: string;
  price_amount: number | null;
  currency: string | null;
  updated_at: string;
  suppliers:
    | {
        id: string;
        name: string | null;
        code: string | null;
        pricing_formula: string | null;
        cost_adjustment_multiplier: number | null;
      }
    | {
        id: string;
        name: string | null;
        code: string | null;
        pricing_formula: string | null;
        cost_adjustment_multiplier: number | null;
      }[]
    | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

function numOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function normalizeAttributes(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const key = k.trim();
    if (!key) continue;
    if (v == null) continue;
    const asText = String(v).trim();
    if (!asText) continue;
    out[key] = asText;
  }
  return out;
}

async function buildPricingPreview(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  product: DbProduct
) {
  const [{ data: settingsRows }, { data: tierRows }, { data: linkedRows }] = await Promise.all([
    supabase.from("pricing_settings").select("*").limit(1),
    supabase
      .from("pricing_margin_tiers")
      .select("id, min_cost_km, max_cost_km, margin_multiplier, sort_order")
      .order("min_cost_km", { ascending: true })
      .order("sort_order", { ascending: true }),
    supabase
      .from("supplier_products")
      .select("id, supplier_product_id, price_amount, currency, updated_at, suppliers(id, name, code, pricing_formula, cost_adjustment_multiplier)")
      .eq("product_id", product.id)
      .order("updated_at", { ascending: false })
  ]);

  const { settings } = resolvePricingSettingsRow((settingsRows?.[0] ?? null) as PricingSettingsRow | null);
  const tiers = (tierRows ?? []) as PricingMarginTierRow[];
  const category = first(product.categories);
  const categoryMargin = category?.selling_margin_default ?? null;

  let minAcquisitionKm: number | null = null;
  const linkedOffers = ((linkedRows ?? []) as LinkedOfferRow[]).map((row) => {
    const supplier = first(row.suppliers);
    const acquisitionKm =
      row.price_amount != null
        ? computeAcquisitionKm(
            Number(row.price_amount),
            row.currency ?? "",
            {
              id: supplier?.id ?? "",
              pricing_formula: supplier?.pricing_formula ?? null,
              cost_adjustment_multiplier: supplier?.cost_adjustment_multiplier ?? 1
            },
            settings
          )
        : null;
    if (acquisitionKm != null && acquisitionKm > 0) {
      minAcquisitionKm = minAcquisitionKm == null ? acquisitionKm : Math.min(minAcquisitionKm, acquisitionKm);
    }
    return {
      id: row.id,
      supplierProductId: row.supplier_product_id,
      supplierName: supplier?.name ?? "Unknown",
      supplierCode: supplier?.code ?? "unknown",
      priceAmountHuf: row.price_amount != null ? Number(row.price_amount) : null,
      currency: row.currency ?? "",
      acquisitionKm,
      updatedAt: row.updated_at
    };
  });

  const preview =
    minAcquisitionKm != null && minAcquisitionKm > 0
      ? (() => {
          const m = resolveSellingMultiplier(
            minAcquisitionKm,
            tiers,
            settings,
            categoryMargin,
            product.selling_margin_override
          );
          if (!Number.isFinite(m) || m <= 0) return null;
          return {
            minAcquisitionKm,
            multiplier: m,
            projectedSellingKm: computeFinalSellingKm(minAcquisitionKm, m, settings),
            source:
              product.selling_margin_override && product.selling_margin_override > 0
                ? "product_override"
                : categoryMargin && categoryMargin > 0
                  ? "category_default"
                  : "tier_or_global"
          };
        })()
      : null;

  return { linkedOffers, preview };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { slug } = await context.params;
    const supabase = createSupabaseServiceClient();
    const { data: productRow, error: productError } = await supabase
      .from("products")
      .select(
        "id, name, slug, description, brand, category_id, main_image, price, custom_price, is_active, mpn, ean, selling_margin_override, categories(id, name, slug, parent_id, selling_margin_default)"
      )
      .eq("slug", slug)
      .maybeSingle();

    if (productError) return NextResponse.json({ error: productError.message }, { status: 400 });
    if (!productRow) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const product = productRow as DbProduct;
    const category = first(product.categories);

    const [
      { data: categoriesRows, error: categoriesError },
      { data: imageRows, error: imageError },
      { data: allCaRows },
      { data: paRows }
    ] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, slug, parent_id, selling_margin_default")
        .order("name", { ascending: true }),
      supabase
        .from("product_images")
        .select("image_url, sort_order")
        .eq("product_id", product.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("category_attributes")
        .select("category_id, attribute_id, attributes(slug, name)"),
      supabase
        .from("product_attributes")
        .select("value, attributes(slug, name)")
        .eq("product_id", product.id)
    ]);

    if (categoriesError) return NextResponse.json({ error: categoriesError.message }, { status: 400 });
    if (imageError) return NextResponse.json({ error: imageError.message }, { status: 400 });

    const categoryAttributeMap: Record<string, { slug: string; name: string }[]> = {};
    for (const row of allCaRows ?? []) {
      const caRow = row as {
        category_id: string | null;
        attributes: { slug: string | null; name: string | null } | { slug: string | null; name: string | null }[] | null;
      };
      if (!caRow.category_id) continue;
      const attr = first(caRow.attributes);
      if (!attr?.slug) continue;
      if (!categoryAttributeMap[caRow.category_id]) categoryAttributeMap[caRow.category_id] = [];
      const exists = categoryAttributeMap[caRow.category_id].some((item) => item.slug === attr.slug);
      if (!exists) {
        categoryAttributeMap[caRow.category_id].push({ slug: attr.slug, name: attr.name ?? attr.slug });
      }
    }

    const categoryAttributes = categoryAttributeMap[product.category_id ?? ""] ?? [];

    const currentAttributes = (paRows ?? [])
      .map((row) => {
        const attr = first(
          (row as { attributes: { slug: string | null } | { slug: string | null }[] | null; value: string | null }).attributes
        );
        const value = (row as { value: string | null }).value;
        if (!attr?.slug || value == null || value === "") return null;
        return { slug: attr.slug, value: String(value) };
      })
      .filter((item): item is { slug: string; value: string } => item != null);

    const { linkedOffers, preview } = await buildPricingPreview(supabase, product);

    return NextResponse.json({
      product: {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description ?? "",
        brand: product.brand ?? "",
        categoryId: product.category_id,
        category: category
          ? {
              id: category.id,
              name: category.name,
              slug: category.slug,
              parentId: category.parent_id,
              sellingMarginDefault: numOrNull(category.selling_margin_default)
            }
          : null,
        mainImage: product.main_image ?? "",
        price: numOrNull(product.price),
        customPrice: numOrNull(product.custom_price),
        isActive: Boolean(product.is_active),
        mpn: product.mpn ?? "",
        ean: product.ean ?? "",
        sellingMarginOverride: numOrNull(product.selling_margin_override)
      },
      categories: ((categoriesRows ?? []) as DbCategory[]).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        parentId: row.parent_id,
        sellingMarginDefault: numOrNull(row.selling_margin_default)
      })),
      images: (imageRows ?? []).map((row) => String((row as { image_url: string }).image_url)),
      categoryAttributes,
      categoryAttributeMap,
      attributes: currentAttributes,
      pricingPreview: preview,
      linkedOffers
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type PatchBody = {
  basic?: {
    name?: string;
    brand?: string | null;
    description?: string | null;
    mpn?: string | null;
    ean?: string | null;
    isActive?: boolean;
    customPrice?: number | null;
  };
  pricing?: {
    sellingMarginOverride?: number | null;
    price?: number | null;
  };
  categoryId?: string | null;
  attributes?: Record<string, unknown>;
  images?: { mainImage?: string | null; imageUrls?: string[] };
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { slug } = await context.params;
    const body = (await request.json()) as PatchBody;
    const supabase = createSupabaseServiceClient();
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (productError) return NextResponse.json({ error: productError.message }, { status: 400 });
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    const productId = String(product.id);
    let shouldSyncOriginalPrice = false;

    if (body.basic) {
      const patch: Record<string, unknown> = {};
      if ("name" in body.basic) patch.name = body.basic.name?.trim() || "";
      if ("brand" in body.basic) patch.brand = body.basic.brand?.trim() || null;
      if ("description" in body.basic) patch.description = body.basic.description?.trim() || null;
      if ("mpn" in body.basic) patch.mpn = body.basic.mpn?.trim() || null;
      if ("ean" in body.basic) patch.ean = body.basic.ean?.trim() || null;
      if ("isActive" in body.basic) patch.is_active = Boolean(body.basic.isActive);
      if ("customPrice" in body.basic) {
        const v = body.basic.customPrice;
        if (v != null && (!Number.isFinite(v) || v < 0)) {
          return NextResponse.json({ error: "customPrice must be null or >= 0." }, { status: 400 });
        }
        patch.custom_price = v ?? null;
        shouldSyncOriginalPrice = true;
      }
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from("products").update(patch).eq("id", productId);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    if (body.pricing) {
      const patch: Record<string, unknown> = {};
      if ("sellingMarginOverride" in body.pricing) {
        const v = body.pricing.sellingMarginOverride;
        if (v != null && (!Number.isFinite(v) || v <= 0)) {
          return NextResponse.json({ error: "sellingMarginOverride must be null or > 0." }, { status: 400 });
        }
        patch.selling_margin_override = v ?? null;
      }
      if ("price" in body.pricing) {
        const p = body.pricing.price;
        if (p != null && (!Number.isFinite(p) || p < 0)) {
          return NextResponse.json({ error: "price must be null or >= 0." }, { status: 400 });
        }
        patch.price = p ?? null;
        shouldSyncOriginalPrice = true;
      }
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from("products").update(patch).eq("id", productId);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    if (shouldSyncOriginalPrice) {
      await syncProductOriginalPrice(supabase, productId);
    }

    if ("categoryId" in body) {
      const { error } = await supabase
        .from("products")
        .update({ category_id: body.categoryId ?? null })
        .eq("id", productId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (body.attributes) {
      const attributes = normalizeAttributes(body.attributes);
      const slugs = Object.keys(attributes);
      const { error: delErr } = await supabase.from("product_attributes").delete().eq("product_id", productId);
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });
      if (slugs.length > 0) {
        const { data: attrRows, error: attrErr } = await supabase
          .from("attributes")
          .select("id, slug")
          .in("slug", slugs);
        if (attrErr) return NextResponse.json({ error: attrErr.message }, { status: 400 });
        const rows = (attrRows ?? [])
          .map((row) => ({
            product_id: productId,
            attribute_id: row.id,
            value: attributes[row.slug]
          }))
          .filter((row) => row.value && row.value.trim().length > 0);
        if (rows.length > 0) {
          const { error: insErr } = await supabase.from("product_attributes").insert(rows);
          if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
        }
      }
    }

    if (body.images) {
      const hasMain = "mainImage" in body.images;
      const hasUrls = Array.isArray(body.images.imageUrls);
      if (hasMain || hasUrls) {
        let imageUrls = hasUrls
          ? body.images.imageUrls!.map((value) => value.trim()).filter((value) => value.length > 0)
          : null;
        if (!imageUrls) {
          const { data: rows } = await supabase
            .from("product_images")
            .select("image_url")
            .eq("product_id", productId)
            .order("sort_order", { ascending: true });
          imageUrls = (rows ?? []).map((row) => String(row.image_url));
        }
        await syncAdminProductImages(supabase, productId, {
          mainImage: hasMain ? body.images.mainImage : undefined,
          imageUrls
        });
      }
    }

    // Invalidate key storefront surfaces that cache product/category/search listings.
    revalidatePath(`/products/${slug}`);
    revalidatePath(`/categories`, "layout");
    revalidatePath(`/api/categories`);
    revalidatePath(`/api/search`);
    revalidatePath(`/api/market-2/products`);
    revalidatePath(`/api/market-2/flash-deals`);
    revalidatePath(`/api/market-2/top-rated`);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
