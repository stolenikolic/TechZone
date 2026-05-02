import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Grid from "@mui/material/Grid";
import Container from "@mui/material/Container";
import ProductFilters from "components/products-view/filters";
import ProductsGridView from "components/products-view/products-grid-view";
import ProductPagination from "components/shop/product-pagination";
import CategoryBrowser, { type CategoryTreeNode } from "pages-sections/categories";
import api from "utils/__api__/market-2";
import type Filters from "models/Filters";
import type { CategorySidebarFilters } from "models/Filters";
import { seoFilterSegmentsToParams } from "utils/seo-filter-slug";

interface CategoryPageParams {
  params: Promise<{ slug: string[] }>;
  searchParams?: Promise<{ page?: string }>;
}

/** Category path = first 2 segments (parent/child). Trailing segments = SEO filters. */
const CATEGORY_PATH_SEGMENT_COUNT = 2;

/**
 * Parse catch-all slug into category path and SEO filter segments.
 * ["racunarske-komponente", "hard-diskovi"] → category only.
 * ["racunarske-komponente", "hard-diskovi", "wd"] → category + brand filter.
 * ["racunarske-komponente", "hard-diskovi", "wd", "4tb"] → category + brand + capacity.
 */
function resolvePathAndFilter(slugParts: string[]): {
  categoryPath: string;
  filterSegments: string[];
  filterParams: Record<string, string>;
} {
  if (slugParts.length <= CATEGORY_PATH_SEGMENT_COUNT) {
    const categoryPath = slugParts.length > 0 ? slugParts.join("/") : "";
    return { categoryPath, filterSegments: [], filterParams: {} };
  }
  const categoryPath = slugParts.slice(0, CATEGORY_PATH_SEGMENT_COUNT).join("/");
  const filterSegments = slugParts.slice(CATEGORY_PATH_SEGMENT_COUNT);
  const filterParams = seoFilterSegmentsToParams(filterSegments);
  return { categoryPath, filterSegments, filterParams };
}

/** Map market-2 category tree to Filters.categories shape for ProductFilters sidebar. */
function buildFiltersCategories(
  categories: { name: string; slug: string; parent?: Array<{ name: string; slug: string } | string> }[] | null
): Filters["categories"] {
  if (!categories || !Array.isArray(categories)) return [];
  return categories.map((item) => {
    const children =
      item.parent && item.parent.length > 0
        ? item.parent.map((c) =>
            typeof c === "string"
              ? c
              : {
                  title: c.name,
                  href: `/categories/${item.slug}/${c.slug}`
                })
        : undefined;
    return { title: item.name, ...(children?.length ? { children } : {}) };
  });
}

function findCategoryNode(
  categories: CategoryTreeNode[] | null,
  pathSegments: string[]
): CategoryTreeNode | null {
  let currentLevel = categories ?? [];
  let currentNode: CategoryTreeNode | null = null;

  for (const segment of pathSegments) {
    currentNode = currentLevel.find((item) => item.slug === segment) ?? null;
    if (!currentNode) return null;
    currentLevel = currentNode.parent ?? [];
  }

  return currentNode;
}

export async function generateMetadata({ params, searchParams }: CategoryPageParams): Promise<Metadata> {
  const { slug } = await params;
  const slugParts = Array.isArray(slug) ? slug : [];
  const { categoryPath, filterSegments, filterParams } = resolvePathAndFilter(slugParts);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const pageNum = Math.max(1, parseInt(String(resolvedSearchParams?.page ?? "1"), 10) || 1);

  const queryParams = resolvedSearchParams as Record<string, string>;
  const effectiveParams = { ...filterParams, ...queryParams };
  const payload = categoryPath
    ? await api.getCategoryBySlug(categoryPath, 1, effectiveParams)
    : null;
  if (!payload) return { title: "Category Not Found" };

  const basePath = `/categories/${categoryPath}`;
  const seoPath =
    filterSegments.length > 0 ? `${basePath}/${filterSegments.join("/")}` : basePath;
  const canonical =
    pageNum > 1 ? `${seoPath}?page=${pageNum}` : seoPath;

  const title =
    pageNum > 1
      ? `${payload.category.name} – Page ${pageNum} – Tech Zone`
      : `${payload.category.name} – Tech Zone`;

  return {
    title,
    description: `Products in ${payload.category.name}`,
    alternates: { canonical }
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageParams) {
  const { slug } = await params;
  const slugParts = Array.isArray(slug) && slug.length > 0 ? slug : [];
  const search = await searchParams ?? {};
  const page = Math.max(1, parseInt(String(search?.page ?? "1"), 10) || 1);

  const { categoryPath, filterSegments, filterParams } = resolvePathAndFilter(slugParts);
  const queryParams = search as Record<string, string | string[] | undefined>;
  const effectiveFilterParams = { ...filterParams, ...queryParams };

  if (!categoryPath) notFound();

  const categories = (await api.getCategories()) as unknown as CategoryTreeNode[];
  const categoryPathSegments = categoryPath.split("/").filter(Boolean);
  const currentCategory = findCategoryNode(categories, categoryPathSegments);
  const subcategories = currentCategory?.parent ?? [];

  if (filterSegments.length === 0 && currentCategory && subcategories.length > 0) {
    return (
      <div className="bg-white pt-2 pb-4">
        <CategoryBrowser
          categories={subcategories}
          title={currentCategory.name}
          description="Izaberi podkategoriju da nastaviš ka proizvodima."
          pathPrefix={categoryPathSegments}
        />
      </div>
    );
  }

  const [payload, categoryFilters] = await Promise.all([
    api.getCategoryBySlug(categoryPath, page, effectiveFilterParams),
    api.getCategoryFilters(categoryPath)
  ]);

  if (!payload) notFound();

  const sidebarFilters: CategorySidebarFilters = {
    filters: categoryFilters?.filters ?? [],
    priceRange: categoryFilters?.priceRange,
    categories: buildFiltersCategories(categories)
  };

  const filterKey =
    filterSegments.length > 0 ? `${categoryPath}-${filterSegments.join("-")}` : categoryPath;

  return (
    <div className="bg-white pt-2 pb-4">
      <Container>
        <Grid container spacing={4}>
          <Grid size={{ xl: 2, md: 3 }} sx={{ display: { md: "block", xs: "none" } }}>
            <ProductFilters key={filterKey} filters={sidebarFilters} />
          </Grid>
          <Grid size={{ xl: 10, md: 9, xs: 12 }}>
            <ProductsGridView products={payload.products} />
            <ProductPagination
              page={payload.page}
              perPage={30}
              totalProducts={payload.total}
            />
          </Grid>
        </Grid>
      </Container>
    </div>
  );
}
