"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
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
import { currency } from "lib";

// TABLE HEADING DATA LIST
const tableHeading = [
  { id: "name", label: "Name", align: "left" },
  { id: "category", label: "Category", align: "left" },
  { id: "brand", label: "Brand", align: "left" },
  { id: "masterStatusSort", label: "Master Status", align: "left" },
  { id: "effectivePriceSource", label: "Price source", align: "left" },
  { id: "effectivePrice", label: "Effective Price", align: "left" },
  { id: "basePrice", label: "Price (Engine)", align: "left" },
  { id: "customPrice", label: "Custom Price", align: "left" },
  { id: "published", label: "Published", align: "left" },
  { id: "action", label: "Action", align: "center" }
];

// =============================================================================
type AdminProduct = Product & {
  basePrice?: number | null;
  customPrice?: number | null;
  effectivePrice?: number;
  effectivePriceSource?: string | null;
  linkedSuppliers?: { code: string; name: string }[];
};
type Props = { products: Product[] };
type MasterStatusValue = NonNullable<Product["masterStatus"]>["value"];
type QuickFilter = "all" | MasterStatusValue;
// =============================================================================

export default function ProductsPageView({ products }: Props) {
  const adminProducts = products as AdminProduct[];
  const [query, setQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [parentCategoryFilter, setParentCategoryFilter] = useState("all");
  const [childCategoryFilter, setChildCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [publishedFilter, setPublishedFilter] = useState("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [offersByProduct, setOffersByProduct] = useState<
    Record<
      string,
      {
        loading: boolean;
        error: string | null;
        rows: {
          id: string;
          supplierProductId: string;
          supplierName: string;
          supplierCode: string;
          priceAmountHuf: number | null;
          currency: string;
          acquisitionKm: number | null;
          sellingKm: number | null;
          isActive: boolean;
          updatedAt: string;
        }[];
      }
    >
  >({});

  const formatDate = (value: string) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
  };

  const huf = (value: number | null) => {
    if (value == null || !Number.isFinite(value)) return "-";
    return `${Math.round(value)} HUF`;
  };

  const OfferActiveChip = ({ isActive }: { isActive: boolean }) => (
    <Chip
      label={isActive ? "active" : "inactive"}
      color={isActive ? "success" : "error"}
      size="small"
      variant="outlined"
    />
  );

  const loadOffers = async (product: {
    id: string;
    name: string;
  }) => {
    setOffersByProduct((prev) => ({
      ...prev,
      [product.id]: { loading: true, error: null, rows: prev[product.id]?.rows ?? [] }
    }));
    try {
      const response = await fetch(`/api/admin/products/${product.id}/offers`, {
        cache: "no-store"
      });
      const data = (await response.json()) as
        | {
            error?: string;
          }
        | {
            id: string;
            supplierProductId: string;
            supplierName: string;
            supplierCode: string;
            priceAmountHuf: number | null;
            currency: string;
            acquisitionKm: number | null;
            sellingKm: number | null;
            isActive: boolean;
            updatedAt: string;
          }[];
      if (!response.ok || !Array.isArray(data)) {
        const err = !Array.isArray(data) ? data.error : "Failed to load offers.";
        throw new Error(err || "Failed to load offers.");
      }
      setOffersByProduct((prev) => ({
        ...prev,
        [product.id]: { loading: false, error: null, rows: data }
      }));
    } catch (err) {
      setOffersByProduct((prev) => ({
        ...prev,
        [product.id]: {
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load offers.",
          rows: []
        }
      }));
    }
  };

  const toggleExpand = async (product: { id: string; name: string }) => {
    setExpandedProductId((current) => (current === product.id ? null : product.id));
    const existing = offersByProduct[product.id];
    if (!existing || (!existing.loading && existing.rows.length === 0 && !existing.error)) {
      await loadOffers(product);
    }
  };

  const counters = useMemo(() => {
    const needsAttributesProducts = adminProducts.filter(
      (item) => item.masterStatus?.value === "needs_attributes"
    );
    return {
      all: adminProducts.length,
      ready: adminProducts.filter((item) => item.masterStatus?.value === "ready").length,
      unlinked: adminProducts.filter((item) => item.masterStatus?.value === "unlinked").length,
      linked: adminProducts.filter((item) => item.masterStatus?.value === "linked").length,
      /** Number of master products that miss ≥1 required category attribute (not a sum of missing fields). */
      needs_attributes: needsAttributesProducts.length
    };
  }, [adminProducts]);

  const quickFilters: { value: QuickFilter; label: string; count: number; countHint?: string }[] = [
    { value: "all", label: "All", count: counters.all },
    { value: "ready", label: "Ready", count: counters.ready },
    { value: "unlinked", label: "Unlinked", count: counters.unlinked },
    { value: "linked", label: "Linked", count: counters.linked },
    {
      value: "needs_attributes",
      label: "Needs attributes",
      count: counters.needs_attributes,
      countHint: "products"
    }
  ];

  const categoryTree = useMemo(() => {
    const tree = new Map<string, { name: string; children: { slug: string; name: string }[] }>();
    for (const item of adminProducts) {
      const childSlug = item.category?.slug;
      const childName = item.category?.name ?? item.categories[0] ?? "-";
      const parentSlug = item.parentCategory?.slug ?? childSlug ?? "";
      const parentName = item.parentCategory?.name ?? childName;
      if (!parentSlug) continue;
      const parent: { name: string; children: { slug: string; name: string }[] } =
        tree.get(parentSlug) ?? { name: parentName, children: [] };
      if (
        childSlug &&
        childSlug !== parentSlug &&
        !parent.children.some((c) => c.slug === childSlug)
      ) {
        parent.children.push({ slug: childSlug, name: childName });
      }
      tree.set(parentSlug, parent);
    }
    return tree;
  }, [adminProducts]);

  const parentCategoryOptions = useMemo(() => {
    return [
      { value: "all", label: "all" },
      ...Array.from(categoryTree.entries())
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
        .map(([slug, value]) => ({ value: slug, label: value.name }))
    ];
  }, [categoryTree]);

  const childCategoryOptions = useMemo(() => {
    if (parentCategoryFilter === "all") return [{ value: "all", label: "all" }];
    const parent = categoryTree.get(parentCategoryFilter);
    if (!parent) return [{ value: "all", label: "all" }];
    return [
      { value: "all", label: "all" },
      ...[...parent.children]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ value: c.slug, label: c.name }))
    ];
  }, [parentCategoryFilter, categoryTree]);

  const supplierOptions = useMemo(() => {
    const priceSources = new Set<string>();
    for (const item of adminProducts) {
      const source = item.effectivePriceSource;
      if (source && source !== "manual") priceSources.add(source);
    }
    return [
      { value: "all", label: "all" },
      { value: "manual", label: "manual" },
      ...Array.from(priceSources)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ value: name, label: name }))
    ];
  }, [adminProducts]);

  // RESHAPE THE PRODUCT LIST BASED TABLE HEAD CELL ID
  const reshapedProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return adminProducts
      .filter((item) => {
        const status = item.masterStatus?.value ?? "linked";
        if (quickFilter !== "all" && status !== quickFilter) return false;
        if (parentCategoryFilter !== "all") {
          const parentSlug = item.parentCategory?.slug ?? item.category?.slug ?? "";
          if (parentSlug !== parentCategoryFilter) return false;
        }
        if (childCategoryFilter !== "all") {
          const childSlug = item.category?.slug ?? "";
          if (childSlug !== childCategoryFilter) return false;
        }
        if (supplierFilter !== "all" && item.effectivePriceSource !== supplierFilter) {
          return false;
        }
        if (publishedFilter !== "all") {
          const shouldBePublished = publishedFilter === "published";
          if ((item.published ?? false) !== shouldBePublished) return false;
        }
        const effectivePrice = Number(item.effectivePrice ?? item.price ?? 0);
        if (priceMin.trim() !== "") {
          const min = Number(priceMin);
          if (Number.isFinite(min) && effectivePrice < min) return false;
        }
        if (priceMax.trim() !== "") {
          const max = Number(priceMax);
          if (Number.isFinite(max) && effectivePrice > max) return false;
        }
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
      .map((item) => {
        const effectivePrice = Number(item.effectivePrice ?? item.price ?? 0);
        return {
          id: item.id,
          slug: item.slug,
          name: item.title,
          brand: item.brand ?? "",
          effectivePrice,
          effectivePriceSource: item.effectivePriceSource ?? null,
          basePrice: item.basePrice ?? null,
          customPrice: item.customPrice ?? null,
          price: effectivePrice,
          image: item.thumbnail,
          published: item.published!,
          category:
            item.parentCategory && item.category
              ? `${item.parentCategory.name} / ${item.category.name}`
              : item.categories[0] ?? "-",
          masterStatus: item.masterStatus,
          masterStatusSort: item.masterStatus?.label ?? ""
        };
      });
  }, [adminProducts, query, quickFilter, parentCategoryFilter, childCategoryFilter, supplierFilter, publishedFilter, priceMin, priceMax]);

  const { order, orderBy, rowsPerPage, filteredList, handleChangePage, handleRequestSort } =
    useMuiTable({ listData: reshapedProducts });

  return (
    <PageWrapper title="Product List">
      <Stack direction="row" justifyContent="flex-end" mb={2}>
        <Button href="/admin/products/create" color="info" variant="contained" LinkComponent={Link}>
          Add Product
        </Button>
      </Stack>

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
              {item.countHint ? (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                  {item.countHint} — each row counts once
                </Typography>
              ) : null}
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xl: "row", xs: "column" }}
          spacing={1.5}
          alignItems={{ xl: "center", xs: "stretch" }}
          sx={{ flexWrap: "wrap" }}
        >
          <TextField
            size="small"
            label="Search products"
            placeholder="Name, brand, category, status..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            sx={{ minWidth: 220, flex: 1 }}
          />
          <TextField
            select
            size="small"
            label="Suppliers"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            sx={{ minWidth: 150 }}
          >
            {supplierOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Category"
            value={parentCategoryFilter}
            onChange={(e) => {
              setParentCategoryFilter(e.target.value);
              setChildCategoryFilter("all");
            }}
            sx={{ minWidth: 180 }}
          >
            {parentCategoryOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                  {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Subcategory"
            value={childCategoryFilter}
            onChange={(e) => setChildCategoryFilter(e.target.value)}
            sx={{ minWidth: 180 }}
            disabled={parentCategoryFilter === "all"}
          >
            {childCategoryOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type="number"
            label="Price min"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            sx={{ width: 110 }}
            inputProps={{ min: 0, max: 99999 }}
          />
          <TextField
            size="small"
            type="number"
            label="Price max"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            sx={{ width: 110 }}
            inputProps={{ min: 0, max: 99999 }}
          />
          <TextField
            select
            size="small"
            label="Published"
            value={publishedFilter}
            onChange={(e) => setPublishedFilter(e.target.value)}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="all">all</MenuItem>
            <MenuItem value="published">published</MenuItem>
            <MenuItem value="unpublished">unpublished</MenuItem>
          </TextField>
          <Button
            size="small"
            onClick={() => {
              setParentCategoryFilter("all");
              setChildCategoryFilter("all");
              setSupplierFilter("all");
              setPublishedFilter("all");
              setPriceMin("");
              setPriceMax("");
              setQuery("");
              setQuickFilter("all");
            }}
          >
            Reset filters
          </Button>
        </Stack>
      </Card>

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
                  <Fragment key={index}>
                    <ProductRow product={product} onToggleExpand={(p) => void toggleExpand({ id: p.id, name: p.name })} />
                    <TableRow>
                      <TableCell colSpan={tableHeading.length} sx={{ py: 0 }}>
                        <Collapse in={expandedProductId === product.id} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                              Linked supplier offers
                            </Typography>
                            {offersByProduct[product.id]?.loading ? (
                              <Typography>Loading offers...</Typography>
                            ) : offersByProduct[product.id]?.error ? (
                              <Typography color="error">{offersByProduct[product.id]?.error}</Typography>
                            ) : (offersByProduct[product.id]?.rows ?? []).length === 0 ? (
                              <Typography>No linked offers for this product.</Typography>
                            ) : (
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Supplier</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Supplier Product ID</TableCell>
                                    <TableCell align="right">Price (HUF)</TableCell>
                                    <TableCell align="right">Nabavna (KM)</TableCell>
                                    <TableCell align="right">Prodajna (KM)</TableCell>
                                    <TableCell align="right">Updated</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {(offersByProduct[product.id]?.rows ?? []).map((row) => (
                                    <TableRow
                                      key={row.id}
                                      sx={
                                        row.isActive
                                          ? undefined
                                          : {
                                              opacity: 0.62,
                                              filter: "blur(0.35px)"
                                            }
                                      }
                                    >
                                      <TableCell>
                                        {row.supplierName}
                                        <Typography variant="caption" display="block" color="text.secondary">
                                          {row.supplierCode}
                                        </Typography>
                                      </TableCell>
                                      <TableCell>
                                        <OfferActiveChip isActive={row.isActive} />
                                      </TableCell>
                                      <TableCell
                                        sx={{
                                          maxWidth: 220,
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap"
                                        }}
                                        title={row.supplierProductId}
                                      >
                                        {row.supplierProductId}
                                      </TableCell>
                                      <TableCell align="right">{huf(row.priceAmountHuf)}</TableCell>
                                      <TableCell align="right">
                                        {row.acquisitionKm != null ? currency(row.acquisitionKm) : "-"}
                                      </TableCell>
                                      <TableCell align="right">
                                        {row.sellingKm != null ? currency(row.sellingKm) : "-"}
                                      </TableCell>
                                      <TableCell align="right">{formatDate(row.updatedAt)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
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
