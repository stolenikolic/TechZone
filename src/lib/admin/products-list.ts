import type { SupabaseClient } from "@supabase/supabase-js";
import type Product from "models/Product.model";
import { getEffectivePrice } from "lib/effective-price";
import { resolveEffectivePriceSource } from "lib/effective-price-source";
import { computeAcquisitionKm, resolvePricingSettingsRow, type PricingSettingsRow } from "lib/pricing";
import {
  buildPaginatedResult,
  slicePage,
  type PaginatedResult,
  type PaginationParams
} from "lib/admin/pagination";
import {
  firstCategory,
  getMasterStatus,
  type CategoryAttrReq,
  type DbProductForStatus,
  type MasterStatusValue
} from "lib/admin/product-master-status";

type DbProduct = DbProductForStatus & {
  rating: number | null;
  is_active: boolean;
  publish_locked: boolean;
};

export type AdminProduct = Product & {
  basePrice: number | null;
  customPrice: number | null;
  effectivePrice: number;
  effectivePriceSource: string | null;
  linkedSuppliers: { code: string; name: string }[];
};

export type ProductsListParams = PaginationParams & {
  q?: string;
  quickFilter?: string;
  parentCategory?: string;
  childCategory?: string;
  priceSource?: string;
  published?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

export type ProductsStats = {
  all: number;
  ready: number;
  unlinked: number;
  linked: number;
  needs_attributes: number;
};

export type ProductsFilterOptions = {
  categoryTree: Record<string, { name: string; children: { slug: string; name: string }[] }>;
  priceSources: { value: string; label: string }[];
};

type ProductListContext = {
  categoryReqByCategoryId: Map<string, CategoryAttrReq[]>;
  productAttributeIds: Map<string, Set<string>>;
  productAttributeValues: Map<string, Map<string, string>>;
  supplierCountByProduct: Map<string, number>;
  linkedSuppliersByProduct: Map<string, Map<string, string>>;
  engineSupplierNameByProduct: Map<string, string>;
  parentCategoryById: Map<string, { name: string; slug: string }>;
};

function escapeIlike(value: string): string {
  return value.replace(/[%_,]/g, "\\$&");
}

function firstSupplier<T>(raw: T | T[] | null): T | null {
  if (raw == null) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function toProduct(
  row: DbProduct,
  masterStatus: NonNullable<Product["masterStatus"]>,
  engineSupplierName: string | null,
  linkedSuppliers: { code: string; name: string }[],
  parentCategory?: { name: string; slug: string } | null
): AdminProduct {
  const thumbnail = row.main_image ?? "/assets/images/placeholder.png";
  const category = firstCategory(row);
  const effectivePrice = getEffectivePrice(row.custom_price, row.price);

  return {
    id: row.id,
    slug: row.slug,
    title: row.name,
    price: effectivePrice,
    rating: row.rating != null ? Number(row.rating) : 0,
    discount: 0,
    thumbnail,
    images: [thumbnail],
    brand: row.brand ?? undefined,
    categories: category ? [category.name] : [],
    ...(category && { category: { name: category.name, slug: category.slug } }),
    ...(parentCategory && { parentCategory }),
    description: row.description ?? undefined,
    published: Boolean(row.is_active) && !row.publish_locked,
    publishLocked: Boolean(row.publish_locked),
    masterStatus,
    basePrice: row.price != null ? Number(row.price) : null,
    customPrice: row.custom_price != null ? Number(row.custom_price) : null,
    effectivePrice,
    effectivePriceSource: resolveEffectivePriceSource(row.custom_price, row.price, engineSupplierName),
    linkedSuppliers
  };
}

function needsIdScan(params: ProductsListParams): boolean {
  const quick = params.quickFilter ?? "all";
  const priceSource = params.priceSource ?? "all";
  return (
    quick !== "all" ||
    (priceSource !== "all" && priceSource !== "manual") ||
    params.priceMin != null ||
    params.priceMax != null
  );
}

async function resolveCategoryIds(
  supabase: SupabaseClient,
  parentCategory?: string,
  childCategory?: string
): Promise<string[] | null> {
  if (childCategory && childCategory !== "all") {
    const { data, error } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", childCategory)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.id ? [data.id as string] : [];
  }

  if (parentCategory && parentCategory !== "all") {
    const { data: parent, error: parentError } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", parentCategory)
      .maybeSingle();
    if (parentError) throw new Error(parentError.message);
    if (!parent?.id) return [];

    const { data: children, error: childrenError } = await supabase
      .from("categories")
      .select("id")
      .eq("parent_id", parent.id);
    if (childrenError) throw new Error(childrenError.message);

    return [parent.id as string, ...((children ?? []).map((row) => row.id as string) ?? [])];
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applySqlProductFilters(query: any, params: ProductsListParams, categoryIds: string[] | null) {
  let q = query;

  if (categoryIds) {
    q = q.in("category_id", categoryIds);
  }

  const published = params.published ?? "all";
  if (published === "published") {
    q = q.eq("is_active", true).eq("publish_locked", false);
  } else if (published === "unpublished") {
    q = q.or("is_active.eq.false,publish_locked.eq.true");
  }

  const priceSource = params.priceSource ?? "all";
  if (priceSource === "manual") {
    q = q.not("custom_price", "is", null).gt("custom_price", 0);
  }

  const search = params.q?.trim();
  if (search) {
    const pattern = `%${escapeIlike(search)}%`;
    q = q.or(
      [`name.ilike.${pattern}`, `brand.ilike.${pattern}`, `mpn.ilike.${pattern}`, `ean.ilike.${pattern}`].join(",")
    );
  }

  return q;
}

async function loadListContext(supabase: SupabaseClient): Promise<{
  settings: ReturnType<typeof resolvePricingSettingsRow>["settings"];
  categoryReqByCategoryId: Map<string, CategoryAttrReq[]>;
  parentCategoryById: Map<string, { name: string; slug: string }>;
}> {
  const { data: settingsRows, error: settingsError } = await supabase
    .from("pricing_settings")
    .select("*")
    .limit(1);
  if (settingsError) throw new Error(settingsError.message);
  const { settings } = resolvePricingSettingsRow((settingsRows?.[0] ?? null) as PricingSettingsRow | null);

  const { data: allCategories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id");
  if (categoriesError) throw new Error(categoriesError.message);

  const parentCategoryById = new Map<string, { name: string; slug: string }>();
  for (const row of allCategories ?? []) {
    parentCategoryById.set(row.id as string, {
      name: row.name as string,
      slug: row.slug as string
    });
  }

  const categoryReqByCategoryId = new Map<string, CategoryAttrReq[]>();
  const categoryIds = (allCategories ?? []).map((row) => row.id as string);
  const chunkSize = 200;
  for (let i = 0; i < categoryIds.length; i += chunkSize) {
    const chunk = categoryIds.slice(i, i + chunkSize);
    const { data: caRows, error: caError } = await supabase
      .from("category_attributes")
      .select("category_id, attribute_id, attributes(slug), sort_order")
      .in("category_id", chunk)
      .order("sort_order", { ascending: true });
    if (caError) throw new Error(caError.message);
    for (const r of caRows ?? []) {
      const cid = r.category_id as string;
      const aid = r.attribute_id as string;
      const attrs = r.attributes as { slug: string } | { slug: string }[] | null;
      const slug = Array.isArray(attrs) ? attrs[0]?.slug ?? "" : attrs?.slug ?? "";
      if (!cid || !aid || !slug) continue;
      if (!categoryReqByCategoryId.has(cid)) categoryReqByCategoryId.set(cid, []);
      categoryReqByCategoryId.get(cid)!.push({ attributeId: aid, slug });
    }
  }

  return { settings, categoryReqByCategoryId, parentCategoryById };
}

async function loadAttributesForProducts(
  supabase: SupabaseClient,
  productIds: string[]
): Promise<{
  productAttributeIds: Map<string, Set<string>>;
  productAttributeValues: Map<string, Map<string, string>>;
}> {
  const productAttributeIds = new Map<string, Set<string>>();
  const productAttributeValues = new Map<string, Map<string, string>>();
  if (productIds.length === 0) {
    return { productAttributeIds, productAttributeValues };
  }

  const { data: attributeSlugRows, error: attributeSlugError } = await supabase
    .from("attributes")
    .select("id, slug");
  if (attributeSlugError) throw new Error(attributeSlugError.message);
  const attributeIdToSlug = new Map<string, string>();
  for (const a of attributeSlugRows ?? []) {
    if (a.id && a.slug) attributeIdToSlug.set(a.id as string, a.slug as string);
  }

  const chunkSize = 200;
  for (let i = 0; i < productIds.length; i += chunkSize) {
    const chunk = productIds.slice(i, i + chunkSize);
    const { data: attributeRows, error: attributeError } = await supabase
      .from("product_attributes")
      .select("product_id, attribute_id, value")
      .in("product_id", chunk);
    if (attributeError) throw new Error(attributeError.message);

    for (const row of attributeRows ?? []) {
      if (!row.product_id || !row.attribute_id) continue;
      const pid = row.product_id as string;
      const aid = row.attribute_id as string;
      if (!productAttributeIds.has(pid)) productAttributeIds.set(pid, new Set());
      productAttributeIds.get(pid)!.add(aid);
      const slug = attributeIdToSlug.get(aid);
      if (slug && row.value != null) {
        if (!productAttributeValues.has(pid)) productAttributeValues.set(pid, new Map());
        productAttributeValues.get(pid)!.set(slug, String(row.value));
      }
    }
  }

  return { productAttributeIds, productAttributeValues };
}

async function loadSupplierAggregatesForProducts(
  supabase: SupabaseClient,
  productIds: string[],
  settings: ReturnType<typeof resolvePricingSettingsRow>["settings"]
) {
  const supplierCountByProduct = new Map<string, number>();
  const linkedSuppliersByProduct = new Map<string, Map<string, string>>();
  const minAcquisitionKmByProduct = new Map<string, number>();
  const engineSupplierNameByProduct = new Map<string, string>();

  if (productIds.length === 0) {
    return { supplierCountByProduct, linkedSuppliersByProduct, engineSupplierNameByProduct };
  }

  const chunkSize = 200;
  for (let i = 0; i < productIds.length; i += chunkSize) {
    const chunk = productIds.slice(i, i + chunkSize);
    const { data: supplierRows, error: supplierError } = await supabase
      .from("supplier_products")
      .select(
        "product_id, supplier_id, price_amount, currency, is_active, suppliers(name, code, pricing_formula, cost_adjustment_multiplier)"
      )
      .in("product_id", chunk);
    if (supplierError) throw new Error(supplierError.message);

    for (const row of supplierRows ?? []) {
      if (!row.product_id) continue;
      const productId = row.product_id as string;
      supplierCountByProduct.set(productId, (supplierCountByProduct.get(productId) ?? 0) + 1);

      if (row.is_active === false) continue;

      const supplier = firstSupplier(row.suppliers);
      const supplierCode = (supplier?.code ?? "unknown").trim().toLowerCase();
      const supplierName = (supplier?.name ?? supplier?.code ?? "Unknown").trim();
      if (!linkedSuppliersByProduct.has(productId)) {
        linkedSuppliersByProduct.set(productId, new Map());
      }
      linkedSuppliersByProduct.get(productId)!.set(supplierCode, supplierName);

      if (row.price_amount == null) continue;
      const acquisitionKm = computeAcquisitionKm(
        Number(row.price_amount),
        row.currency ?? "",
        {
          id: row.supplier_id as string,
          pricing_formula: supplier?.pricing_formula ?? null,
          cost_adjustment_multiplier: supplier?.cost_adjustment_multiplier ?? 1
        },
        settings
      );
      if (!Number.isFinite(acquisitionKm) || acquisitionKm <= 0) continue;

      const currentMin = minAcquisitionKmByProduct.get(productId);
      if (currentMin === undefined || acquisitionKm < currentMin) {
        minAcquisitionKmByProduct.set(productId, acquisitionKm);
        engineSupplierNameByProduct.set(productId, supplierName);
      }
    }
  }

  return { supplierCountByProduct, linkedSuppliersByProduct, engineSupplierNameByProduct };
}

const PRODUCT_SELECT =
  "id, name, slug, description, brand, main_image, price, custom_price, rating, is_active, publish_locked, mpn, ean, attributes, categories(id, name, slug, parent_id)";

function matchesComputedFilters(
  row: DbProduct,
  masterStatusValue: MasterStatusValue,
  effectivePriceSource: string | null,
  params: ProductsListParams
): boolean {
  const quick = params.quickFilter ?? "all";
  if (quick !== "all" && masterStatusValue !== quick) return false;

  const priceSource = params.priceSource ?? "all";
  if (priceSource !== "all") {
    if (priceSource === "manual") {
      if (effectivePriceSource !== "manual") return false;
    } else if (effectivePriceSource !== priceSource) {
      return false;
    }
  }

  const effectivePrice = getEffectivePrice(row.custom_price, row.price);
  if (params.priceMin != null && Number.isFinite(params.priceMin) && effectivePrice < params.priceMin) {
    return false;
  }
  if (params.priceMax != null && Number.isFinite(params.priceMax) && effectivePrice > params.priceMax) {
    return false;
  }

  return true;
}

function enrichRows(
  rows: DbProduct[],
  ctx: ProductListContext & { categoryReqByCategoryId: Map<string, CategoryAttrReq[]> }
): AdminProduct[] {
  return rows.map((row) => {
    const linkedSuppliers = Array.from(ctx.linkedSuppliersByProduct.get(row.id) ?? new Map())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const masterStatus = getMasterStatus(
      row,
      ctx.supplierCountByProduct.get(row.id) ?? 0,
      ctx.categoryReqByCategoryId,
      ctx.productAttributeIds,
      ctx.productAttributeValues
    );
    const category = firstCategory(row);
    const parent =
      category?.parent_id != null ? ctx.parentCategoryById.get(category.parent_id) ?? null : null;
    return toProduct(
      row,
      masterStatus,
      ctx.engineSupplierNameByProduct.get(row.id) ?? null,
      linkedSuppliers,
      parent
    );
  });
}

async function listProductsViaScan(
  supabase: SupabaseClient,
  params: ProductsListParams,
  categoryIds: string[] | null
): Promise<PaginatedResult<AdminProduct>> {
  const { settings, categoryReqByCategoryId, parentCategoryById } = await loadListContext(supabase);

  let query = supabase.from("products").select(PRODUCT_SELECT).order("created_at", { ascending: false });
  query = applySqlProductFilters(query, params, categoryIds);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const candidates = (data ?? []) as DbProduct[];
  const candidateIds = candidates.map((row) => row.id);

  const { productAttributeIds, productAttributeValues } = await loadAttributesForProducts(
    supabase,
    candidateIds
  );
  const supplierAgg = await loadSupplierAggregatesForProducts(supabase, candidateIds, settings);

  const filteredIds: string[] = [];
  for (const row of candidates) {
    const masterStatus = getMasterStatus(
      row,
      supplierAgg.supplierCountByProduct.get(row.id) ?? 0,
      categoryReqByCategoryId,
      productAttributeIds,
      productAttributeValues
    );
    const effectivePriceSource = resolveEffectivePriceSource(
      row.custom_price,
      row.price,
      supplierAgg.engineSupplierNameByProduct.get(row.id) ?? null
    );
    if (!matchesComputedFilters(row, masterStatus.value, effectivePriceSource, params)) continue;
    filteredIds.push(row.id);
  }

  const pageIds = slicePage(filteredIds, params.page, params.limit);
  const pageRows = candidates.filter((row) => pageIds.includes(row.id));
  const orderedRows = pageIds
    .map((id) => pageRows.find((row) => row.id === id))
    .filter((row): row is DbProduct => Boolean(row));

  const pageAttributeIds = pageIds;
  const pageAttrs = await loadAttributesForProducts(supabase, pageAttributeIds);
  const pageSupplierAgg = await loadSupplierAggregatesForProducts(supabase, pageIds, settings);

  const items = enrichRows(orderedRows, {
    categoryReqByCategoryId,
    parentCategoryById,
    productAttributeIds: pageAttrs.productAttributeIds,
    productAttributeValues: pageAttrs.productAttributeValues,
    supplierCountByProduct: pageSupplierAgg.supplierCountByProduct,
    linkedSuppliersByProduct: pageSupplierAgg.linkedSuppliersByProduct,
    engineSupplierNameByProduct: pageSupplierAgg.engineSupplierNameByProduct
  });

  return buildPaginatedResult(items, filteredIds.length, params.page, params.limit);
}

async function listProductsViaSql(
  supabase: SupabaseClient,
  params: ProductsListParams,
  categoryIds: string[] | null
): Promise<PaginatedResult<AdminProduct>> {
  const { settings, categoryReqByCategoryId, parentCategoryById } = await loadListContext(supabase);
  const offset = (params.page - 1) * params.limit;

  let countQuery = supabase.from("products").select("id", { count: "exact", head: true });
  countQuery = applySqlProductFilters(countQuery, params, categoryIds);
  const { count, error: countError } = await countQuery;
  if (countError) throw new Error(countError.message);

  let dataQuery = supabase.from("products").select(PRODUCT_SELECT).order("created_at", { ascending: false });
  dataQuery = applySqlProductFilters(dataQuery, params, categoryIds);
  const { data, error } = await dataQuery.range(offset, offset + params.limit - 1);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as DbProduct[];
  const pageIds = rows.map((row) => row.id);
  const pageAttrs = await loadAttributesForProducts(supabase, pageIds);
  const pageSupplierAgg = await loadSupplierAggregatesForProducts(supabase, pageIds, settings);

  const items = enrichRows(rows, {
    categoryReqByCategoryId,
    parentCategoryById,
    productAttributeIds: pageAttrs.productAttributeIds,
    productAttributeValues: pageAttrs.productAttributeValues,
    supplierCountByProduct: pageSupplierAgg.supplierCountByProduct,
    linkedSuppliersByProduct: pageSupplierAgg.linkedSuppliersByProduct,
    engineSupplierNameByProduct: pageSupplierAgg.engineSupplierNameByProduct
  });

  return buildPaginatedResult(items, count ?? 0, params.page, params.limit);
}

export async function listAdminProducts(
  supabase: SupabaseClient,
  params: ProductsListParams
): Promise<PaginatedResult<AdminProduct>> {
  const categoryIds = await resolveCategoryIds(
    supabase,
    params.parentCategory,
    params.childCategory
  );
  if (categoryIds && categoryIds.length === 0) {
    return buildPaginatedResult([], 0, params.page, params.limit);
  }

  if (needsIdScan(params)) {
    return listProductsViaScan(supabase, params, categoryIds);
  }
  return listProductsViaSql(supabase, params, categoryIds);
}

export async function getProductsStats(supabase: SupabaseClient): Promise<ProductsStats> {
  const { settings, categoryReqByCategoryId } = await loadListContext(supabase);

  const rows: DbProduct[] = [];
  const pageSize = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as DbProduct[];
    if (page.length === 0) break;
    rows.push(...page);
    offset += page.length;
    if (page.length < pageSize) break;
  }

  const allIds = rows.map((row) => row.id);
  const { productAttributeIds, productAttributeValues } = await loadAttributesForProducts(
    supabase,
    allIds
  );
  const supplierAgg = await loadSupplierAggregatesForProducts(supabase, allIds, settings);

  const counts: ProductsStats = {
    all: 0,
    ready: 0,
    unlinked: 0,
    linked: 0,
    needs_attributes: 0
  };

  for (const row of rows) {
    const status = getMasterStatus(
      row,
      supplierAgg.supplierCountByProduct.get(row.id) ?? 0,
      categoryReqByCategoryId,
      productAttributeIds,
      productAttributeValues
    );
    counts.all += 1;
    counts[status.value] += 1;
  }

  return counts;
}

export async function getProductsFilterOptions(supabase: SupabaseClient): Promise<ProductsFilterOptions> {
  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id")
    .order("name", { ascending: true });
  if (categoriesError) throw new Error(categoriesError.message);

  const categoryTree: ProductsFilterOptions["categoryTree"] = {};
  const byId = new Map<string, { name: string; slug: string; parent_id: string | null }>();
  for (const row of categories ?? []) {
    byId.set(row.id as string, {
      name: row.name as string,
      slug: row.slug as string,
      parent_id: row.parent_id as string | null
    });
  }

  for (const row of categories ?? []) {
    const parentId = row.parent_id as string | null;
    if (parentId) continue;
    categoryTree[row.slug as string] = { name: row.name as string, children: [] };
  }

  for (const row of categories ?? []) {
    const parentId = row.parent_id as string | null;
    if (!parentId) continue;
    const parent = byId.get(parentId);
    if (!parent) continue;
    const treeNode = categoryTree[parent.slug];
    if (!treeNode) continue;
    treeNode.children.push({ slug: row.slug as string, name: row.name as string });
  }

  const { data: suppliers, error: suppliersError } = await supabase
    .from("suppliers")
    .select("name")
    .order("name", { ascending: true });
  if (suppliersError) throw new Error(suppliersError.message);

  const priceSources: ProductsFilterOptions["priceSources"] = [{ value: "manual", label: "manual" }];
  for (const row of suppliers ?? []) {
    const name = String(row.name ?? "").trim();
    if (!name) continue;
    priceSources.push({ value: name, label: name });
  }

  return { categoryTree, priceSources };
}
