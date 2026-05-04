"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// GLOBAL CUSTOM COMPONENTS
import OverlayScrollbar from "components/overlay-scrollbar";
import { TableHeader, TablePagination } from "components/data-table";
// GLOBAL CUSTOM HOOK
import useMuiTable from "hooks/useMuiTable";
//  LOCAL CUSTOM COMPONENT
import ProductRow from "../product-row";
import PageWrapper from "../../page-wrapper";
// CUSTOM DATA MODEL
import Product from "models/Product.model";

// TABLE HEADING DATA LIST
const tableHeading = [
  { id: "name", label: "Name", align: "left" },
  { id: "category", label: "Category", align: "left" },
  { id: "brand", label: "Brand", align: "left" },
  { id: "masterStatusSort", label: "Master Status", align: "left" },
  { id: "price", label: "Price", align: "left" },
  { id: "published", label: "Published", align: "left" },
  { id: "action", label: "Action", align: "center" }
];

// =============================================================================
type Props = { products: Product[] };
type MasterStatusValue = NonNullable<Product["masterStatus"]>["value"];
type QuickFilter = "all" | MasterStatusValue;
// =============================================================================

export default function ProductsPageView({ products }: Props) {
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const counters = useMemo(
    () => ({
      all: products.length,
      ready: products.filter((item) => item.masterStatus?.value === "ready").length,
      unlinked: products.filter((item) => item.masterStatus?.value === "unlinked").length,
      linked: products.filter((item) => item.masterStatus?.value === "linked").length,
      needs_attributes: products.filter((item) => item.masterStatus?.value === "needs_attributes").length
    }),
    [products]
  );

  const quickFilters: { value: QuickFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: counters.all },
    { value: "ready", label: "Ready", count: counters.ready },
    { value: "unlinked", label: "Unlinked", count: counters.unlinked },
    { value: "linked", label: "Linked", count: counters.linked },
    { value: "needs_attributes", label: "Needs Attributes", count: counters.needs_attributes }
  ];

  // RESHAPE THE PRODUCT LIST BASED TABLE HEAD CELL ID
  const reshapedProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((item) => {
        const status = item.masterStatus?.value ?? "linked";
        if (quickFilter !== "all" && status !== quickFilter) return false;
        if (!q) return true;

        const haystack = [
          item.title,
          item.brand ?? "",
          item.categories[0] ?? "",
          item.masterStatus?.label ?? "",
          item.masterStatus?.tooltip ?? ""
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      })
      .map((item) => ({
        id: item.id,
        slug: item.slug,
        name: item.title,
        brand: item.brand ?? "",
        price: item.price,
        image: item.thumbnail,
        published: item.published!,
        category: item.categories[0] ?? "-",
        masterStatus: item.masterStatus,
        masterStatusSort: item.masterStatus?.label ?? ""
      }));
  }, [products, query, quickFilter]);

  const { order, orderBy, rowsPerPage, filteredList, handleChangePage, handleRequestSort } =
    useMuiTable({ listData: reshapedProducts });

  return (
    <PageWrapper title="Product List">
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {quickFilters.map((item) => (
          <Grid key={item.value} size={{ lg: 2.4, md: 4, sm: 6, xs: 12 }}>
            <Card
              onClick={() => setQuickFilter(item.value)}
              sx={{
                p: 2,
                cursor: "pointer",
                border: "1px solid",
                borderColor: quickFilter === item.value ? "info.main" : "divider",
                bgcolor: quickFilter === item.value ? "action.hover" : "background.paper"
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {item.label}
              </Typography>
              <Typography variant="h4">{item.count}</Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Stack direction={{ md: "row", xs: "column" }} justifyContent="space-between" gap={2} mb={2}>
        <TextField
          size="small"
          label="Search products"
          placeholder="Name, brand, category, status..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ minWidth: { md: 420, xs: "100%" } }}
        />

        <Button href="/admin/products/create" color="info" variant="contained" LinkComponent={Link}>
          Add Product
        </Button>
      </Stack>

      <Card>
        <OverlayScrollbar>
          <TableContainer sx={{ width: "100%" }}>
            <Table>
              <TableHeader
                order={order}
                orderBy={orderBy}
                heading={tableHeading}
                onRequestSort={handleRequestSort}
              />

              <TableBody>
                {filteredList.map((product, index) => (
                  <ProductRow key={index} product={product} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </OverlayScrollbar>

        <Stack alignItems="center" my={4}>
          <TablePagination
            onChange={handleChangePage}
            count={Math.max(1, Math.ceil(reshapedProducts.length / rowsPerPage))}
          />
        </Stack>
      </Card>
    </PageWrapper>
  );
}
