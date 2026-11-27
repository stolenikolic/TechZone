"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Apps from "@mui/icons-material/Apps";
import ViewList from "@mui/icons-material/ViewList";
import ProductFilters from "components/products-view/filters";
import MobileFilterButton from "components/products-view/filters/mobile-filter-button";
import CategoryActiveFilterChips from "components/products-view/filters/category-active-filter-chips";
import ProductsGridView from "components/products-view/products-grid-view";
import ProductsListView from "components/products-view/products-list-view";
import ProductPagination from "components/shop/product-pagination";
import SiteBreadcrumbs from "components/site-breadcrumbs/site-breadcrumbs";
import type { SiteBreadcrumbItem } from "components/site-breadcrumbs";
import type { CategorySidebarFilters } from "models/Filters";
import { FlexBetween, FlexBox } from "components/flex-box";
import { LISTING_SORT_OPTIONS } from "components/products-view/listing-sort-options";
import MobileSortButton from "components/products-view/mobile-sort-button";
import { useListingView } from "components/products-view/use-listing-view";
import { useListingSort } from "components/products-view/use-listing-sort";
import type { ListingView } from "lib/shop/listing-view";
import { parseListingSort, type ListingSort } from "lib/shop/listing-sort";
import type Product from "models/Product.model";

export interface CategoryProductsSectionProps {
  filters: CategorySidebarFilters;
  filterKey: string;
  title: string;
  products: Product[];
  page: number;
  totalProducts: number;
  /** Breadcrumbs iznad naslova kategorije. */
  breadcrumbItems?: SiteBreadcrumbItem[];
  /** Sačuvan izbor, ili list na telefonu i grid na širim ekranima. */
  initialListingView: ListingView;
  /** Sort iz adrese, ili sačuvani izbor kad adresa nema `sort`. */
  initialListingSort: ListingSort;
}

export default function CategoryProductsSection({
  filters,
  filterKey,
  title,
  products,
  page,
  totalProducts,
  breadcrumbItems,
  initialListingView,
  initialListingSort
}: CategoryProductsSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { view, setView } = useListingView(initialListingView);
  const { sort: savedSort, setSort } = useListingSort(initialListingSort);

  const sort = parseListingSort(searchParams.get("sort")) ?? savedSort;

  const navigateSearch = useCallback(
    (mutate: (p: URLSearchParams) => void, options?: { refreshServer?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      if (options?.refreshServer) {
        router.refresh();
      }
    },
    [pathname, router, searchParams]
  );

  const handleSortChange = (value: string) => {
    const next = parseListingSort(value);
    if (next) setSort(next);
    navigateSearch(
      (params) => {
        params.set("sort", value);
        params.delete("page");
      },
      { refreshServer: true }
    );
  };

  const handleViewChange = (value: ListingView) => {
    setView(value);
  };

  return (
    <>
      {breadcrumbItems && breadcrumbItems.length > 0 ? <SiteBreadcrumbs items={breadcrumbItems} /> : null}

      <Box mb={2}>
        <FlexBetween alignItems="center" gap={1}>
          <Box minWidth={0} flex={1}>
            <Typography variant="h5" sx={{ mb: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="body1" sx={{ color: "grey.600" }}>
              {totalProducts} rezultata
            </Typography>
          </Box>

          <FlexBox alignItems="center" sx={{ display: { xs: "flex", md: "none" } }}>
            <Typography variant="body1" sx={{ color: "grey.600", mr: 0.5 }}>
              Prikaz:
            </Typography>
            <IconButton onClick={() => handleViewChange("grid")} aria-label="Prikaz mreže">
              <Apps fontSize="small" color={view === "grid" ? "primary" : "inherit"} />
            </IconButton>
            <IconButton onClick={() => handleViewChange("list")} aria-label="Prikaz liste">
              <ViewList fontSize="small" color={view === "list" ? "primary" : "inherit"} />
            </IconButton>
          </FlexBox>

          <Box display={{ xs: "none", md: "block" }}>
          <FlexBox alignItems="center" columnGap={4} flexWrap="wrap">
            <FlexBox alignItems="center" gap={1} flex="1 1 0">
              <Typography variant="body1" sx={{ color: "grey.600", whiteSpace: "pre" }}>
                Sortiraj:
              </Typography>
              <TextField
                select
                fullWidth
                size="small"
                value={sort}
                variant="outlined"
                onChange={(e) => handleSortChange(e.target.value)}
                sx={{ flex: "1 1 0", minWidth: "150px" }}
              >
                {LISTING_SORT_OPTIONS.map((item) => (
                  <MenuItem value={item.value} key={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
            </FlexBox>

            <FlexBox alignItems="center" my="0.25rem">
              <Typography variant="body1" sx={{ color: "grey.600", mr: 1 }}>
                Prikaz:
              </Typography>
              <IconButton onClick={() => handleViewChange("grid")} aria-label="Prikaz mreže">
                <Apps fontSize="small" color={view === "grid" ? "primary" : "inherit"} />
              </IconButton>
              <IconButton onClick={() => handleViewChange("list")} aria-label="Prikaz liste">
                <ViewList fontSize="small" color={view === "list" ? "primary" : "inherit"} />
              </IconButton>
            </FlexBox>
          </FlexBox>
          </Box>
        </FlexBetween>

        <FlexBetween alignItems="center" gap={1} mt={1.5} sx={{ display: { xs: "flex", md: "none" } }}>
          <MobileFilterButton filters={filters} />
          <MobileSortButton value={sort} onChange={handleSortChange} />
        </FlexBetween>
      </Box>

      <Grid container spacing={4}>
        <Grid size={{ xl: 2, md: 3 }} sx={{ display: { md: "block", xs: "none" } }}>
          <ProductFilters key={filterKey} filters={filters} />
        </Grid>
        <Grid size={{ xl: 10, md: 9, xs: 12 }}>
          <CategoryActiveFilterChips filters={filters} />

          {view === "grid" ? (
            <ProductsGridView products={products} />
          ) : (
            <ProductsListView products={products} />
          )}
          <ProductPagination page={page} perPage={30} totalProducts={totalProducts} />
        </Grid>
      </Grid>
    </>
  );
}
