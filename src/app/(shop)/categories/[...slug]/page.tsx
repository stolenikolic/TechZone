import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Container from "@mui/material/Container";
import CategoryProductsSection from "components/products-view/category-products-section";
import CategoryBrowser, { type CategoryTreeNode } from "pages-sections/categories";
import { SiteBreadcrumbs } from "components/site-breadcrumbs";
import type { SiteBreadcrumbItem } from "components/site-breadcrumbs";
import api from "utils/__api__/homepage";
import {
  getCategoryImageUrlForPath,
  getCategoryPageData,
  getCategoryProductsForPath
} from "lib/shop-category-listing";
import { absoluteOgImageUrl } from "lib/og-image-url";
import { ogPageTitle, SITE_NAME } from "lib/site-metadata";
import { getCategoryBreadcrumbTrail } from "lib/shop/category-breadcrumb-trail";
import type { Category, CategorySidebarFilters } from "models/Filters";
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

function buildCategoryBreadcrumbItems(
  categories: CategoryTreeNode[],
  pathSegments: string[],
  fallbackTitle: string
): SiteBreadcrumbItem[] {
  const trail = getCategoryBreadcrumbTrail(categories, pathSegments);
  if (!trail.length) {
    return [{ label: "Kategorije", href: "/categories" }, { label: fallbackTitle }];
  }
  return [
    { label: "Kategorije", href: "/categories" },
    ...trail.slice(0, -1).map((t) => ({ label: t.name, href: `/categories/${t.slugPath}` })),
    { label: trail[trail.length - 1].name }
  ];
}

/** Map homepage category tree to Filters.categories shape for ProductFilters sidebar. */
function buildFiltersCategories(
  categories: { name: string; slug: string; parent?: Array<{ name: string; slug: string } | string> }[] | null
): Category[] {
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
  const metaResult = categoryPath
    ? await getCategoryProductsForPath(categoryPath, effectiveParams)
    : null;
  if (!metaResult || "status" in metaResult) {
    return { title: "Kategorija nije pronađena | Tech Zone" };
  }
  const payload = metaResult;

  const basePath = `/categories/${categoryPath}`;
  const seoPath =
    filterSegments.length > 0 ? `${basePath}/${filterSegments.join("/")}` : basePath;
  const canonical =
    pageNum > 1 ? `${seoPath}?page=${pageNum}` : seoPath;

  const categoryLabel =
    pageNum > 1
      ? `${payload.category.name} – Strana ${pageNum}`
      : payload.category.name;
  const title = `${categoryLabel} | Tech Zone`;
  const ogTitle = ogPageTitle(categoryLabel);

  const description = `Proizvodi u kategoriji ${payload.category.name} na Tech Zone online prodavnici.`;
  const ogImageUrl = absoluteOgImageUrl(await getCategoryImageUrlForPath(categoryPath));

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: ogTitle,
      description,
      type: "website",
      url: canonical,
      siteName: SITE_NAME,
      images: [{ url: ogImageUrl, alt: payload.category.name }]
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: [ogImageUrl]
    }
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
    const categoryCrumbs = buildCategoryBreadcrumbItems(
      categories,
      categoryPathSegments,
      currentCategory.name
    );
    return (
      <div className="bg-white pt-2 pb-4">
        <CategoryBrowser
          breadcrumbs={<SiteBreadcrumbs items={categoryCrumbs} />}
          categories={subcategories}
          title={currentCategory.name}
          description="Izaberi podkategoriju da nastaviš ka proizvodima."
          pathPrefix={categoryPathSegments}
        />
      </div>
    );
  }

  const pageData = await getCategoryPageData(categoryPath, page, effectiveFilterParams);

  if (!pageData || "error" in pageData) notFound();

  const { listing: payload, filters: categoryFilters } = pageData;

  const sidebarFilters: CategorySidebarFilters = {
    filters: categoryFilters.filters ?? [],
    priceRange: categoryFilters.priceRange,
    categories: buildFiltersCategories(categories)
  };

  const filterKey =
    filterSegments.length > 0 ? `${categoryPath}-${filterSegments.join("-")}` : categoryPath;

  const listingCrumbs = buildCategoryBreadcrumbItems(
    categories,
    categoryPathSegments,
    payload.category.name
  );

  return (
    <div className="bg-white pt-2 pb-4">
      <Container>
        <CategoryProductsSection
          breadcrumbItems={listingCrumbs}
          filterKey={filterKey}
          filters={sidebarFilters}
          title={payload.category.name}
          products={payload.products}
          page={payload.page}
          totalProducts={payload.total}
        />
      </Container>
    </div>
  );
}
