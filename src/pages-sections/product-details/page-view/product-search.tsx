"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Apps from "@mui/icons-material/Apps";
import ViewList from "@mui/icons-material/ViewList";
import SiteBreadcrumbs from "components/site-breadcrumbs/site-breadcrumbs";
import { FlexBetween, FlexBox } from "components/flex-box";
import ProductFilters from "components/products-view/filters";
import MobileFilterButton from "components/products-view/filters/mobile-filter-button";
import SearchActiveFilterChips from "components/products-view/filters/search-active-filter-chips";
import ProductPagination from "components/shop/product-pagination";
import { isSearchPageFilters } from "models/Filters";
import ProductsGridView from "components/products-view/products-grid-view";
import ProductsListView from "components/products-view/products-list-view";
import type { ProductFilterCardFilters } from "components/products-view/filters/use-product-filter-card";
import { LISTING_SORT_OPTIONS } from "components/products-view/listing-sort-options";
import MobileSortButton from "components/products-view/mobile-sort-button";
import { useListingView } from "components/products-view/use-listing-view";
import { useListingSort } from "components/products-view/use-listing-sort";
import type { ListingView } from "lib/shop/listing-view";
import { parseListingSort, type ListingSort } from "lib/shop/listing-sort";
import Product from "models/Product.model";

interface Props {
  filters: ProductFilterCardFilters;
  products: Product[];
  pageCount: number;
  lastIndex: number;
  firstIndex: number;
  totalProducts: number;
  initialListingView: ListingView;
  initialListingSort: ListingSort;
}

export default function ProductSearchPageView({
  filters,
  products,
  pageCount,
  totalProducts,
  initialListingView,
  initialListingSort
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { view, setView } = useListingView(initialListingView);
  const { sort: savedSort, setSort } = useListingSort(initialListingSort);

  const query = searchParams.get("q");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
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
    <div className="bg-white pt-1 pb-4">
      <Container>
        <SiteBreadcrumbs
          items={
            query
              ? [{ label: "Pretraga", href: "/pretraga" }, { label: query }]
              : [{ label: "Pretraga" }]
          }
        />

        <Box mb={2}>
          <FlexBetween alignItems="center" gap={1}>
            <Box minWidth={0} flex={1}>
              {query ? (
                <>
                  <Typography variant="h5" sx={{ mb: 0.5 }}>
                    Pretraga: „{query}“
                  </Typography>
                  <Typography variant="body1" sx={{ color: "grey.600" }}>
                    {totalProducts} rezultata
                  </Typography>
                </>
              ) : null}
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
            <ProductFilters filters={filters} />
          </Grid>

          <Grid size={{ xl: 10, md: 9, xs: 12 }}>
            {isSearchPageFilters(filters) && <SearchActiveFilterChips filters={filters} />}

            {view === "grid" ? (
              <ProductsGridView products={products} />
            ) : (
              <ProductsListView products={products} />
            )}

            <ProductPagination page={page} perPage={30} totalProducts={totalProducts} />
          </Grid>
        </Grid>
      </Container>
    </div>
  );
}
