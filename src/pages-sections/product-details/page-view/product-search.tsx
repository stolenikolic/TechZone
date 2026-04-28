"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
// MUI
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Pagination from "@mui/material/Pagination";
import Typography from "@mui/material/Typography";
// MUI ICON COMPONENTS
import Apps from "@mui/icons-material/Apps";
import ViewList from "@mui/icons-material/ViewList";
import FilterList from "@mui/icons-material/FilterList";
// GLOBAL CUSTOM COMPONENTS
import Sidenav from "components/side-nav";
import { FlexBetween, FlexBox } from "components/flex-box";
import ProductFilters from "components/products-view/filters";
import ProductsGridView from "components/products-view/products-grid-view";
import ProductsListView from "components/products-view/products-list-view";
// TYPES
import type { ProductFilterCardFilters } from "components/products-view/filters/use-product-filter-card";
import Product from "models/Product.model";

const SORT_OPTIONS = [
  { label: "Relevance", value: "relevance" },
  { label: "Date", value: "date" },
  { label: "Price Low to High", value: "asc" },
  { label: "Price High to Low", value: "desc" }
];

// ==============================================================
interface Props {
  filters: ProductFilterCardFilters;
  products: Product[];
  pageCount: number;
  lastIndex: number;
  firstIndex: number;
  totalProducts: number;
}
// ==============================================================

export default function ProductSearchPageView({
  filters,
  products,
  pageCount,
  lastIndex,
  firstIndex,
  totalProducts
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.get("q");
  const page = searchParams.get("page") || "1";
  const view = searchParams.get("view") || "grid";
  const sort = searchParams.get("sort") || "relevance";

  const handleChangeSearchParams = (key: string, value: string) => {
    if (!key || !value) return;
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="bg-white pt-2 pb-4">
      <Container>
        {/* FILTER ACTION AREA */}
        <FlexBetween flexWrap="wrap" gap={2} mb={2}>
          {query ? (
            <div>
              <Typography variant="h5" sx={{ mb: 0.5 }}>
                Searching for “{query}”
              </Typography>
              <Typography variant="body1" sx={{ color: "grey.600" }}>
                {products.length} results found
              </Typography>
            </div>
          ) : (
            <div />
          )}

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
                placeholder="Sort by"
                onChange={(e) => handleChangeSearchParams("sort", e.target.value)}
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

              <IconButton onClick={() => handleChangeSearchParams("view", "grid")}>
                <Apps fontSize="small" color={view === "grid" ? "primary" : "inherit"} />
              </IconButton>

              <IconButton onClick={() => handleChangeSearchParams("view", "list")}>
                <ViewList fontSize="small" color={view === "list" ? "primary" : "inherit"} />
              </IconButton>

              {/* SHOW IN THE SMALL DEVICE */}
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
          {/* PRODUCT FILTER SIDEBAR AREA */}
          <Grid size={{ xl: 2, md: 3 }} sx={{ display: { md: "block", xs: "none" } }}>
            <ProductFilters filters={filters} />
          </Grid>

          {/* PRODUCT VIEW AREA */}
          <Grid size={{ xl: 10, md: 9, xs: 12 }}>
            {view === "grid" ? (
              <ProductsGridView products={products} />
            ) : (
              <ProductsListView products={products} />
            )}

            <FlexBetween flexWrap="wrap" mt={6}>
              <Typography variant="body1" sx={{ color: "grey.600" }}>
                Showing {firstIndex}-{lastIndex} of {totalProducts} Products
              </Typography>

              <Pagination
                color="primary"
                variant="outlined"
                page={+page}
                count={pageCount}
                onChange={(_, page) => handleChangeSearchParams("page", page.toString())}
              />
            </FlexBetween>
          </Grid>
        </Grid>
      </Container>
    </div>
  );
}
