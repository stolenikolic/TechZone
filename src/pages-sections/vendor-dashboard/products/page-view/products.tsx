"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
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
import OverlayScrollbar from "components/overlay-scrollbar";
import { TableHeader, TablePagination } from "components/data-table";
import useMuiTable, { getComparator, stableSort } from "hooks/useMuiTable";
import { useDebouncedValue } from "hooks/useDebouncedValue";
import ProductRow from "../product-row";
import PageWrapper from "../../page-wrapper";
import Product from "models/Product.model";
import { currency } from "lib";
import type { PaginatedResult } from "lib/admin/pagination";
import type { ProductsFilterOptions, ProductsStats } from "lib/admin/products-list";
import { ADMIN_LIST_DEFAULT_LIMIT } from "lib/admin/pagination";

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

type AdminProduct = Product & {
  basePrice?: number | null;
  customPrice?: number | null;
  effectivePrice?: number;
  effectivePriceSource?: string | null;
  linkedSuppliers?: { code: string; name: string }[];
};

type MasterStatusValue = NonNullable<Product["masterStatus"]>["value"];
type QuickFilter = "all" | MasterStatusValue;

type TableRowProduct = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  effectivePrice: number;
  effectivePriceSource: string | null;
  basePrice: number | null;
  customPrice: number | null;
  price: number;
  image: string;
  published: boolean;
  category: string;
  masterStatus: Product["masterStatus"];
  masterStatusSort: string;
};

const EMPTY_STATS: ProductsStats = {
  all: 0,
  ready: 0,
  unlinked: 0,
  linked: 0,
  needs_attributes: 0
};

export default function ProductsPageView() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [parentCategoryFilter, setParentCategoryFilter] = useState("all");
  const [childCategoryFilter, setChildCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [publishedFilter, setPublishedFilter] = useState("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<AdminProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [stats, setStats] = useState<ProductsStats>(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<ProductsFilterOptions>({
    categoryTree: {},
    priceSources: [{ value: "manual", label: "manual" }]
  });

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

  const loadOffers = async (product: { id: string; name: string }) => {
    setOffersByProduct((prev) => ({
      ...prev,
      [product.id]: { loading: true, error: null, rows: prev[product.id]?.rows ?? [] }
    }));
    try {
      const response = await fetch(`/api/admin/products/${product.id}/offers`, {
        cache: "no-store"
      });
      const data = (await response.json()) as
        | { error?: string }
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      setStatsError(null);

      const statsRequest = (async () => {
        try {
          const response = await fetch("/api/admin/products/stats", { cache: "no-store" });
          const json = (await response.json()) as ProductsStats | { error?: string };
          const errorMessage = "error" in json ? json.error : undefined;
          if (!response.ok || errorMessage) {
            throw new Error(errorMessage ?? "Failed to load product stats.");
          }
          if (!cancelled) setStats(json as ProductsStats);
        } catch (err) {
          if (!cancelled) {
            setStatsError(err instanceof Error ? err.message : "Failed to load product stats.");
          }
        } finally {
          if (!cancelled) setStatsLoading(false);
        }
      })();

      const optionsRequest = (async () => {
        try {
          const response = await fetch("/api/admin/products/filter-options", { cache: "no-store" });
          if (!response.ok) throw new Error("Failed to load product filters.");
          const json = (await response.json()) as ProductsFilterOptions;
          if (!cancelled) setFilterOptions(json);
        } catch {
          // Product counters and the product list remain usable if filter metadata fails.
        }
      })();

      await Promise.allSettled([statsRequest, optionsRequest]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(ADMIN_LIST_DEFAULT_LIMIT),
        quickFilter,
        parentCategory: parentCategoryFilter,
        childCategory: childCategoryFilter,
        priceSource: supplierFilter,
        published: publishedFilter
      });
      if (debouncedQuery.trim()) params.set("q", debouncedQuery.trim());
      if (priceMin.trim()) params.set("priceMin", priceMin.trim());
      if (priceMax.trim()) params.set("priceMax", priceMax.trim());

      const response = await fetch(`/api/admin/products?${params.toString()}`, {
        cache: "no-store"
      });
      const data = (await response.json()) as PaginatedResult<AdminProduct> & { error?: string };
      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Failed to load products.");
      }
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setTotalPages(1);
      setListError(err instanceof Error ? err.message : "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    debouncedQuery,
    quickFilter,
    parentCategoryFilter,
    childCategoryFilter,
    supplierFilter,
    publishedFilter,
    priceMin,
    priceMax
  ]);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    setPage(1);
  }, [
    debouncedQuery,
    quickFilter,
    parentCategoryFilter,
    childCategoryFilter,
    supplierFilter,
    publishedFilter,
    priceMin,
    priceMax
  ]);

  const quickFilters: { value: QuickFilter; label: string; count: number; countHint?: string }[] = [
    { value: "all", label: "All", count: stats.all },
    { value: "ready", label: "Ready", count: stats.ready },
    { value: "unlinked", label: "Unlinked", count: stats.unlinked },
    { value: "linked", label: "Linked", count: stats.linked },
    {
      value: "needs_attributes",
      label: "Needs attributes",
      count: stats.needs_attributes,
      countHint: "products"
    }
  ];

  const parentCategoryOptions = useMemo(() => {
    return [
      { value: "all", label: "all" },
      ...Object.entries(filterOptions.categoryTree)
        .sort((a, b) => a[1].name.localeCompare(b[1].name))
        .map(([slug, value]) => ({ value: slug, label: value.name }))
    ];
  }, [filterOptions.categoryTree]);

  const childCategoryOptions = useMemo(() => {
    if (parentCategoryFilter === "all") return [{ value: "all", label: "all" }];
    const parent = filterOptions.categoryTree[parentCategoryFilter];
    if (!parent) return [{ value: "all", label: "all" }];
    return [
      { value: "all", label: "all" },
      ...[...parent.children]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ value: c.slug, label: c.name }))
    ];
  }, [parentCategoryFilter, filterOptions.categoryTree]);

  const supplierOptions = useMemo(() => {
    return [{ value: "all", label: "all" }, ...filterOptions.priceSources];
  }, [filterOptions.priceSources]);

  const reshapedProducts = useMemo((): TableRowProduct[] => {
    return items.map((item) => {
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
            : (item.categories[0] ?? "-"),
        masterStatus: item.masterStatus,
        masterStatusSort: item.masterStatus?.label ?? ""
      };
    });
  }, [items]);

  const { order, orderBy, handleRequestSort } = useMuiTable({ listData: reshapedProducts });
  const sortedProducts = useMemo(
    () => stableSort(reshapedProducts, getComparator(order, orderBy)),
    [reshapedProducts, order, orderBy]
  );

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
              <Typography variant="h4">
                {statsLoading ? <CircularProgress size={22} /> : statsError ? "—" : item.count}
              </Typography>
              {item.countHint ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: "block", mt: 0.25 }}
                >
                  {item.countHint} — each row counts once
                </Typography>
              ) : null}
            </Card>
          </Grid>
        ))}
      </Grid>
      {statsError ? (
        <Typography color="error" variant="body2" sx={{ mb: 2 }}>
          Product counters could not be loaded: {statsError}
        </Typography>
      ) : null}

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
            label="Price source"
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
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {loading ? "Učitavanje…" : `${total} rezultata`}
        </Typography>
        {listError ? (
          <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
            {listError}
          </Typography>
        ) : null}
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
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={tableHeading.length} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={28} />
                    </TableCell>
                  </TableRow>
                ) : sortedProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={tableHeading.length} align="center" sx={{ py: 4 }}>
                      Nema rezultata za odabrane filtere.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedProducts.map((product, index) => (
                    <Fragment key={index}>
                      <ProductRow
                        product={product}
                        onToggleExpand={(p) => void toggleExpand({ id: p.id, name: p.name })}
                      />
                      <TableRow>
                        <TableCell colSpan={tableHeading.length} sx={{ py: 0 }}>
                          <Collapse
                            in={expandedProductId === product.id}
                            timeout="auto"
                            unmountOnExit
                          >
                            <Box sx={{ p: 2 }}>
                              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                Linked supplier offers
                              </Typography>
                              {offersByProduct[product.id]?.loading ? (
                                <Typography>Loading offers...</Typography>
                              ) : offersByProduct[product.id]?.error ? (
                                <Typography color="error">
                                  {offersByProduct[product.id]?.error}
                                </Typography>
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
                                            : { opacity: 0.62, filter: "blur(0.35px)" }
                                        }
                                      >
                                        <TableCell>
                                          {row.supplierName}
                                          <Typography
                                            variant="caption"
                                            display="block"
                                            color="text.secondary"
                                          >
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
                                        <TableCell align="right">
                                          {huf(row.priceAmountHuf)}
                                        </TableCell>
                                        <TableCell align="right">
                                          {row.acquisitionKm != null
                                            ? currency(row.acquisitionKm)
                                            : "-"}
                                        </TableCell>
                                        <TableCell align="right">
                                          {row.sellingKm != null ? currency(row.sellingKm) : "-"}
                                        </TableCell>
                                        <TableCell align="right">
                                          {formatDate(row.updatedAt)}
                                        </TableCell>
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
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </OverlayScrollbar>

        <Stack alignItems="center" my={4}>
          <TablePagination
            page={page}
            onChange={(_, newPage) => setPage(newPage)}
            count={totalPages}
            disabled={loading}
          />
        </Stack>
      </Card>
    </PageWrapper>
  );
}
