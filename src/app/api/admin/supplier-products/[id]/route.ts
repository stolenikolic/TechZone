import { NextResponse } from "next/server";
import { aggregatePrices } from "lib/pricing";
import { processProductImages } from "lib/suppliers/ipon/processProductImages";
import { syncMissingIdentifiersFromMaster } from "lib/suppliers/syncSupplierIdentifiers";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";

type LinkBody = {
  action: "link";
  productId: string;
};

type UnlinkBody = {
  action: "unlink";
};

type Body = LinkBody | UnlinkBody;

type DbSupplier =
  | { name: string | null; code: string | null }
  | { name: string | null; code: string | null }[]
  | null;

type DbCategory = { id: string; name: string; slug: string; parent_id: string | null };

type OfferDetailRow = {
  id: string;
  supplier_product_id: string;
  product_id: string | null;
  price_amount: number | null;
  currency: string | null;
  mpn: string | null;
  ean: string | null;
  raw_json: unknown;
  suppliers: DbSupplier;
};

export type CreateMasterFromOfferPayload = {
  name: string;
  slug?: string;
  brand?: string | null;
  description?: string | null;
  categoryId: string;
  mainImage?: string | null;
  imageUrls?: string[] | null;
  mpn?: string | null;
  ean?: string | null;
  attributes?: Record<string, unknown>;
};

export type CreateMasterFromOfferResponse = {
  success: boolean;
  productId?: string;
  slug?: string;
  priceRefresh?: { updated?: number; batches?: number; error?: string };
  error?: string;
};

export type SupplierOfferCreateMasterData = {
  offer: {
    id: string;
    supplier: string;
    supplierCode: string;
    supplierProductId: string;
    productId: string | null;
    priceAmount: number | null;
    currency: string;
    mpn: string | null;
    ean: string | null;
    rawJson: unknown;
    suggested: {
      name: string;
      brand: string;
      description: string;
      mainImage: string;
      mpn: string;
      ean: string;
      attributes: Record<string, unknown>;
    };
  };
  categories: { id: string; name: string; slug: string; parentId: string | null; attributeSlugs: string[] }[];
};

type CategoryAttributeRow = {
  category_id: string;
  attributes:
    | { slug: string | null }
    | { slug: string | null }[]
    | null;
};

function supplierValue(row: DbSupplier) {
  const value = row == null ? null : Array.isArray(row) ? row[0] ?? null : row;
  return {
    name: value?.name ?? "Unknown",
    code: value?.code ?? "unknown"
  };
}

function rawRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function stringFrom(raw: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function imageFrom(raw: Record<string, unknown>) {
  const pictures = raw.pictures;
  if (Array.isArray(pictures)) {
    const first = pictures.find((item): item is string => typeof item === "string" && item.trim().length > 0);
    if (first) return first;
  }
  return stringFrom(raw, ["main_image", "image", "imageUrl", "thumbnail"]);
}

function buildSuggestedAttributes(raw: Record<string, unknown>) {
  const attributes = raw.attributes;
  if (attributes && typeof attributes === "object" && !Array.isArray(attributes)) {
    return attributes as Record<string, unknown>;
  }
  return {};
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function ensureUniqueSlug(supabase: ReturnType<typeof createSupabaseServiceClient>, base: string) {
  const fallback = base || "product";
  let candidate = fallback;
  let counter = 1;

  for (;;) {
    const { data, error } = await supabase.from("products").select("id").eq("slug", candidate).maybeSingle();
    if (error) throw new Error(`products slug lookup failed: ${error.message}`);
    if (!data) return candidate;
    candidate = `${fallback}-${counter}`;
    counter += 1;
  }
}

function compactString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeAttributes(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(([, attributeValue]) => {
      if (attributeValue == null) return false;
      if (typeof attributeValue === "string") return attributeValue.trim().length > 0;
      return true;
    })
  );
}

function parseImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const urls = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return Array.from(new Set(urls));
}

async function insertProductAttributes(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  productId: string,
  attributes: Record<string, unknown>
) {
  const slugs = Object.keys(attributes);
  if (slugs.length === 0) return;

  const { data: attributeRows, error } = await supabase.from("attributes").select("id, slug").in("slug", slugs);
  if (error) throw new Error(`attributes lookup failed: ${error.message}`);

  const inserts = (attributeRows ?? [])
    .map((attribute) => ({
      product_id: productId,
      attribute_id: attribute.id,
      value: String(attributes[attribute.slug] ?? "").trim()
    }))
    .filter((row) => row.value.length > 0);

  if (inserts.length === 0) return;

  const { error: insertError } = await supabase.from("product_attributes").insert(inserts);
  if (insertError) throw new Error(`product_attributes insert failed: ${insertError.message}`);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const supabase = createSupabaseServiceClient();

    const { data: offer, error: offerError } = await supabase
      .from("supplier_products")
      .select("id, supplier_product_id, product_id, price_amount, currency, mpn, ean, raw_json, suppliers(name, code)")
      .eq("id", id)
      .maybeSingle();

    if (offerError) {
      return NextResponse.json({ error: offerError.message }, { status: 400 });
    }
    if (!offer) {
      return NextResponse.json({ error: "Supplier offer not found." }, { status: 404 });
    }

    const { data: categories, error: categoriesError } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id")
      .order("name", { ascending: true });

    if (categoriesError) {
      return NextResponse.json({ error: categoriesError.message }, { status: 400 });
    }

    const categoryIds = ((categories ?? []) as DbCategory[]).map((category) => category.id);
    const categoryAttributeSlugsById = new Map<string, string[]>();
    if (categoryIds.length > 0) {
      const { data: categoryAttributes, error: categoryAttributesError } = await supabase
        .from("category_attributes")
        .select("category_id, attributes(slug)")
        .in("category_id", categoryIds);
      if (categoryAttributesError) {
        return NextResponse.json({ error: categoryAttributesError.message }, { status: 400 });
      }

      for (const row of (categoryAttributes ?? []) as CategoryAttributeRow[]) {
        if (!row.category_id) continue;
        const raw = row.attributes;
        const value = raw == null ? null : Array.isArray(raw) ? raw[0] ?? null : raw;
        const slug = value?.slug?.trim();
        if (!slug) continue;
        const list = categoryAttributeSlugsById.get(row.category_id) ?? [];
        if (!list.includes(slug)) list.push(slug);
        categoryAttributeSlugsById.set(row.category_id, list);
      }
    }

    const row = offer as OfferDetailRow;
    const raw = rawRecord(row.raw_json);
    const supplier = supplierValue(row.suppliers);
    const body: SupplierOfferCreateMasterData = {
      offer: {
        id: row.id,
        supplier: supplier.name,
        supplierCode: supplier.code,
        supplierProductId: row.supplier_product_id,
        productId: row.product_id,
        priceAmount: row.price_amount != null ? Number(row.price_amount) : null,
        currency: row.currency ?? "",
        mpn: row.mpn,
        ean: row.ean,
        rawJson: row.raw_json,
        suggested: {
          name: stringFrom(raw, ["displayName", "name", "fullName", "productName", "listing_name"]),
          brand: stringFrom(raw, ["brand", "manufacturer"]),
          description: stringFrom(raw, ["description", "shortDescription"]),
          mainImage: imageFrom(raw),
          mpn: row.mpn ?? stringFrom(raw, ["mpn", "manufacturerPartNumber", "partNumber"]),
          ean: row.ean ?? stringFrom(raw, ["ean", "gtin", "gtin13", "barcode"]),
          attributes: buildSuggestedAttributes(raw)
        }
      },
      categories: ((categories ?? []) as DbCategory[]).map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        parentId: category.parent_id,
        attributeSlugs: categoryAttributeSlugsById.get(category.id) ?? []
      }))
    };

    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/supplier-products/:id GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const payload = (await request.json()) as CreateMasterFromOfferPayload;
    const name = compactString(payload.name);
    const categoryId = compactString(payload.categoryId);

    if (!name) {
      return NextResponse.json({ success: false, error: "Product name is required." }, { status: 400 });
    }
    if (!categoryId) {
      return NextResponse.json({ success: false, error: "Category is required." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: offer, error: offerError } = await supabase
      .from("supplier_products")
      .select("id, product_id, mpn, ean")
      .eq("id", id)
      .maybeSingle();

    if (offerError) {
      return NextResponse.json({ success: false, error: offerError.message }, { status: 400 });
    }
    if (!offer) {
      return NextResponse.json({ success: false, error: "Supplier offer not found." }, { status: 404 });
    }
    if ((offer as { product_id: string | null }).product_id) {
      return NextResponse.json({ success: false, error: "Supplier offer is already linked." }, { status: 400 });
    }

    const attributes = normalizeAttributes(payload.attributes);
    const imageUrls = parseImageUrls(payload.imageUrls);
    const slug = await ensureUniqueSlug(supabase, slugify(payload.slug?.trim() || name));
    const fallbackMainImage = compactString(payload.mainImage);
    const productInsert = {
      name,
      slug,
      brand: compactString(payload.brand),
      description: compactString(payload.description),
      category_id: categoryId,
      main_image: fallbackMainImage,
      mpn: compactString(payload.mpn),
      ean: compactString(payload.ean),
      attributes,
      is_active: true
    };

    const { data: product, error: productError } = await supabase
      .from("products")
      .insert(productInsert)
      .select("id, slug, mpn, ean, main_image")
      .single();

    if (productError) {
      return NextResponse.json({ success: false, error: productError.message }, { status: 400 });
    }

    const productId = product.id as string;
    if (imageUrls.length > 0) {
      const uploadedUrls = await processProductImages(supabase, productId, imageUrls);
      if (uploadedUrls.length > 0) {
        await supabase.from("products").update({ main_image: uploadedUrls[0] }).eq("id", productId);
      } else if (product.main_image) {
        await supabase.from("product_images").insert({
          product_id: productId,
          image_url: product.main_image,
          sort_order: 0
        });
      }
    } else if (product.main_image) {
      await supabase.from("product_images").insert({
        product_id: productId,
        image_url: product.main_image,
        sort_order: 0
      });
    }

    await insertProductAttributes(supabase, productId, attributes);

    const identifierSync = await syncMissingIdentifiersFromMaster(supabase, {
      supplierProductId: id,
      productId,
      supplier: { mpn: offer.mpn, ean: offer.ean },
      master: { mpn: product.mpn, ean: product.ean }
    });

    const { error: linkError } = await supabase
      .from("supplier_products")
      .update({
        product_id: productId,
        master_match_status: "linked",
        ...identifierSync.update,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (linkError) {
      await supabase.from("products").delete().eq("id", productId);
      return NextResponse.json({ success: false, error: linkError.message }, { status: 400 });
    }

    const priceRefresh = await aggregatePrices();
    const body: CreateMasterFromOfferResponse = {
      success: true,
      productId,
      slug: product.slug as string,
      priceRefresh
    };
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/supplier-products/:id POST]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const { id } = await context.params;
    const body = (await request.json()) as Body;
    const supabase = createSupabaseServiceClient();

    if (body.action === "unlink") {
      const { error } = await supabase
        .from("supplier_products")
        .update({
          product_id: null,
          master_match_status: "pending_review",
          updated_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }

      const priceRefresh = await aggregatePrices();
      return NextResponse.json({ success: true, action: "unlink", priceRefresh });
    }

    if (body.action !== "link" || !body.productId) {
      return NextResponse.json({ success: false, error: "Invalid supplier product action." }, { status: 400 });
    }

    const { data: offer, error: offerError } = await supabase
      .from("supplier_products")
      .select("id, mpn, ean")
      .eq("id", id)
      .maybeSingle();

    if (offerError) {
      return NextResponse.json({ success: false, error: offerError.message }, { status: 400 });
    }
    if (!offer) {
      return NextResponse.json({ success: false, error: "Supplier offer not found." }, { status: 404 });
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, mpn, ean")
      .eq("id", body.productId)
      .maybeSingle();

    if (productError) {
      return NextResponse.json({ success: false, error: productError.message }, { status: 400 });
    }
    if (!product) {
      return NextResponse.json({ success: false, error: "Master product not found." }, { status: 404 });
    }

    const identifierSync = await syncMissingIdentifiersFromMaster(supabase, {
      supplierProductId: id,
      productId: product.id,
      supplier: { mpn: offer.mpn, ean: offer.ean },
      master: { mpn: product.mpn, ean: product.ean }
    });

    const { error: updateError } = await supabase
      .from("supplier_products")
      .update({
        product_id: product.id,
        master_match_status: "linked",
        ...identifierSync.update,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ success: false, error: updateError.message }, { status: 400 });
    }

    const priceRefresh = await aggregatePrices();
    return NextResponse.json({
      success: true,
      action: "link",
      synced: identifierSync.synced,
      conflicts: identifierSync.conflicts,
      priceRefresh
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/supplier-products/:id]", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
