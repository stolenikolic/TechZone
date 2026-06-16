"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Edit from "@mui/icons-material/Edit";
import Delete from "@mui/icons-material/Delete";
import { IPON_SUPPLIER_ID } from "lib/suppliers/ipon/constants";
import {
  FIRSTSHOP_SUPPLIER_ID,
  KONZOLVILAG_SUPPLIER_ID,
  OAZIS_SUPPLIER_ID,
  PCLAND_SUPPLIER_ID,
  PCX_SUPPLIER_ID
} from "lib/suppliers/registry";
import { StyledIconButton } from "../styles";

type Supplier = {
  id: string;
  name: string;
  code: string;
  kind: string | null;
  baseUrl: string | null;
  defaultCurrency: string | null;
  createsMasterProducts: boolean;
  isActive: boolean;
  enrichmentPriority: number;
  deliveryPolicy: { type: "weekly"; weekday: number } | null;
  inboundLeadDaysDefault: number;
};

type CategoryOption = { id: string; name: string; slug: string; parent_id: string | null };
type AttributeOption = { id: string; name: string; slug: string };

type SupplierCategoryRow = {
  id: string;
  internalCategoryId: string;
  supplierCategoryKey: string | null;
  listingUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  category: CategoryOption | null;
};

type MappingRow = {
  id: string;
  internalCategoryId: string | null;
  attributeId: string;
  sourceFieldName: string;
  matchMode: "exact" | "contains" | "regex";
  priority: number;
  isActive: boolean;
  attribute: AttributeOption | null;
  category: CategoryOption | null;
};

type ConfigRow = {
  id: string;
  key: string;
  value: unknown;
  isActive: boolean;
};

function jsonValueString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function tryParseJsonValue(s: string): unknown {
  const trimmed = s.trim();
  if (trimmed === "") return "";
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export default function AdminSupplierDetailView({ supplierId }: { supplierId: string }) {
  const [tab, setTab] = useState<"categories" | "mappings" | "config" | "settings">("categories");

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [attributes, setAttributes] = useState<AttributeOption[]>([]);

  const [supplierCategories, setSupplierCategories] = useState<SupplierCategoryRow[]>([]);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [configRows, setConfigRows] = useState<ConfigRow[]>([]);

  const [busy, setBusy] = useState(false);
  const [categoryImportRowId, setCategoryImportRowId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const isIponSupplier = supplierId === IPON_SUPPLIER_ID;
  const isPcxSupplier = supplierId === PCX_SUPPLIER_ID;
  const isFirstshopSupplier = supplierId === FIRSTSHOP_SUPPLIER_ID;
  const isPclandSupplier = supplierId === PCLAND_SUPPLIER_ID;
  const isOazisSupplier = supplierId === OAZIS_SUPPLIER_ID;
  const isKonzolvilagSupplier = supplierId === KONZOLVILAG_SUPPLIER_ID;
  const supportsCategoryImport =
    isIponSupplier ||
    isPcxSupplier ||
    isFirstshopSupplier ||
    isPclandSupplier ||
    isOazisSupplier ||
    isKonzolvilagSupplier;

  const [openCatModal, setOpenCatModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [openMappingModal, setOpenMappingModal] = useState(false);
  const [openConfigModal, setOpenConfigModal] = useState(false);

  const [catForm, setCatForm] = useState({
    parentCategoryId: "",
    internalCategoryId: "",
    supplierCategoryKey: "",
    listingUrl: "",
    sortOrder: 0,
    isActive: true
  });

  const [mappingForm, setMappingForm] = useState({
    attributeId: "",
    sourceFieldName: "",
    matchMode: "exact" as "exact" | "contains" | "regex",
    priority: 100,
    internalCategoryId: "" as string,
    isActive: true
  });

  const [configForm, setConfigForm] = useState({ key: "", valueString: "", isActive: true });

  const fetchJson = useCallback(async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok || (typeof json.error === "string" && json.error.length > 0)) {
      throw new Error(typeof json.error === "string" ? json.error : `HTTP ${res.status}`);
    }
    return json;
  }, []);

  const loadAll = useCallback(async () => {
    setSupplierLoading(true);
    setSupplierError(null);
    try {
      const [suppliersRes, categoriesRes, attributesRes, scRes, mappingsRes, configRes] = await Promise.all([
        fetchJson(`/api/admin/suppliers`),
        fetchJson(`/api/admin/categories`),
        fetchJson(`/api/admin/attributes`),
        fetchJson(`/api/admin/suppliers/${supplierId}/categories`),
        fetchJson(`/api/admin/suppliers/${supplierId}/mappings`),
        fetchJson(`/api/admin/suppliers/${supplierId}/config`)
      ]);
      const suppliers = (suppliersRes.items ?? []) as Supplier[];
      const hit = suppliers.find((s) => s.id === supplierId) ?? null;
      setSupplier(hit);

      const categoriesItems = (categoriesRes.items ?? categoriesRes) as Array<
        CategoryOption | { id: string; name: string; slug: string; parent_id?: string | null }
      >;
      setCategories(
        Array.isArray(categoriesItems)
          ? categoriesItems.map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              parent_id: "parent_id" in c ? (c.parent_id ?? null) : null
            }))
          : []
      );
      setAttributes((attributesRes.items ?? []) as AttributeOption[]);

      setSupplierCategories((scRes.items ?? []) as SupplierCategoryRow[]);
      setMappings((mappingsRes.items ?? []) as MappingRow[]);
      setConfigRows((configRes.items ?? []) as ConfigRow[]);
    } catch (e) {
      setSupplierError(e instanceof Error ? e.message : String(e));
    } finally {
      setSupplierLoading(false);
    }
  }, [fetchJson, supplierId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const categoryNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const rootCategories = useMemo(
    () =>
      categories
        .filter((c) => c.parent_id == null)
        .sort((a, b) => a.name.localeCompare(b.name, "bs")),
    [categories]
  );

  const childCategoriesForParent = useMemo(
    () =>
      categories
        .filter((c) => c.parent_id === catForm.parentCategoryId)
        .sort((a, b) => a.name.localeCompare(b.name, "bs")),
    [categories, catForm.parentCategoryId]
  );

  const handleSaveSettings = async () => {
    if (!supplier) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/suppliers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: supplier.id,
          kind: supplier.kind,
          baseUrl: supplier.baseUrl,
          defaultCurrency: supplier.defaultCurrency,
          createsMasterProducts: supplier.createsMasterProducts,
          isActive: supplier.isActive,
          enrichmentPriority: supplier.enrichmentPriority,
          deliveryPolicy: { type: "weekly" as const, weekday: 1 },
          inboundLeadDaysDefault: supplier.inboundLeadDaysDefault
        })
      });
      const json = (await res.json()) as { item?: Supplier; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "Save failed");
      if (json.item) setSupplier(json.item);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const resetCatForm = () => {
    setEditingCategoryId(null);
    setCatForm({
      parentCategoryId: "",
      internalCategoryId: "",
      supplierCategoryKey: "",
      listingUrl: "",
      sortOrder: 0,
      isActive: true
    });
  };

  const openAddCategoryModal = () => {
    resetCatForm();
    setOpenCatModal(true);
  };

  const openEditCategoryModal = (row: SupplierCategoryRow) => {
    const selected = categories.find((c) => c.id === row.internalCategoryId);
    setEditingCategoryId(row.id);
    setCatForm({
      parentCategoryId: selected?.parent_id ?? "",
      internalCategoryId: row.internalCategoryId,
      supplierCategoryKey: row.supplierCategoryKey ?? "",
      listingUrl: row.listingUrl ?? "",
      sortOrder: row.sortOrder,
      isActive: row.isActive
    });
    setOpenCatModal(true);
  };

  const closeCatModal = () => {
    setOpenCatModal(false);
    resetCatForm();
  };

  const handleSaveCategory = async () => {
    if (!editingCategoryId && !catForm.internalCategoryId) return;
    setBusy(true);
    setActionError(null);
    try {
      const payload = {
        supplierCategoryKey: catForm.supplierCategoryKey || null,
        listingUrl: catForm.listingUrl || null,
        sortOrder: catForm.sortOrder,
        isActive: catForm.isActive
      };
      const res = await fetch(`/api/admin/suppliers/${supplierId}/categories`, {
        method: editingCategoryId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingCategoryId
            ? { id: editingCategoryId, ...payload }
            : { internalCategoryId: catForm.internalCategoryId, ...payload }
        )
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "Save failed");
      closeCatModal();
      setActionNotice(editingCategoryId ? "Kategorija ažurirana." : "Kategorija dodana.");
      await loadAll();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleImportCategory = async (row: SupplierCategoryRow) => {
    if (!row.listingUrl?.trim()) {
      setActionError("Postavi Listing URL za ovaj red prije importa.");
      return;
    }
    setCategoryImportRowId(row.id);
    setActionError(null);
    setActionNotice(null);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}/categories/${row.id}/import`, {
        method: "POST"
      });
      const json = (await res.json()) as {
        error?: string;
        result?: {
          imported?: number;
          succeeded?: number;
          updated?: number;
          activated?: number;
          deactivated?: number;
          upserted?: number;
          skippedNoPrice?: number;
          skippedNoSupplierProductId?: number;
          skippedDuplicateCikkszam?: number;
          skippedDuplicateId?: number;
          staleDeactivated?: number;
          summary?: { category_name?: string };
        };
      };
      if (!res.ok || json.error) throw new Error(json.error ?? "Import nije uspio.");
      const r = json.result;
      const label = r?.summary?.category_name ?? row.category?.name ?? "kategorija";
      if (isFirstshopSupplier) {
        setActionNotice(
          `FirstShop import (${label}): uvezeno ${r?.upserted ?? 0}, preskočeno bez cijene ${r?.skippedNoPrice ?? 0}, bez ID ${r?.skippedNoSupplierProductId ?? 0}, duplikat ${r?.skippedDuplicateId ?? 0}, deaktivirano ${r?.staleDeactivated ?? 0}.`
        );
      } else if (isPcxSupplier) {
        setActionNotice(
          `PCX import (${label}): uvezeno ${r?.upserted ?? 0}, preskočeno bez cijene ${r?.skippedNoPrice ?? 0}, bez ID ${r?.skippedNoSupplierProductId ?? 0}, duplikat ${r?.skippedDuplicateCikkszam ?? 0}, deaktivirano ${r?.staleDeactivated ?? 0}.`
        );
      } else {
        setActionNotice(
          `iPon import (${label}): uvezeno ${r?.imported ?? 0}, obrađeno ${r?.succeeded ?? 0}, izmijenjeno ${r?.updated ?? 0}, aktivirano ${r?.activated ?? 0}, deaktivirano ${r?.deactivated ?? 0}.`
        );
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setCategoryImportRowId(null);
    }
  };

  const handleDeleteCategory = async (rowId: string) => {
    if (!confirm("Obrisati ovaj red?")) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}/categories?rowId=${rowId}`, {
        method: "DELETE"
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "Delete failed");
      await loadAll();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAddMapping = async () => {
    if (!mappingForm.attributeId || !mappingForm.sourceFieldName.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attributeId: mappingForm.attributeId,
          sourceFieldName: mappingForm.sourceFieldName.trim(),
          matchMode: mappingForm.matchMode,
          priority: mappingForm.priority,
          internalCategoryId: mappingForm.internalCategoryId || null,
          isActive: mappingForm.isActive
        })
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "Save failed");
      setOpenMappingModal(false);
      setMappingForm({
        attributeId: "",
        sourceFieldName: "",
        matchMode: "exact",
        priority: 100,
        internalCategoryId: "",
        isActive: true
      });
      await loadAll();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteMapping = async (rowId: string) => {
    if (!confirm("Obrisati ovaj red?")) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}/mappings?rowId=${rowId}`, {
        method: "DELETE"
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "Delete failed");
      await loadAll();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAddConfig = async () => {
    if (!configForm.key.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: configForm.key.trim(),
          value: tryParseJsonValue(configForm.valueString),
          isActive: configForm.isActive
        })
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "Save failed");
      setOpenConfigModal(false);
      setConfigForm({ key: "", valueString: "", isActive: true });
      await loadAll();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteConfig = async (rowId: string) => {
    if (!confirm("Obrisati ovaj red?")) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/suppliers/${supplierId}/config?rowId=${rowId}`, {
        method: "DELETE"
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "Delete failed");
      await loadAll();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (supplierLoading && !supplier) {
    return (
      <Box p={3} display="flex" alignItems="center" gap={2}>
        <CircularProgress size={20} />
        <Typography>Učitavanje…</Typography>
      </Box>
    );
  }

  if (!supplier) {
    return (
      <Box p={3}>
        <Typography color="error">Dobavljač nije pronađen.</Typography>
        {supplierError && (
          <Typography color="error" sx={{ mt: 1 }}>
            {supplierError}
          </Typography>
        )}
        <Button component={NextLink} href="/admin/suppliers" sx={{ mt: 2 }}>
          ← Lista
        </Button>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack>
          <Typography variant="h5">{supplier.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            code={supplier.code} · kind={supplier.kind ?? "—"} · currency={supplier.defaultCurrency ?? "—"}
          </Typography>
        </Stack>
        <Button component={NextLink} href="/admin/suppliers" size="small">
          ← Lista
        </Button>
      </Stack>

      {actionError && (
        <Typography color="error" sx={{ mb: 2 }}>
          {actionError}
        </Typography>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="categories" label={`Categories (${supplierCategories.length})`} />
        <Tab value="mappings" label={`Attribute Mappings (${mappings.length})`} />
        <Tab value="config" label={`Scrape Config (${configRows.length})`} />
        <Tab value="settings" label="Settings" />
      </Tabs>

      {actionNotice ? (
        <Typography color="success.main" sx={{ mb: 2 }}>
          {actionNotice}
        </Typography>
      ) : null}

      {tab === "categories" && (
        <Card sx={{ p: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
            <Box>
              <Typography variant="subtitle1">Kategorije ovog dobavljača</Typography>
              {supportsCategoryImport ? (
                <Typography variant="caption" color="text.secondary" display="block">
                  {isFirstshopSupplier
                    ? "Pun FirstShop import (jobs) čita sve aktivne kategorije iz tabele. „Import sada” skrejpuje cijeli listing za ovaj red."
                    : isPcxSupplier
                      ? "Pun PCX import (jobs) ide po svim kategorijama s cap-om po runu. „Import sada” skrejpuje cijeli listing ove kategorije."
                      : "Pun iPon import (jobs) koristi redove s Active=yes. „Import sada” uvijek samo taj listing; deaktivacija ponuda samo u toj internoj kategoriji."}
                </Typography>
              ) : null}
            </Box>
            <Button variant="contained" size="small" onClick={openAddCategoryModal} disabled={busy}>
              Dodaj kategoriju
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Sort</TableCell>
                <TableCell>Interna kategorija</TableCell>
                <TableCell>Source key</TableCell>
                <TableCell>Listing URL</TableCell>
                <TableCell>Active</TableCell>
                    {supportsCategoryImport ? <TableCell align="right">Import</TableCell> : null}
                    <TableCell align="center">Akcije</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {supplierCategories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={supportsCategoryImport ? 7 : 6}>
                    <Typography align="center" sx={{ py: 2 }} color="text.secondary">
                      Nema kategorija (hardcoded fallback i dalje radi).
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                supplierCategories.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.sortOrder}</TableCell>
                    <TableCell>{row.category?.name ?? row.internalCategoryId}</TableCell>
                    <TableCell>{row.supplierCategoryKey ?? "—"}</TableCell>
                    <TableCell sx={{ maxWidth: 320, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {row.listingUrl ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={row.isActive ? "yes" : "no"} color={row.isActive ? "success" : "default"} />
                    </TableCell>
                    {supportsCategoryImport ? (
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="contained"
                          color="secondary"
                          disabled={busy || categoryImportRowId != null || !row.listingUrl?.trim()}
                          onClick={() => void handleImportCategory(row)}
                        >
                          {categoryImportRowId === row.id ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            "Import sada"
                          )}
                        </Button>
                      </TableCell>
                    ) : null}
                    <TableCell align="center">
                      <StyledIconButton
                        onClick={() => openEditCategoryModal(row)}
                        disabled={busy}
                        title="Uredi"
                      >
                        <Edit />
                      </StyledIconButton>
                      <StyledIconButton
                        onClick={() => void handleDeleteCategory(row.id)}
                        disabled={busy}
                        title="Obriši"
                        sx={{ "&:hover": { color: "error.main" } }}
                      >
                        <Delete />
                      </StyledIconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {tab === "mappings" && (
        <Card sx={{ p: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
            <Typography variant="subtitle1">Mapiranje source atributa</Typography>
            <Button variant="contained" size="small" onClick={() => setOpenMappingModal(true)} disabled={busy}>
              Dodaj mapping
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Source field name</TableCell>
                <TableCell>Match</TableCell>
                <TableCell>Internal attribute</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Active</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {mappings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7}>
                    <Typography align="center" sx={{ py: 2 }} color="text.secondary">
                      Nema mapiranja (hardcoded mapSpecNameToSlug i dalje radi kao fallback).
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                mappings.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.sourceFieldName}</TableCell>
                    <TableCell>{row.matchMode}</TableCell>
                    <TableCell>
                      {row.attribute?.name ?? row.attributeId}{" "}
                      <Typography variant="caption" color="text.secondary">
                        {row.attribute?.slug ? `(${row.attribute.slug})` : ""}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {row.internalCategoryId ? (categoryNameById.get(row.internalCategoryId) ?? row.internalCategoryId) : "Sve"}
                    </TableCell>
                    <TableCell>{row.priority}</TableCell>
                    <TableCell>
                      <Chip size="small" label={row.isActive ? "yes" : "no"} color={row.isActive ? "success" : "default"} />
                    </TableCell>
                    <TableCell align="right">
                      <Button color="error" size="small" onClick={() => void handleDeleteMapping(row.id)} disabled={busy}>
                        Obriši
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {tab === "config" && (
        <Card sx={{ p: 0 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
            <Typography variant="subtitle1">Scrape konfiguracija (key/value)</Typography>
            <Button variant="contained" size="small" onClick={() => setOpenConfigModal(true)} disabled={busy}>
              Dodaj/promijeni
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Key</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Active</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {configRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography align="center" sx={{ py: 2 }} color="text.secondary">
                      Nema konfiguracije (koristi se kod fallback).
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                configRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.key}</TableCell>
                    <TableCell>
                      <Box component="code" sx={{ fontSize: 12 }}>
                        {jsonValueString(row.value)}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={row.isActive ? "yes" : "no"} color={row.isActive ? "success" : "default"} />
                    </TableCell>
                    <TableCell align="right">
                      <Button color="error" size="small" onClick={() => void handleDeleteConfig(row.id)} disabled={busy}>
                        Obriši
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {tab === "settings" && (
        <Card sx={{ p: 3 }}>
          <Stack spacing={2} maxWidth={520}>
            <TextField
              size="small"
              label="Kind"
              value={supplier.kind ?? ""}
              onChange={(e) => setSupplier({ ...supplier, kind: e.target.value || null })}
            />
            <TextField
              size="small"
              label="Base URL"
              value={supplier.baseUrl ?? ""}
              onChange={(e) => setSupplier({ ...supplier, baseUrl: e.target.value || null })}
            />
            <TextField
              size="small"
              label="Default currency"
              value={supplier.defaultCurrency ?? ""}
              onChange={(e) => setSupplier({ ...supplier, defaultCurrency: e.target.value || null })}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={supplier.createsMasterProducts}
                  onChange={(e) => setSupplier({ ...supplier, createsMasterProducts: e.target.checked })}
                />
              }
              label="Pravi master proizvode"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={supplier.isActive}
                  onChange={(e) => setSupplier({ ...supplier, isActive: e.target.checked })}
                />
              }
              label="Aktivan"
            />
            <TextField
              size="small"
              type="number"
              label="Enrichment priority (manji = viši prioritet)"
              helperText="iPon = 10, PCX = 50. Koristi se u waterfall enrichment job-u."
              value={supplier.enrichmentPriority}
              onChange={(e) => setSupplier({ ...supplier, enrichmentPriority: Math.max(1, Number(e.target.value)) })}
              inputProps={{ min: 1, step: 1 }}
            />
            <Typography variant="subtitle2" sx={{ pt: 1 }}>
              Raspored isporuke kod nas
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Roba stiže kod vas <strong>svakog ponedjeljka</strong>, nakon lead vremena ispod.
            </Typography>
            {supplier.id === IPON_SUPPLIER_ID ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                <strong>iPon:</strong> lead po artiklu iz <code>delivery_days</code> (iPon API{" "}
                <code>deliveryDays</code>). Ako je prazno → <strong>0</strong> (npr. nedjelja → sljedeći ponedjeljak).
              </Typography>
            ) : (
              <TextField
                size="small"
                type="number"
                label="Default lead (dani prije ponedeljka)"
                helperText="Koristi se za sve ponude ovog dobavljača (NULL na artiklu = ova vrijednost). Preporuka: 7."
                value={supplier.inboundLeadDaysDefault}
                onChange={(e) =>
                  setSupplier({
                    ...supplier,
                    inboundLeadDaysDefault: Math.max(0, Math.round(Number(e.target.value)) || 0)
                  })
                }
                inputProps={{ min: 0, step: 1 }}
              />
            )}
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={() => void handleSaveSettings()} disabled={busy}>
                Sačuvaj
              </Button>
              <Button onClick={() => void loadAll()} disabled={busy}>
                Otkaži
              </Button>
            </Stack>
          </Stack>
        </Card>
      )}

      <Dialog open={openCatModal} onClose={closeCatModal} fullWidth maxWidth="sm">
        <DialogTitle>{editingCategoryId ? "Uredi kategoriju" : "Nova kategorija"}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="Parent kategorija"
                value={catForm.parentCategoryId}
                onChange={(e) =>
                  setCatForm({ ...catForm, parentCategoryId: e.target.value, internalCategoryId: "" })
                }
                disabled={Boolean(editingCategoryId)}
                helperText={editingCategoryId ? "Interna kategorija se ne mijenja na postojećem redu." : undefined}
              >
                <MenuItem value="">Odaberi parent</MenuItem>
                {rootCategories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="Podkategorija"
                value={catForm.internalCategoryId}
                onChange={(e) => setCatForm({ ...catForm, internalCategoryId: e.target.value })}
                disabled={Boolean(editingCategoryId) || !catForm.parentCategoryId}
                helperText={
                  editingCategoryId
                    ? undefined
                    : !catForm.parentCategoryId
                      ? "Prvo odaberi parent kategoriju."
                      : childCategoriesForParent.length === 0
                        ? "Nema podkategorija za ovaj parent."
                        : undefined
                }
              >
                <MenuItem value="">Odaberi podkategoriju</MenuItem>
                {childCategoriesForParent.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                size="small"
                label="Source category key (npr. iPon group id)"
                value={catForm.supplierCategoryKey}
                onChange={(e) => setCatForm({ ...catForm, supplierCategoryKey: e.target.value })}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                size="small"
                label="Listing URL"
                value={catForm.listingUrl}
                onChange={(e) => setCatForm({ ...catForm, listingUrl: e.target.value })}
              />
            </Grid>
            <Grid size={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Sort order"
                value={catForm.sortOrder}
                onChange={(e) => setCatForm({ ...catForm, sortOrder: Number(e.target.value) })}
              />
            </Grid>
            <Grid size={6}>
              <FormControlLabel
                control={<Switch checked={catForm.isActive} onChange={(e) => setCatForm({ ...catForm, isActive: e.target.checked })} />}
                label="Aktivna"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCatModal}>Otkaži</Button>
          <Button
            onClick={() => void handleSaveCategory()}
            variant="contained"
            disabled={busy || (!editingCategoryId && !catForm.internalCategoryId)}
          >
            Sačuvaj
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openMappingModal} onClose={() => setOpenMappingModal(false)} fullWidth maxWidth="sm">
        <DialogTitle>Novi mapping</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Internal attribute"
                value={mappingForm.attributeId}
                onChange={(e) => setMappingForm({ ...mappingForm, attributeId: e.target.value })}
              >
                {attributes.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name} ({a.slug})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                size="small"
                label="Source field name"
                value={mappingForm.sourceFieldName}
                onChange={(e) => setMappingForm({ ...mappingForm, sourceFieldName: e.target.value })}
                helperText="npr. 'CPU foglalat' ili 'socket' (lowercase i 'contains' match je preporuka)"
              />
            </Grid>
            <Grid size={6}>
              <TextField
                select
                fullWidth
                size="small"
                label="Match mode"
                value={mappingForm.matchMode}
                onChange={(e) => setMappingForm({ ...mappingForm, matchMode: e.target.value as "exact" | "contains" | "regex" })}
              >
                <MenuItem value="exact">exact</MenuItem>
                <MenuItem value="contains">contains</MenuItem>
                <MenuItem value="regex">regex</MenuItem>
              </TextField>
            </Grid>
            <Grid size={6}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Priority (manje = ranije)"
                value={mappingForm.priority}
                onChange={(e) => setMappingForm({ ...mappingForm, priority: Number(e.target.value) })}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                select
                fullWidth
                size="small"
                label="Parent kategorija (opcionalno)"
                value={mappingForm.internalCategoryId}
                onChange={(e) => setMappingForm({ ...mappingForm, internalCategoryId: e.target.value })}
              >
                <MenuItem value="">Sve kategorije</MenuItem>
                {rootCategories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={12}>
              <FormControlLabel
                control={<Switch checked={mappingForm.isActive} onChange={(e) => setMappingForm({ ...mappingForm, isActive: e.target.checked })} />}
                label="Aktivno"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMappingModal(false)}>Otkaži</Button>
          <Button onClick={() => void handleAddMapping()} variant="contained" disabled={busy}>
            Sačuvaj
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openConfigModal} onClose={() => setOpenConfigModal(false)} fullWidth maxWidth="sm">
        <DialogTitle>Scrape config</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={12}>
              <TextField
                fullWidth
                size="small"
                label="Key"
                value={configForm.key}
                onChange={(e) => setConfigForm({ ...configForm, key: e.target.value })}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                size="small"
                label="Value (JSON ili plain text)"
                value={configForm.valueString}
                onChange={(e) => setConfigForm({ ...configForm, valueString: e.target.value })}
                helperText='Primjer: 4000 ili "https://..." ili {"foo":1}'
              />
            </Grid>
            <Grid size={12}>
              <FormControlLabel
                control={<Switch checked={configForm.isActive} onChange={(e) => setConfigForm({ ...configForm, isActive: e.target.checked })} />}
                label="Aktivno"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenConfigModal(false)}>Otkaži</Button>
          <Button onClick={() => void handleAddConfig()} variant="contained" disabled={busy}>
            Sačuvaj
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
