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
import FilterList from "@mui/icons-material/FilterList";
import Sidenav from "components/side-nav";
import ProductFilters from "components/products-view/filters";
import ProductsGridView from "components/products-view/products-grid-view";
import ProductsListView from "components/products-view/products-list-view";
import ProductPagination from "components/shop/product-pagination";
import type { CategorySidebarFilters } from "models/Filters";
import { FlexBetween, FlexBox } from "components/flex-box";
import type Product from "models/Product.model";

const SORT_OPTIONS = [
  { label: "Relevance", value: "relevance" },
  { label: "Date", value: "date" },
  { label: "Price Low to High", value: "asc" },
  { label: "Price High to Low", value: "desc" }
];

export interface CategoryProductsSectionProps {
  filters: CategorySidebarFilters;
  filterKey: string;
  title: string;
  products: Product[];
  page: number;
  totalProducts: number;
}

export default function CategoryProductsSection({
  filters,
  filterKey,
  title,
  products,
  page,
  totalProducts
}: CategoryProductsSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
    <>
      <FlexBetween flexWrap="wrap" gap={2} mb={2}>
        <div>
          <Typography variant="h5" sx={{ mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="body1" sx={{ color: "grey.600" }}>
            {totalProducts} results found
          </Typography>
        </div>

        <FlexBox alignItems="center" columnGap={4} flexWrap="wrap">
          <FlexBox alignItems="center" gap={1} flex="1 1 0">
            <Typography variant="body1" sx={{ color: "grey.600", whiteSpace: "pre" }}>
              Sort by:
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
              View:
            </Typography>
            <IconButton onClick={() => handleViewChange("grid")} aria-label="Grid view">
              <Apps fontSize="small" color={view === "grid" ? "primary" : "inherit"} />
            </IconButton>
            <IconButton onClick={() => handleViewChange("list")} aria-label="List view">
              <ViewList fontSize="small" color={view === "list" ? "primary" : "inherit"} />
            </IconButton>
            <Box display={{ md: "none", xs: "block" }}>
              <Sidenav
                handler={(close) => (
                  <IconButton onClick={close}>
                    <FilterList fontSize="small" />
                  </IconButton>
                )}
              >
                <Box px={3} py={2}>
                  <ProductFilters filters={filters} />
                </Box>
              </Sidenav>
            </Box>
          </FlexBox>
        </FlexBox>
      </FlexBetween>

      <Grid container spacing={4}>
        <Grid size={{ xl: 2, md: 3 }} sx={{ display: { md: "block", xs: "none" } }}>
          <ProductFilters key={filterKey} filters={filters} />
        </Grid>
        <Grid size={{ xl: 10, md: 9, xs: 12 }}>
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
