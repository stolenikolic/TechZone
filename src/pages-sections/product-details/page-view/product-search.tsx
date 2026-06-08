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
import Product from "models/Product.model";

const SORT_OPTIONS = [
  { label: "Relevance", value: "relevance" },
  { label: "Date", value: "date" },
  { label: "Price Low to High", value: "asc" },
  { label: "Price High to Low", value: "desc" }
];

interface Props {
  filters: ProductFilterCardFilters;
  products: Product[];
  pageCount: number;
  lastIndex: number;
  firstIndex: number;
  totalProducts: number;
}

export default function ProductSearchPageView({
  filters,
  products,
  pageCount,
  totalProducts
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.get("q");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const view = searchParams.get("view") || "grid";
  const sort = searchParams.get("sort") || "relevance";

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
    navigateSearch(
      (params) => {
        params.set("sort", value);
        params.delete("page");
      },
      { refreshServer: true }
    );
  };

  const handleViewChange = (value: string) => {
    navigateSearch((params) => {
      params.set("view", value);
    });
  };

  return (
    <div className="bg-white pt-2 pb-4">
      <Container>
        <SiteBreadcrumbs
          items={
            query
              ? [{ label: "Pretraga", href: "/products/search" }, { label: query }]
              : [{ label: "Pretraga" }]
          }
        />

        <FlexBetween flexWrap="wrap" gap={2} mb={2}>
          {query ? (
            <div>
              <Typography variant="h5" sx={{ mb: 0.5 }}>
                Pretraga: „{query}“
              </Typography>
              <Typography variant="body1" sx={{ color: "grey.600" }}>
                {totalProducts} rezultata
              </Typography>
            </div>
          ) : (
            <div />
          )}

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
                  {SORT_OPTIONS.map((item) => (
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

                <IconButton onClick={() => handleViewChange("grid")} aria-label="Grid view">
                  <Apps fontSize="small" color={view === "grid" ? "primary" : "inherit"} />
                </IconButton>

                <IconButton onClick={() => handleViewChange("list")} aria-label="List view">
                  <ViewList fontSize="small" color={view === "list" ? "primary" : "inherit"} />
                </IconButton>
              </FlexBox>
            </FlexBox>
          </Box>

          <Box
            display={{ xs: "flex", md: "none" }}
            flexDirection="column"
            gap={1.5}
            width="100%"
            maxWidth="100%"
          >
            <FlexBox alignItems="center" gap={1} width="100%">
              <Typography variant="body1" sx={{ color: "grey.600", whiteSpace: "nowrap" }}>
                Sortiraj:
              </Typography>

              <TextField
                select
                fullWidth
                size="small"
                value={sort}
                variant="outlined"
                onChange={(e) => handleSortChange(e.target.value)}
              >
                {SORT_OPTIONS.map((item) => (
                  <MenuItem value={item.value} key={item.value}>
                    {item.label}
                  </MenuItem>
                ))}
              </TextField>
            </FlexBox>

            <FlexBetween alignItems="center" gap={1}>
              <MobileFilterButton filters={filters} />

              <FlexBox alignItems="center">
                <IconButton onClick={() => handleViewChange("grid")} aria-label="Grid view">
                  <Apps fontSize="small" color={view === "grid" ? "primary" : "inherit"} />
                </IconButton>

                <IconButton onClick={() => handleViewChange("list")} aria-label="List view">
                  <ViewList fontSize="small" color={view === "list" ? "primary" : "inherit"} />
                </IconButton>
              </FlexBox>
            </FlexBetween>
          </Box>
        </FlexBetween>

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
