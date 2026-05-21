"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Collapse from "@mui/material/Collapse";
import Card from "@mui/material/Card";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import IconButton from "@mui/material/IconButton";
import TableContainer from "@mui/material/TableContainer";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import KeyboardArrowDown from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import OverlayScrollbar from "components/overlay-scrollbar";
import { TableHeader, TablePagination } from "components/data-table";
import useMuiTable from "hooks/useMuiTable";
import { currency } from "lib";
import type { AdminProductSearchResult } from "app/api/admin/products/search/route";
import type { SupplierOfferRow } from "app/api/admin/supplier-products/route";
import PageWrapper from "../../page-wrapper";
import { StyledTableCell, StyledTableRow } from "../../styles";

const tableHeading = [
  { id: "supplier", label: "Supplier", align: "left" },
  { id: "supplierProductId", label: "Supplier Product ID", align: "left" },
  { id: "masterProductName", label: "Master Product", align: "left" },
  { id: "masterMatchStatus", label: "Match", align: "left" },
  { id: "enrichmentStatus", label: "Enrichment", align: "left" },
  { id: "priceSort", label: "Price (HUF)", align: "left" },
  { id: "acquisitionKm", label: "Nabavna (KM)", align: "left" },
  { id: "sellingKm", label: "Prodajna (KM)", align: "left" },
  { id: "mpn", label: "MPN", align: "left" },
  { id: "ean", label: "EAN", align: "left" },
  { id: "updatedAt", label: "Updated", align: "left" },
  { id: "actions", label: "Actions", align: "center" }
];

type Props = { offers: SupplierOfferRow[] };

type OfferTableRow = SupplierOfferRow & { priceSort: number; masterProductName: string };

function getRawOfferPreview(rawJson: unknown): { productName: string | null; imageUrl: string | null } {
  if (!rawJson || typeof rawJson !== "object" || Array.isArray(rawJson)) {
    return { productName: null, imageUrl: null };
  }
  const r = rawJson as Record<string, unknown>;
  const pn = typeof r.product_name === "string" ? r.product_name.trim() : "";
  const iu = typeof r.image_url === "string" ? r.image_url.trim() : "";
  const productName = pn.length > 0 ? pn : null;
  const imageUrl =
    iu.length > 0 && (iu.startsWith("https://") || iu.startsWith("http://")) ? iu : null;
  return { productName, imageUrl };
}
type QuickFilter = "all" | "linked" | "unlinked" | "pending_review" | "failed_enrichment" | "missing_identifiers";
type PriceRefreshState = { severity: "success" | "error"; message: string } | null;
type SupplierOfferActionResult = {
  success?: boolean;
  action?: "link" | "unlink";
  synced?: string[];
  conflicts?: string[];
  priceRefresh?: { updated?: number; batches?: number; error?: string };
  error?: string;
};
type AutoMatchRun = {
  id: string;
  source: string;
  status: "running" | "success" | "failed";
  started_at: string;
  finished_at: string | null;
  scanned: number;
  linked: number;
  skipped: number;
  errors_count: number;
};
type AutoMatchEvent = {
  id: number;
  run_id: string;
  level: "info" | "warn" | "error";
  message: string;
  supplier_product_id: string | null;
  matched_product_id: string | null;
  created_at: string;
};
type AutoMatchStatusResponse = {
  run: AutoMatchRun | null;
  events: AutoMatchEvent[];
  error?: string;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  // Keep SSR and client output identical to avoid hydration mismatch.
  return date.toISOString().replace("T", " ").slice(0, 16);
}

function huf(value: number) {
  if (!Number.isFinite(value)) return "0 HUF";
  return `${Math.round(Number(value))} HUF`;
}

function statusColor(value: string): "success" | "warning" | "error" | "info" | "default" {
  const normalized = value.toLowerCase();
  if (normalized === "linked" || normalized === "complete") return "success";
  if (normalized.includes("pending") || normalized === "processing") return "warning";
  if (normalized === "failed" || normalized === "unlinked") return "error";
  if (normalized === "unknown") return "default";
  return "info";
}

function StatusBadge({ value }: { value: string }) {
  return <Chip label={value} color={statusColor(value)} size="small" variant="outlined" />;
}

function matchAuditLabel(offer: SupplierOfferRow) {
  const audit = offer.matchAudit;
  if (!audit || audit.result !== "skipped") return null;
  if (offer.productId) return null;
  const reason = audit.reason?.replace(/_/g, " ") ?? "skipped";
  const method = audit.method.toUpperCase();
  const count = typeof audit.candidateCount === "number" ? ` (${audit.candidateCount} candidates)` : "";
  return `${method}: ${reason}${count}`;
}

function sameIdentifier(left: string | null | undefined, right: string | null | undefined) {
  const a = left?.trim().toLowerCase();
  const b = right?.trim().toLowerCase();
  if (!a || !b) return true;
  return a === b;
}

function getIdentifierConflicts(offer: SupplierOfferRow, product: AdminProductSearchResult | null) {
  if (!product) return [];
  const conflicts: string[] = [];
  if (!sameIdentifier(offer.mpn, product.mpn)) conflicts.push("MPN");
  if (!sameIdentifier(offer.ean, product.ean)) conflicts.push("EAN");
  return conflicts;
}

function priceRefreshMessage(prefix: string, result: SupplierOfferActionResult) {
  const refresh = result.priceRefresh;
  if (refresh?.error) return `${prefix}, but price refresh failed: ${refresh.error}`;
  return `${prefix}. Prices refreshed: ${refresh?.updated ?? 0} products updated in ${refresh?.batches ?? 0} batch(es).`;
}

function linkedMethodLabel(offer: SupplierOfferRow) {
  const method = offer.matchAudit?.method;
  if (method === "ean" || method === "mpn") return method.toUpperCase();
  return "manual";
}

export default function SupplierOffersPageView({ offers }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [supplierCode, setSupplierCode] = useState("all");
  const [matchStatus, setMatchStatus] = useState("all");
  const [enrichmentStatus, setEnrichmentStatus] = useState("all");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [rawOffer, setRawOffer] = useState<SupplierOfferRow | null>(null);
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [priceRefresh, setPriceRefresh] = useState<PriceRefreshState>(null);
  const [linkOffer, setLinkOffer] = useState<SupplierOfferRow | null>(null);
  const [unlinkOffer, setUnlinkOffer] = useState<SupplierOfferRow | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<AdminProductSearchResult[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<AdminProductSearchResult | null>(null);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [autoMatchRunId, setAutoMatchRunId] = useState<string | null>(null);
  const [autoMatchRun, setAutoMatchRun] = useState<AutoMatchRun | null>(null);
  const [autoMatchEvents, setAutoMatchEvents] = useState<AutoMatchEvent[]>([]);
  const [autoMatchLoading, setAutoMatchLoading] = useState(false);
  const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null);

  const counters = useMemo(
    () => ({
      all: offers.length,
      linked: offers.filter((offer) => Boolean(offer.productId)).length,
      unlinked: offers.filter((offer) => !offer.productId).length,
      pending_review: offers.filter((offer) => offer.masterMatchStatus === "pending_review").length,
      failed_enrichment: offers.filter((offer) => offer.enrichmentStatus === "failed").length,
      missing_identifiers: offers.filter((offer) => !offer.mpn || !offer.ean).length
    }),
    [offers]
  );

  const quickFilters: { value: QuickFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: counters.all },
    { value: "linked", label: "Linked", count: counters.linked },
    { value: "unlinked", label: "Unlinked", count: counters.unlinked },
    { value: "pending_review", label: "Pending Review", count: counters.pending_review },
    { value: "failed_enrichment", label: "Failed Enrichment", count: counters.failed_enrichment },
    { value: "missing_identifiers", label: "Missing MPN/EAN", count: counters.missing_identifiers }
  ];

  const supplierOptions = useMemo(
    () => ["all", ...Array.from(new Set(offers.map((offer) => offer.supplierCode).filter(Boolean))).sort()],
    [offers]
  );
  const matchOptions = useMemo(
    () => ["all", ...Array.from(new Set(offers.map((offer) => offer.masterMatchStatus))).sort()],
    [offers]
  );
  const enrichmentOptions = useMemo(
    () => ["all", ...Array.from(new Set(offers.map((offer) => offer.enrichmentStatus))).sort()],
    [offers]
  );

  const filteredOffers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return offers.filter((offer) => {
      const quickOk =
        quickFilter === "all" ||
        (quickFilter === "linked" && Boolean(offer.productId)) ||
        (quickFilter === "unlinked" && !offer.productId) ||
        (quickFilter === "pending_review" && offer.masterMatchStatus === "pending_review") ||
        (quickFilter === "failed_enrichment" && offer.enrichmentStatus === "failed") ||
        (quickFilter === "missing_identifiers" && (!offer.mpn || !offer.ean));
      const supplierOk = supplierCode === "all" || offer.supplierCode === supplierCode;
      const matchOk = matchStatus === "all" || offer.masterMatchStatus === matchStatus;
      const enrichmentOk = enrichmentStatus === "all" || offer.enrichmentStatus === enrichmentStatus;
      if (!quickOk || !supplierOk || !matchOk || !enrichmentOk) return false;
      if (!q) return true;

      const haystack = [
        offer.supplier,
        offer.supplierCode,
        offer.supplierProductId,
        offer.productId ?? "",
        offer.masterProduct?.name ?? "",
        offer.masterProduct?.slug ?? "",
        offer.mpn ?? "",
        offer.ean ?? ""
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [offers, query, quickFilter, supplierCode, matchStatus, enrichmentStatus]);

  const rows: OfferTableRow[] = useMemo(
    () =>
      filteredOffers.map((offer) => ({
        ...offer,
        priceSort: offer.priceAmount ?? -1,
        masterProductName: offer.masterProduct?.name ?? ""
      })),
    [filteredOffers]
  );

  const { order, orderBy, rowsPerPage, filteredList, handleChangePage, handleRequestSort } = useMuiTable({
    listData: rows,
    defaultSort: "updatedAt",
    defaultOrder: "desc"
  });

  async function handleRefreshPrices() {
    setRefreshingPrices(true);
    setPriceRefresh(null);

    try {
      const response = await fetch("/api/admin/aggregate-prices", { method: "POST" });
      const result = (await response.json()) as { updated?: number; batches?: number; error?: string };

      if (!response.ok || result.error) {
        setPriceRefresh({
          severity: "error",
          message: result.error ?? "Price refresh failed."
        });
        return;
      }

      setPriceRefresh({
        severity: "success",
        message: `Prices refreshed: ${result.updated ?? 0} products updated in ${result.batches ?? 0} batch(es).`
      });
    } catch (err) {
      setPriceRefresh({
        severity: "error",
        message: err instanceof Error ? err.message : "Price refresh failed."
      });
    } finally {
      setRefreshingPrices(false);
    }
  }

  function openLinkDialog(offer: SupplierOfferRow) {
    setLinkOffer(offer);
    const rawProductName = getRawOfferPreview(offer.rawJson).productName;
    setProductSearch(offer.masterProduct?.name ?? rawProductName ?? offer.mpn ?? offer.ean ?? "");
    setProductResults([]);
    setSelectedProduct(null);
    setPriceRefresh(null);
  }

  async function handleProductSearch() {
    const q = productSearch.trim();
    if (q.length < 2) return;

    setSearchingProducts(true);
    try {
      const response = await fetch(`/api/admin/products/search?q=${encodeURIComponent(q)}`);
      const results = (await response.json()) as AdminProductSearchResult[];
      setProductResults(results);
    } catch {
      setProductResults([]);
    } finally {
      setSearchingProducts(false);
    }
  }

  async function handleConfirmLink() {
    if (!linkOffer || !selectedProduct) return;

    setSubmittingAction(true);
    try {
      const response = await fetch(`/api/admin/supplier-products/${linkOffer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "link", productId: selectedProduct.id })
      });
      const result = (await response.json()) as SupplierOfferActionResult;

      if (!response.ok || result.error) {
        setPriceRefresh({ severity: "error", message: result.error ?? "Link failed." });
        return;
      }

      const synced = result.synced?.length ? ` Synced ${result.synced.join(", ").toUpperCase()}.` : "";
      const conflicts = result.conflicts?.length
        ? ` Kept existing supplier ${result.conflicts.join(", ").toUpperCase()} because it differs from master.`
        : "";
      setPriceRefresh({
        severity: result.priceRefresh?.error ? "error" : "success",
        message: `${priceRefreshMessage("Supplier offer linked", result)}${synced}${conflicts}`
      });
      setLinkOffer(null);
      setSelectedProduct(null);
      setProductResults([]);
      router.refresh();
    } catch (err) {
      setPriceRefresh({
        severity: "error",
        message: err instanceof Error ? err.message : "Link failed."
      });
    } finally {
      setSubmittingAction(false);
    }
  }

  async function handleConfirmUnlink() {
    if (!unlinkOffer) return;

    setSubmittingAction(true);
    try {
      const response = await fetch(`/api/admin/supplier-products/${unlinkOffer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlink" })
      });
      const result = (await response.json()) as SupplierOfferActionResult;

      if (!response.ok || result.error) {
        setPriceRefresh({ severity: "error", message: result.error ?? "Unlink failed." });
        return;
      }

      setPriceRefresh({
        severity: result.priceRefresh?.error ? "error" : "success",
        message: priceRefreshMessage("Supplier offer unlinked", result)
      });
      setUnlinkOffer(null);
      router.refresh();
    } catch (err) {
      setPriceRefresh({
        severity: "error",
        message: err instanceof Error ? err.message : "Unlink failed."
      });
    } finally {
      setSubmittingAction(false);
    }
  }

  async function loadAutoMatchStatus(runId?: string | null) {
    const query = runId ? `?runId=${encodeURIComponent(runId)}` : "";
    const response = await fetch(`/api/admin/supplier-products/auto-match${query}`, { method: "GET" });
    const data = (await response.json()) as AutoMatchStatusResponse;
    if (!response.ok || data.error) throw new Error(data.error ?? "Failed to load auto-match status.");
    setAutoMatchRun(data.run);
    setAutoMatchEvents(data.events ?? []);
    if (data.run?.id) setAutoMatchRunId(data.run.id);
    return data;
  }

  async function handleAutoMatchStart() {
    setAutoMatchLoading(true);
    setPriceRefresh(null);
    try {
      const response = await fetch("/api/admin/supplier-products/auto-match", { method: "POST" });
      const result = (await response.json()) as {
        success?: boolean;
        runId?: string;
        scanned?: number;
        linked?: number;
        skipped?: number;
        errorsCount?: number;
        error?: string;
      };
      if (!response.ok || result.error) {
        setPriceRefresh({ severity: "error", message: result.error ?? "Auto-match failed." });
        return;
      }
      if (result.runId) setAutoMatchRunId(result.runId);
      await loadAutoMatchStatus(result.runId ?? null);
      setPriceRefresh({
        severity: result.errorsCount ? "error" : "success",
        message: `Auto-match finished. scanned=${result.scanned ?? 0}, linked=${result.linked ?? 0}, skipped=${result.skipped ?? 0}, errors=${result.errorsCount ?? 0}.`
      });
      router.refresh();
    } catch (err) {
      setPriceRefresh({ severity: "error", message: err instanceof Error ? err.message : "Auto-match failed." });
    } finally {
      setAutoMatchLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const data = await loadAutoMatchStatus(autoMatchRunId);
        if (cancelled) return;
        if (data.run?.status === "running") {
          timer = setTimeout(poll, 1500);
        }
      } catch {
        if (!cancelled) timer = setTimeout(poll, 2500);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [autoMatchRunId]);

  return (
    <PageWrapper title="Supplier Offers">
      <Stack direction={{ md: "row", xs: "column" }} justifyContent="space-between" gap={2} mb={2}>
        <Typography variant="body2" color="text.secondary">
          Operational queue for supplier imports, matching, enrichment, and price refresh.
        </Typography>

        <Stack direction="row" spacing={1}>
          <Button color="secondary" variant="outlined" disabled={autoMatchLoading} onClick={handleAutoMatchStart}>
            {autoMatchLoading ? "Running..." : "Auto-Match Pending"}
          </Button>
          <Button color="info" variant="contained" disabled={refreshingPrices} onClick={handleRefreshPrices}>
            {refreshingPrices ? "Refreshing..." : "Recalculate Prices"}
          </Button>
        </Stack>
      </Stack>

      {priceRefresh ? (
        <Alert severity={priceRefresh.severity} sx={{ mb: 2 }} onClose={() => setPriceRefresh(null)}>
          {priceRefresh.message}
        </Alert>
      ) : null}

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ md: "row", xs: "column" }} justifyContent="space-between" spacing={1} mb={1}>
          <Typography variant="subtitle2">Auto-Match Console</Typography>
          <Typography variant="caption" color="text.secondary">
            {autoMatchRun
              ? `Run ${autoMatchRun.id.slice(0, 8)} | status=${autoMatchRun.status} | scanned=${autoMatchRun.scanned} linked=${autoMatchRun.linked} skipped=${autoMatchRun.skipped} errors=${autoMatchRun.errors_count}`
              : "No runs yet."}
          </Typography>
        </Stack>
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1.5,
            maxHeight: 220,
            overflow: "auto",
            fontSize: 12,
            borderRadius: 1,
            bgcolor: "grey.100"
          }}
        >
          {(() => {
            const consoleEvents = autoMatchEvents.filter(
              (event) => event.message.includes("LINKED") || event.level === "error"
            );
            return consoleEvents.length
              ? consoleEvents
                  .map((event) => {
                    const stamp = formatDate(event.created_at);
                    const supplierPart = event.supplier_product_id ? ` sp=${event.supplier_product_id}` : "";
                    const productPart = event.matched_product_id ? ` p=${event.matched_product_id}` : "";
                    return `[${stamp}] ${event.level.toUpperCase()} ${event.message}${supplierPart}${productPart}`;
                  })
                  .join("\n")
              : "Auto-match log will appear here when offers are linked.";
          })()}
        </Box>
      </Card>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {quickFilters.map((item) => (
          <Grid key={item.value} size={{ lg: 2, md: 4, sm: 6, xs: 12 }}>
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

      <Card sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid size={{ md: 4, xs: 12 }}>
            <TextField
              fullWidth
              size="small"
              label="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="supplier_product_id, MPN, EAN..."
            />
          </Grid>

          <Grid size={{ md: 2.6, xs: 12 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Supplier"
              value={supplierCode}
              onChange={(e) => setSupplierCode(e.target.value)}
            >
              {supplierOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ md: 2.6, xs: 12 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Match Status"
              value={matchStatus}
              onChange={(e) => setMatchStatus(e.target.value)}
            >
              {matchOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ md: 2.8, xs: 12 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Enrichment"
              value={enrichmentStatus}
              onChange={(e) => setEnrichmentStatus(e.target.value)}
            >
              {enrichmentOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {filteredOffers.length} rezultata
        </Typography>
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
                {filteredList.map((offer) => (
                  <Fragment key={offer.id}>
                    <StyledTableRow>
                    <StyledTableCell align="left">
                      <Typography variant="body2" fontWeight={600}>
                        {offer.supplier}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {offer.supplierCode}
                      </Typography>
                    </StyledTableCell>

                    <StyledTableCell
                      align="left"
                      sx={{
                        maxWidth: 180,
                        width: 180,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                      title={offer.supplierProductId}
                    >
                      {offer.supplierProductId}
                    </StyledTableCell>
                    <StyledTableCell align="left">
                      {offer.masterProduct ? (
                        <Box display="flex" alignItems="center" gap={1.2}>
                          <Avatar variant="rounded">
                            <Image
                              fill
                              src={offer.masterProduct.image ?? "/assets/images/placeholder.png"}
                              alt={offer.masterProduct.name}
                              sizes="40px"
                            />
                          </Avatar>

                          <Box>
                            <Link href={`/admin/products/${offer.masterProduct.slug}`}>
                              <Typography variant="body2" sx={{ color: "info.main" }}>
                                {offer.masterProduct.name}
                              </Typography>
                            </Link>
                            <Typography variant="caption" color="text.secondary">
                              {offer.masterProduct.slug}
                            </Typography>
                          </Box>
                        </Box>
                      ) : (
                        <StatusBadge value="unlinked" />
                      )}
                    </StyledTableCell>
                    <StyledTableCell align="left">
                      {offer.productId ? (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Button
                            size="small"
                            color="success"
                            variant={expandedOfferId === offer.id ? "contained" : "outlined"}
                            onClick={() => setExpandedOfferId((current) => (current === offer.id ? null : offer.id))}
                          >
                            linked
                          </Button>
                          <IconButton
                            size="small"
                            onClick={() => setExpandedOfferId((current) => (current === offer.id ? null : offer.id))}
                          >
                            {expandedOfferId === offer.id ? <KeyboardArrowUp fontSize="small" /> : <KeyboardArrowDown fontSize="small" />}
                          </IconButton>
                        </Stack>
                      ) : (
                        <StatusBadge value={offer.masterMatchStatus} />
                      )}
                      {matchAuditLabel(offer) ? (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.4 }}>
                          {matchAuditLabel(offer)}
                        </Typography>
                      ) : null}
                    </StyledTableCell>
                    <StyledTableCell align="left">
                      <StatusBadge value={offer.enrichmentStatus} />
                    </StyledTableCell>
                    <StyledTableCell align="left">
                      {offer.priceAmount != null ? huf(offer.priceAmount) : "-"}
                    </StyledTableCell>
                    <StyledTableCell align="left">
                      {offer.acquisitionKm != null ? currency(offer.acquisitionKm) : "-"}
                    </StyledTableCell>
                    <StyledTableCell align="left">
                      {offer.sellingKm != null ? currency(offer.sellingKm) : "-"}
                    </StyledTableCell>
                    <StyledTableCell align="left">{offer.mpn ?? "-"}</StyledTableCell>
                    <StyledTableCell align="left">{offer.ean ?? "-"}</StyledTableCell>
                    <StyledTableCell align="left">{formatDate(offer.updatedAt)}</StyledTableCell>
                    <StyledTableCell align="center">
                      <Stack direction="row" justifyContent="center" spacing={1}>
                        <Button size="small" variant="outlined" onClick={() => setRawOffer(offer)}>
                          View Raw
                        </Button>

                        {offer.masterProduct ? (
                          <Button
                            size="small"
                            color="info"
                            variant="text"
                            LinkComponent={Link}
                            href={`/admin/products/${offer.masterProduct.slug}`}
                          >
                            View Master
                          </Button>
                        ) : null}

                        <Button size="small" color="info" variant="outlined" onClick={() => openLinkDialog(offer)}>
                          {offer.masterProduct ? "Change" : "Link"}
                        </Button>

                        {offer.masterProduct ? (
                          <Button size="small" color="error" variant="text" onClick={() => setUnlinkOffer(offer)}>
                            Unlink
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            color="success"
                            variant="text"
                            LinkComponent={Link}
                            href={`/admin/products/create-from-offer/${offer.id}`}
                          >
                            Create Master
                          </Button>
                        )}
                      </Stack>
                    </StyledTableCell>
                    </StyledTableRow>
                    <StyledTableRow>
                      <StyledTableCell sx={{ py: 0 }} colSpan={tableHeading.length}>
                        <Collapse in={expandedOfferId === offer.id && Boolean(offer.productId)} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                              Linked master details
                            </Typography>
                            <Stack spacing={0.5}>
                              <Typography variant="body2">
                                Master: {offer.masterProduct?.name ?? "-"} ({offer.masterProduct?.slug ?? "-"})
                              </Typography>
                              <Typography variant="body2">Product ID: {offer.productId ?? "-"}</Typography>
                              <Typography variant="body2">
                                Match method: {linkedMethodLabel(offer)}
                              </Typography>
                              <Typography variant="body2">Supplier MPN/EAN: {offer.mpn ?? "-"} / {offer.ean ?? "-"}</Typography>
                            </Stack>
                            {offer.masterProduct ? (
                              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                                <Button
                                  size="small"
                                  color="info"
                                  variant="text"
                                  LinkComponent={Link}
                                  href={`/admin/products/${offer.masterProduct.slug}`}
                                >
                                  View Master
                                </Button>
                                <Button size="small" color="info" variant="outlined" onClick={() => openLinkDialog(offer)}>
                                  Change Link
                                </Button>
                                <Button size="small" color="error" variant="text" onClick={() => setUnlinkOffer(offer)}>
                                  Unlink
                                </Button>
                              </Stack>
                            ) : null}
                          </Box>
                        </Collapse>
                      </StyledTableCell>
                    </StyledTableRow>
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </OverlayScrollbar>

        <Stack alignItems="center" my={4}>
          <TablePagination
            onChange={handleChangePage}
            count={Math.max(1, Math.ceil(filteredOffers.length / rowsPerPage))}
          />
        </Stack>
      </Card>

      <Dialog open={Boolean(linkOffer)} onClose={() => setLinkOffer(null)} fullWidth maxWidth="md">
        <DialogTitle>Link Supplier Offer to Master Product</DialogTitle>
        <DialogContent dividers>
          {linkOffer ? (
            <Stack spacing={2}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Supplier offer
                </Typography>
                <Typography variant="h6">
                  {linkOffer.supplier} / {linkOffer.supplierProductId}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  MPN: {linkOffer.mpn ?? "-"} | EAN: {linkOffer.ean ?? "-"}
                </Typography>
              </Box>

              {(() => {
                const preview = getRawOfferPreview(linkOffer.rawJson);
                if (!preview.productName && !preview.imageUrl) return null;
                return (
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      {preview.imageUrl ? (
                        <Box
                          component="img"
                          src={preview.imageUrl}
                          alt=""
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                          sx={{
                            width: 72,
                            height: 72,
                            objectFit: "contain",
                            borderRadius: 1,
                            bgcolor: "action.hover",
                            flexShrink: 0
                          }}
                        />
                      ) : null}
                      <Box flex={1} minWidth={0}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Offer preview (raw)
                        </Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ wordBreak: "break-word" }}>
                          {preview.productName ?? "—"}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                );
              })()}

              <Stack direction={{ md: "row", xs: "column" }} spacing={1.5}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search master products"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleProductSearch();
                  }}
                  placeholder="name, brand, MPN, EAN..."
                />
                <Button
                  color="info"
                  variant="contained"
                  disabled={searchingProducts || productSearch.trim().length < 2}
                  onClick={handleProductSearch}
                >
                  {searchingProducts ? "Searching..." : "Search"}
                </Button>
              </Stack>

              <Stack spacing={1}>
                {productResults.map((product) => {
                  const active = selectedProduct?.id === product.id;
                  return (
                    <Card
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      sx={{
                        p: 1.5,
                        cursor: "pointer",
                        border: "1px solid",
                        borderColor: active ? "info.main" : "divider"
                      }}
                    >
                      <Box display="flex" gap={1.5} alignItems="center">
                        <Avatar variant="rounded">
                          <Image
                            fill
                            src={product.image ?? "/assets/images/placeholder.png"}
                            alt={product.name}
                            sizes="40px"
                          />
                        </Avatar>

                        <Box flex={1}>
                          <Typography variant="body2" fontWeight={600}>
                            {product.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {product.brand ?? "-"} | MPN: {product.mpn ?? "-"} | EAN: {product.ean ?? "-"}
                          </Typography>
                        </Box>
                      </Box>
                    </Card>
                  );
                })}
              </Stack>

              {selectedProduct ? (
                <Alert severity={getIdentifierConflicts(linkOffer, selectedProduct).length ? "warning" : "info"}>
                  Confirm linking this supplier offer to <strong>{selectedProduct.name}</strong>.
                  {getIdentifierConflicts(linkOffer, selectedProduct).length ? (
                    <>
                      {" "}
                      Warning: supplier {getIdentifierConflicts(linkOffer, selectedProduct).join(" and ")} differs
                      from master. Existing supplier value will be kept.
                    </>
                  ) : (
                    " Missing supplier MPN/EAN will be copied from the master product when available."
                  )}
                </Alert>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkOffer(null)} disabled={submittingAction}>
            Cancel
          </Button>
          <Button
            color="info"
            variant="contained"
            disabled={!selectedProduct || submittingAction}
            onClick={handleConfirmLink}
          >
            {submittingAction ? "Linking..." : "Confirm Link"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(unlinkOffer)} onClose={() => setUnlinkOffer(null)} fullWidth maxWidth="sm">
        <DialogTitle>Unlink Supplier Offer</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2">
            Are you sure you want to unlink this supplier offer from its master product?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Status will become <strong>pending_review</strong>.
          </Typography>
          {unlinkOffer ? (
            <Typography variant="body2" sx={{ mt: 2 }}>
              {unlinkOffer.supplier} / {unlinkOffer.supplierProductId}
            </Typography>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnlinkOffer(null)} disabled={submittingAction}>
            Cancel
          </Button>
          <Button color="error" variant="contained" disabled={submittingAction} onClick={handleConfirmUnlink}>
            {submittingAction ? "Unlinking..." : "Confirm Unlink"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(rawOffer)} onClose={() => setRawOffer(null)} fullWidth maxWidth="md">
        <DialogTitle>Raw Supplier Data</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {rawOffer?.supplier} / {rawOffer?.supplierProductId}
          </Typography>

          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              maxHeight: 520,
              overflow: "auto",
              fontSize: 12,
              borderRadius: 1,
              bgcolor: "grey.100"
            }}
          >
            {JSON.stringify(rawOffer?.rawJson ?? {}, null, 2)}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRawOffer(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </PageWrapper>
  );
}
