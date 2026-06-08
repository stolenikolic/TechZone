"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
// MUI
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { normalizeAttributeSlug } from "lib/normalize-slug";
// GLOBAL CUSTOM COMPONENTS
import DropZone from "components/DropZone";
import FlexBox from "components/flex-box/flex-box";
import TextField from "@mui/material/TextField";
// STYLED COMPONENTS
import { UploadImageBox, StyledClear } from "../styles";
// CUSTOM DATA MODEL
import { PreviewFile } from "models/Common";

// ================================================================
interface Props {
  mode: "create" | "edit";
}
// ================================================================

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
};

type AttributeOption = {
  id: string;
  name: string;
  slug: string;
  filter_display_type: string | null;
  filter_unit: string | null;
  filter_step: number | null;
};

type CategoryAttributeRow = AttributeOption & { sort_order: number };

type CategoryProductRow = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  image: string;
  price: number;
  highlighted: boolean;
  priority: number | null;
};

type SupplierOption = { id: string; name: string; code: string };

type SpecFieldEntry = {
  name: string;
  exampleValue: string;
  productCount: number;
  mapping: {
    id: string;
    attributeId: string;
    attributeName: string;
    attributeSlug: string;
    matchMode: string;
    priority: number;
  } | null;
};

type SpecFieldsMeta = {
  categoryIdsInTree: number;
  productsInTree: number;
  supplierRowsWithSnapshot: number;
};

type MappingDialogState = {
  open: boolean;
  /** Set when editing an existing row; null when creating a new mapping. */
  mappingId: string | null;
  fieldName: string;
  attributeId: string;
  matchMode: "exact" | "contains" | "regex";
  priority: number;
};

type ValueAliasGroup = {
  canonicalLabel: string;
  productCount: number;
  aliases: Array<{
    id: string;
    alias: string;
    matchMode: string;
    supplierId: string | null;
    priority: number;
    isActive: boolean;
  }>;
};

type ValueAliasCatalogEntry = {
  value: string;
  productCount: number;
  mappedTo: string | null;
};

type ValueAliasDialogState = {
  open: boolean;
  attributeId: string;
  attributeName: string;
  attributeSlug: string;
};

export default function CategoryForm({ mode }: Props) {
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const categorySlug = params?.slug ?? "";
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttributeRow[]>([]);
  const [allAttributes, setAllAttributes] = useState<AttributeOption[]>([]);
  const [attachAttributeId, setAttachAttributeId] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sellingMarginDefault, setSellingMarginDefault] = useState("");
  const [products, setProducts] = useState<CategoryProductRow[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [productsLoading, setProductsLoading] = useState(false);

  const parentOptions = useMemo(
    () =>
      categories.filter((item) => (mode === "edit" && categoryId ? item.id !== categoryId : true)),
    [categories, mode, categoryId]
  );

  const sortedCategoryProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      if (a.highlighted !== b.highlighted) return a.highlighted ? -1 : 1;
      if (a.highlighted && b.highlighted) {
        const pa = a.priority ?? 100;
        const pb = b.priority ?? 100;
        if (pa !== pb) return pa - pb;
      }
      return 0;
    });
  }, [products]);

  const [newAttribute, setNewAttribute] = useState({
    name: "",
    slug: "",
    displayType: "checkbox" as "checkbox" | "range",
    unit: "",
    step: "1"
  });

  // Spec-fields mapping helper state
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [specFields, setSpecFields] = useState<SpecFieldEntry[]>([]);
  const [specFieldsMeta, setSpecFieldsMeta] = useState<SpecFieldsMeta | null>(null);
  const [specFieldsLoading, setSpecFieldsLoading] = useState(false);
  const [mappingDialog, setMappingDialog] = useState<MappingDialogState>({
    open: false,
    mappingId: null,
    fieldName: "",
    attributeId: "",
    matchMode: "contains",
    priority: 100
  });
  const [mappingBusy, setMappingBusy] = useState(false);
  const [attributesSectionSaving, setAttributesSectionSaving] = useState(false);
  const [enrichmentRunBusy, setEnrichmentRunBusy] = useState(false);
  const [enrichmentDialogOpen, setEnrichmentDialogOpen] = useState(false);
  const [enrichmentOverwrite, setEnrichmentOverwrite] = useState(false);

  const [valueAliasDialog, setValueAliasDialog] = useState<ValueAliasDialogState>({
    open: false,
    attributeId: "",
    attributeName: "",
    attributeSlug: ""
  });
  const [valueAliasGroups, setValueAliasGroups] = useState<ValueAliasGroup[]>([]);
  const [valueAliasCatalog, setValueAliasCatalog] = useState<ValueAliasCatalogEntry[]>([]);
  const [valueAliasLoading, setValueAliasLoading] = useState(false);
  const [valueAliasBusy, setValueAliasBusy] = useState(false);
  const [valueAliasApplyBusy, setValueAliasApplyBusy] = useState(false);
  const [newValueAlias, setNewValueAlias] = useState({ alias: "", canonicalLabel: "" });

  /** Atributi za mapping dijalog: samo oni vezani za ovu kategoriju (+ eventualno već mapirani izvan liste). */
  const mappingAttributeChoices = useMemo(() => {
    const rows = [...categoryAttributes].sort((a, b) => a.sort_order - b.sort_order);
    if (mappingDialog.attributeId && !rows.some((r) => r.id === mappingDialog.attributeId)) {
      const orphan = allAttributes.find((a) => a.id === mappingDialog.attributeId);
      if (orphan) {
        return [
          ...rows,
          {
            ...orphan,
            sort_order: 999999
          } as CategoryAttributeRow
        ];
      }
    }
    return rows;
  }, [categoryAttributes, allAttributes, mappingDialog.attributeId]);

  // HANDLE UPDATE NEW IMAGE VIA DROP ZONE
  const handleChangeDropZone = (files: File[]) => {
    files.forEach((file) => Object.assign(file, { preview: URL.createObjectURL(file) }));
    setFiles(files as PreviewFile[]);
  };

  // HANDLE DELETE UPLOAD IMAGE
  const handleFileDelete = (file: File) => () => {
    setFiles((files) => files.filter((item) => item.name !== file.name));
  };

  const loadProducts = async (id: string, page = 1, query = "") => {
    setProductsLoading(true);
    try {
      const response = await fetch(
        `/api/admin/categories/${id}/products?page=${page}&q=${encodeURIComponent(query)}`,
        { cache: "no-store" }
      );
      const data = (await response.json()) as { products?: CategoryProductRow[]; error?: string };
      if (!response.ok || data.error) throw new Error(data.error ?? "Failed loading products.");
      setProducts(data.products ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed loading products.");
    } finally {
      setProductsLoading(false);
    }
  };

  const loadCategoryAttributes = async (slugParam: string) => {
    const response = await fetch(`/api/admin/categories/by-slug/${encodeURIComponent(slugParam)}`, {
      cache: "no-store"
    });
    const data = (await response.json()) as
      | {
          category: CategoryOption & { image_url: string | null; selling_margin_default: number | null };
          categories: CategoryOption[];
          attributes: AttributeOption[];
          categoryAttributes: CategoryAttributeRow[];
        }
      | { error: string };
    if (!response.ok || "error" in data) {
      throw new Error("error" in data ? data.error : "Failed loading category.");
    }
    setCategoryId(data.category.id);
    setCategories(data.categories);
    setAllAttributes(data.attributes ?? []);
    setCategoryAttributes(
      [...(data.categoryAttributes ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    );
    setName(data.category.name);
    setSlug(data.category.slug);
    setParentId(data.category.parent_id ?? "");
    setImageUrl(data.category.image_url ?? "");
    setSellingMarginDefault(
      data.category.selling_margin_default != null
        ? String(data.category.selling_margin_default)
        : ""
    );
    await loadProducts(data.category.id, 1, "");
  };

  const loadSuppliers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/suppliers", { cache: "no-store" });
      const data = (await res.json()) as { items?: SupplierOption[] };
      setSuppliers(data.items ?? []);
    } catch {
      // non-fatal
    }
  }, []);

  const loadSpecFields = useCallback(
    async (suppId: string) => {
      if (!categoryId || !suppId) return;
      setSpecFieldsLoading(true);
      try {
        const res = await fetch(
          `/api/admin/categories/${categoryId}/spec-fields?supplierId=${encodeURIComponent(suppId)}`,
          { cache: "no-store" }
        );
        const data = (await res.json()) as {
          fields?: SpecFieldEntry[];
          meta?: SpecFieldsMeta;
          error?: string;
        };
        if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
        setSpecFields(data.fields ?? []);
        setSpecFieldsMeta(data.meta ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed loading spec fields.");
      } finally {
        setSpecFieldsLoading(false);
      }
    },
    [categoryId]
  );

  useEffect(() => {
    const load = async () => {
      setError(null);
      setNotice(null);
      try {
        if (mode === "create") {
          const response = await fetch("/api/admin/categories/meta", { cache: "no-store" });
          const data = (await response.json()) as
            | { categories: CategoryOption[]; attributes: AttributeOption[] }
            | { error: string };
          if (!response.ok || "error" in data) {
            throw new Error("error" in data ? data.error : "Failed loading metadata.");
          }
          setCategories(data.categories);
          return;
        }

        if (!categorySlug) throw new Error("Missing category slug.");
        await loadCategoryAttributes(categorySlug);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed loading category.");
      } finally {
        setLoading(false);
      }
    };
    void load();
    void loadSuppliers();
  }, [mode, categorySlug, loadSuppliers]);

  const uploadCategoryImageFile = async (id: string, file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`/api/admin/categories/${id}/image`, {
      method: "POST",
      body: formData
    });
    const data = (await response.json()) as { imageUrl?: string; error?: string };
    if (!response.ok || data.error) throw new Error(data.error ?? "Image upload failed.");
    if (!data.imageUrl) throw new Error("Image upload did not return a URL.");
    return data.imageUrl;
  };

  const saveCategory = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      let resolvedImageUrl = imageUrl.trim() || null;
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        parentId: parentId || null,
        imageUrl: resolvedImageUrl,
        sellingMarginDefault: sellingMarginDefault.trim() ? Number(sellingMarginDefault) : null
      };

      if (mode === "create") {
        const response = await fetch("/api/admin/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = (await response.json()) as { id?: string; error?: string };
        if (!response.ok || data.error) throw new Error(data.error ?? "Create failed.");
        if (data.id && files.length > 0) {
          resolvedImageUrl = await uploadCategoryImageFile(data.id, files[0]);
          setImageUrl(resolvedImageUrl);
          setFiles([]);
        }
        setNotice("Category created.");
        router.push("/admin/categories");
        return;
      }

      if (!categoryId) throw new Error("Category not loaded.");
      if (files.length > 0) {
        resolvedImageUrl = await uploadCategoryImageFile(categoryId, files[0]);
        setImageUrl(resolvedImageUrl);
        setFiles([]);
        payload.imageUrl = resolvedImageUrl;
      }
      const response = await fetch(`/api/admin/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok || data.error) throw new Error(data.error ?? "Save failed.");
      setNotice("Category saved.");
      await loadCategoryAttributes(slug.trim() || categorySlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const createCategoryAttribute = async () => {
    if (!categoryId) return;
    if (!newAttribute.name.trim()) {
      setError("Attribute name is required.");
      return;
    }
    try {
      const response = await fetch(`/api/admin/categories/${categoryId}/attributes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newAttribute.name.trim(),
          slug: newAttribute.slug.trim(),
          displayType: newAttribute.displayType,
          unit: newAttribute.unit.trim() || null,
          step:
            newAttribute.displayType === "range"
              ? Number(newAttribute.step || "1")
              : null
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok || data.error) throw new Error(data.error ?? "Attribute create failed.");
      setNotice("Attribute created and attached.");
      setNewAttribute({ name: "", slug: "", displayType: "checkbox", unit: "", step: "1" });
      await loadCategoryAttributes(slug.trim() || categorySlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attribute create failed.");
    }
  };

  const attachExistingAttribute = async () => {
    if (!categoryId || !attachAttributeId) return;
    try {
      const response = await fetch(`/api/admin/categories/${categoryId}/attributes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributeId: attachAttributeId })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok || data.error) throw new Error(data.error ?? "Attach failed.");
      setAttachAttributeId("");
      await loadCategoryAttributes(slug.trim() || categorySlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attach failed.");
    }
  };

  const moveCategoryAttribute = async (attributeId: string, direction: "up" | "down") => {
    if (!categoryId) return;
    try {
      const response = await fetch(`/api/admin/categories/${categoryId}/attributes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move", attributeId, direction })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok || data.error) throw new Error(data.error ?? "Reorder failed.");
      await loadCategoryAttributes(slug.trim() || categorySlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reorder failed.");
    }
  };

  const saveAllCategoryAttributeEdits = async () => {
    if (!categoryId || categoryAttributes.length === 0) return;
    setAttributesSectionSaving(true);
    setError(null);
    try {
      await Promise.all(
        categoryAttributes.map(async (row) => {
          const response = await fetch(`/api/admin/categories/${categoryId}/attributes`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "update",
              attributeId: row.id,
              name: row.name,
              slug: row.slug,
              displayType: row.filter_display_type === "range" ? "range" : "checkbox",
              unit: row.filter_unit ?? null,
              step: row.filter_step ?? null
            })
          });
          const data = (await response.json()) as { error?: string };
          if (!response.ok || data.error) throw new Error(data.error ?? `Greška pri čuvanju: ${row.slug}`);
        })
      );
      setNotice("Izmjene u tabeli filtera su sačuvane.");
      await loadCategoryAttributes(slug.trim() || categorySlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Čuvanje filtera nije uspjelo.");
    } finally {
      setAttributesSectionSaving(false);
    }
  };

  const loadValueAliases = async (attributeId: string) => {
    if (!categoryId) return;
    setValueAliasLoading(true);
    try {
      const res = await fetch(
        `/api/admin/categories/${categoryId}/attributes/${attributeId}/value-aliases`,
        { cache: "no-store" }
      );
      const data = (await res.json()) as {
        groups?: ValueAliasGroup[];
        catalogValues?: ValueAliasCatalogEntry[];
        error?: string;
      };
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed loading value aliases.");
      setValueAliasGroups(data.groups ?? []);
      setValueAliasCatalog(data.catalogValues ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed loading value aliases.");
    } finally {
      setValueAliasLoading(false);
    }
  };

  const openValueAliasDialog = (attribute: CategoryAttributeRow) => {
    setNewValueAlias({ alias: "", canonicalLabel: "" });
    setValueAliasDialog({
      open: true,
      attributeId: attribute.id,
      attributeName: attribute.name,
      attributeSlug: attribute.slug
    });
    void loadValueAliases(attribute.id);
  };

  const handleAddValueAlias = async () => {
    if (!categoryId || !valueAliasDialog.attributeId) return;
    const alias = newValueAlias.alias.trim();
    const canonicalLabel = newValueAlias.canonicalLabel.trim();
    if (!alias || !canonicalLabel) {
      setError("Unesi alias i normalizovanu vrijednost.");
      return;
    }
    setValueAliasBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/categories/${categoryId}/attributes/${valueAliasDialog.attributeId}/value-aliases`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alias, canonicalLabel, matchMode: "exact" })
        }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed saving alias.");
      setNewValueAlias({ alias: "", canonicalLabel: "" });
      setNotice("Mapa vrijednosti sačuvana.");
      await loadValueAliases(valueAliasDialog.attributeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed saving value alias.");
    } finally {
      setValueAliasBusy(false);
    }
  };

  const handleDeleteValueAlias = async (aliasId: string) => {
    if (!categoryId || !valueAliasDialog.attributeId) return;
    setValueAliasBusy(true);
    try {
      const res = await fetch(
        `/api/admin/categories/${categoryId}/attributes/${valueAliasDialog.attributeId}/value-aliases/${aliasId}`,
        { method: "DELETE" }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed deleting alias.");
      setNotice("Mapa obrisana.");
      await loadValueAliases(valueAliasDialog.attributeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed deleting value alias.");
    } finally {
      setValueAliasBusy(false);
    }
  };

  const handleApplyValueAliases = async () => {
    if (!categoryId || !valueAliasDialog.attributeId) return;
    setValueAliasApplyBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/categories/${categoryId}/attributes/${valueAliasDialog.attributeId}/value-aliases/apply`,
        { method: "POST" }
      );
      const data = (await res.json()) as {
        error?: string;
        rowsUpdated?: number;
        productsUpdated?: number;
      };
      if (!res.ok || data.error) throw new Error(data.error ?? "Apply failed.");
      setNotice(
        `Mape primijenjene: ${data.rowsUpdated ?? 0} vrijednosti na ${data.productsUpdated ?? 0} proizvoda.`
      );
      await loadValueAliases(valueAliasDialog.attributeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed applying value aliases.");
    } finally {
      setValueAliasApplyBusy(false);
    }
  };

  const handleMapCatalogValue = (value: string, canonicalLabel: string) => {
    setNewValueAlias({ alias: value, canonicalLabel: canonicalLabel || value });
  };

  const runCategoryEnrichment = async (overwrite: boolean) => {
    if (!categoryId) return;
    setEnrichmentRunBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/jobs/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType: "enrichment",
          enrichmentCategoryId: categoryId,
          enrichmentOverwrite: overwrite
        })
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        result?: { productsProcessed?: number; attributesWritten?: number; errors?: number };
      };
      if (!res.ok || data.error) throw new Error(data.error ?? "Enrichment job nije uspio.");
      const r = data.result;
      const modeLabel = overwrite ? "prepis postojećih" : "samo prazna polja";
      if (r && typeof r.productsProcessed === "number") {
        setNotice(
          `Enrichment završen (${modeLabel}): ${r.productsProcessed} proizvoda, ${r.attributesWritten ?? 0} vrijednosti upisano, greške: ${r.errors ?? 0}.`
        );
      } else {
        setNotice(`Enrichment job je završen (${modeLabel}).`);
      }
      setEnrichmentDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrichment nije uspio.");
    } finally {
      setEnrichmentRunBusy(false);
    }
  };

  const detachCategoryAttribute = async (attributeId: string) => {
    if (!categoryId) return;
    try {
      const response = await fetch(`/api/admin/categories/${categoryId}/attributes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributeId })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok || data.error) throw new Error(data.error ?? "Detach failed.");
      await loadCategoryAttributes(slug.trim() || categorySlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Detach failed.");
    }
  };

  const handleOpenMappingDialog = (field: SpecFieldEntry) => {
    setMappingDialog({
      open: true,
      mappingId: field.mapping?.id ?? null,
      fieldName: field.name,
      attributeId: field.mapping?.attributeId ?? "",
      matchMode: (field.mapping?.matchMode as "exact" | "contains" | "regex") ?? "contains",
      priority: field.mapping?.priority ?? 100
    });
  };

  const handleSaveMapping = async () => {
    if (!selectedSupplierId || !mappingDialog.attributeId) return;
    setMappingBusy(true);
    try {
      const isEdit = Boolean(mappingDialog.mappingId);
      const res = await fetch(`/api/admin/suppliers/${selectedSupplierId}/mappings`, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? {
                id: mappingDialog.mappingId,
                attributeId: mappingDialog.attributeId,
                sourceFieldName: mappingDialog.fieldName,
                matchMode: mappingDialog.matchMode,
                priority: mappingDialog.priority,
                internalCategoryId: categoryId,
                isActive: true
              }
            : {
                attributeId: mappingDialog.attributeId,
                sourceFieldName: mappingDialog.fieldName,
                matchMode: mappingDialog.matchMode,
                priority: mappingDialog.priority,
                internalCategoryId: categoryId,
                isActive: true
              }
        )
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      setMappingDialog((d) => ({ ...d, open: false, mappingId: null }));
      await loadSpecFields(selectedSupplierId);
      setNotice(isEdit ? "Mapping ažuriran." : "Mapping kreiran.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mapping save failed.");
    } finally {
      setMappingBusy(false);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!selectedSupplierId) return;
    setMappingBusy(true);
    try {
      const res = await fetch(
        `/api/admin/suppliers/${selectedSupplierId}/mappings?rowId=${encodeURIComponent(mappingId)}`,
        { method: "DELETE" }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      await loadSpecFields(selectedSupplierId);
      setNotice("Mapping obrisan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mapping delete failed.");
    } finally {
      setMappingBusy(false);
    }
  };

  const updateTopPick = async (product: CategoryProductRow, highlighted: boolean, priority: number) => {
    if (!categoryId) return;
    try {
      const response = await fetch(`/api/admin/categories/${categoryId}/products`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          highlighted,
          priority
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok || data.error) throw new Error(data.error ?? "Failed update.");
      await loadProducts(categoryId, productPage, productQuery);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed updating top pick.");
    }
  };

  if (loading) return <Card className="p-3">Loading...</Card>;
  const attachedIds = new Set(categoryAttributes.map((item) => item.id));
  const availableForAttach = allAttributes.filter((item) => !attachedIds.has(item.id));

  return (
    <Stack spacing={2}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {notice ? <Alert severity="success">{notice}</Alert> : null}

      <Card className="p-3">
        <Grid container spacing={3}>
          <Grid size={{ sm: 6, xs: 12 }}>
            <TextField fullWidth label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          </Grid>
          <Grid size={{ sm: 6, xs: 12 }}>
            <TextField fullWidth label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </Grid>
          <Grid size={{ sm: 6, xs: 12 }}>
            <TextField
              select
              fullWidth
              value={parentId}
              label="Parent Category"
              onChange={(e) => setParentId(e.target.value)}
            >
              <MenuItem value="">No parent</MenuItem>
              {parentOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ sm: 6, xs: 12 }}>
            <TextField
              fullWidth
              type="number"
              label="Category margin override"
              value={sellingMarginDefault}
              onChange={(e) => setSellingMarginDefault(e.target.value)}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              fullWidth
              label="Image URL"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              helperText="External URL is converted to WebP on save. Or upload a file below."
            />
          </Grid>
          <Grid size={12}>
            <DropZone onChange={(incomingFiles) => handleChangeDropZone(incomingFiles)} />
            <FlexBox flexDirection="row" mt={2} flexWrap="wrap" gap={1}>
              {files.map((file, index) => (
                <UploadImageBox key={index}>
                  <Box component="img" alt="category" src={file.preview} width="100%" />
                  <StyledClear onClick={handleFileDelete(file)} />
                </UploadImageBox>
              ))}
            </FlexBox>
          </Grid>

          <Grid size={12}>
            <Button
              disabled={saving}
              variant="contained"
              color="info"
              onClick={() => void saveCategory()}
            >
              {saving ? "Saving..." : "Save category"}
            </Button>
          </Grid>
        </Grid>
      </Card>

      {mode === "edit" && categoryId ? (
        <Card className="p-3">
          <Stack spacing={2}>
            <Stack direction={{ md: "row", xs: "column" }} spacing={1}>
              <TextField
                select
                fullWidth
                size="small"
                label="Attach existing attribute"
                value={attachAttributeId}
                onChange={(e) => setAttachAttributeId(e.target.value)}
              >
                <MenuItem value="">Select attribute</MenuItem>
                {availableForAttach.map((attribute) => (
                  <MenuItem key={attribute.id} value={attribute.id}>
                    {attribute.name} ({attribute.slug})
                  </MenuItem>
                ))}
              </TextField>
              <Button variant="outlined" onClick={() => void attachExistingAttribute()}>
                Attach
              </Button>
            </Stack>
            <Grid container spacing={2}>
              <Grid size={{ md: 3, xs: 12 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Attribute name"
                  value={newAttribute.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setNewAttribute((prev) => ({
                      ...prev,
                      name,
                      slug: normalizeAttributeSlug(name)
                    }));
                  }}
                />
              </Grid>
              <Grid size={{ md: 3, xs: 12 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Slug"
                  value={newAttribute.slug}
                  slotProps={{ input: { readOnly: true } }}
                  helperText="Automatski iz naziva"
                />
              </Grid>
              <Grid size={{ md: 2, xs: 12 }}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Type"
                  value={newAttribute.displayType}
                  onChange={(e) =>
                    setNewAttribute((prev) => ({
                      ...prev,
                      displayType: e.target.value as "checkbox" | "range"
                    }))
                  }
                >
                  <MenuItem value="checkbox">checkbox</MenuItem>
                  <MenuItem value="range">range</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ md: 2, xs: 12 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Unit"
                  value={newAttribute.unit}
                  onChange={(e) => setNewAttribute((prev) => ({ ...prev, unit: e.target.value }))}
                />
              </Grid>
              <Grid size={{ md: 1, xs: 12 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="Step"
                  value={newAttribute.step}
                  onChange={(e) => setNewAttribute((prev) => ({ ...prev, step: e.target.value }))}
                />
              </Grid>
              <Grid size={{ md: 1, xs: 12 }}>
                <Button
                  fullWidth
                  variant="contained"
                  disabled={!newAttribute.name.trim() || !newAttribute.slug}
                  onClick={() => void createCategoryAttribute()}
                >
                  Add
                </Button>
              </Grid>
            </Grid>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Izmjene u kolonama ispod snimi jednim dugmetom. Redoslijed (Up/Down) se i dalje snima odmah po kliku.
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Order</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Slug</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Step</TableCell>
                  <TableCell align="right">Vrijednosti</TableCell>
                  <TableCell align="right">Ukloni</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categoryAttributes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>No category attributes.</TableCell>
                  </TableRow>
                ) : (
                  categoryAttributes.map((attribute, index) => (
                    <TableRow key={attribute.id}>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={index === 0}
                            onClick={() => void moveCategoryAttribute(attribute.id, "up")}
                          >
                            Up
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={index === categoryAttributes.length - 1}
                            onClick={() => void moveCategoryAttribute(attribute.id, "down")}
                          >
                            Down
                          </Button>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={attribute.name}
                          onChange={(e) =>
                            setCategoryAttributes((prev) =>
                              prev.map((row) =>
                                row.id === attribute.id ? { ...row, name: e.target.value } : row
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={attribute.slug}
                          onChange={(e) =>
                            setCategoryAttributes((prev) =>
                              prev.map((row) =>
                                row.id === attribute.id ? { ...row, slug: e.target.value } : row
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={attribute.filter_display_type ?? "checkbox"}
                          onChange={(e) =>
                            setCategoryAttributes((prev) =>
                              prev.map((row) =>
                                row.id === attribute.id
                                  ? { ...row, filter_display_type: e.target.value }
                                  : row
                              )
                            )
                          }
                        >
                          <MenuItem value="checkbox">checkbox</MenuItem>
                          <MenuItem value="range">range</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={attribute.filter_unit ?? ""}
                          onChange={(e) =>
                            setCategoryAttributes((prev) =>
                              prev.map((row) =>
                                row.id === attribute.id
                                  ? { ...row, filter_unit: e.target.value }
                                  : row
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          type="number"
                          value={attribute.filter_step ?? ""}
                          onChange={(e) =>
                            setCategoryAttributes((prev) =>
                              prev.map((row) =>
                                row.id === attribute.id
                                  ? { ...row, filter_step: Number(e.target.value || 0) }
                                  : row
                              )
                            )
                          }
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          color="info"
                          onClick={() => openValueAliasDialog(attribute)}
                        >
                          Vrijednosti
                        </Button>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          color="error"
                          variant="outlined"
                          onClick={() => void detachCategoryAttribute(attribute.id)}
                        >
                          Detach
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              Ručne mape vrijednosti (npr. SATA III → SATA 3): dugme Vrijednosti — imaju prioritet nad automatskom
              normalizacijom. Za range atribute s Unit poljem, enrichment pri zapisu pretvara npr.{" "}
              <code>5pcs</code> u <code>5 kom</code> (izvlači broj + tvoj Unit). Unit se i dalje koristi na shop
              filter slajderu.
            </Typography>
            {categoryAttributes.length > 0 ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  color="info"
                  disabled={attributesSectionSaving}
                  onClick={() => void saveAllCategoryAttributeEdits()}
                >
                  {attributesSectionSaving ? "Čuvam…" : "Sačuvaj izmjene filtera"}
                </Button>
              </Stack>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      {mode === "edit" && categoryId ? (
        <Card className="p-3">
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Attribute Mappings — pregled polja dobavljača
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Odaberi dobavljača da vidiš koja polja postoje u spec_snapshot za proizvode ove kategorije i
            svih podkategorija. Zelena oznaka = polje je već mapirano na interni atribut.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} sx={{ mb: 2 }} flexWrap="wrap">
            <TextField
              select
              size="small"
              label="Dobavljač"
              value={selectedSupplierId}
              onChange={(e) => {
                setSelectedSupplierId(e.target.value);
                setSpecFields([]);
                setSpecFieldsMeta(null);
              }}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">— odaberi —</MenuItem>
              {suppliers.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              size="small"
              disabled={!selectedSupplierId || specFieldsLoading}
              onClick={() => void loadSpecFields(selectedSupplierId)}
            >
              {specFieldsLoading ? <CircularProgress size={16} /> : "Učitaj polja"}
            </Button>
            <Button
              variant="contained"
              color="secondary"
              size="small"
              disabled={enrichmentRunBusy}
              onClick={() => {
                setEnrichmentOverwrite(false);
                setEnrichmentDialogOpen(true);
              }}
            >
              {enrichmentRunBusy ? <CircularProgress size={16} color="inherit" /> : "Pokreni enrichment (ova kategorija)"}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
            Enrichment puni atribute iz već sačuvanih snapshotova (bez novog skrejpa). Za cijeli katalog koristi i
            /admin/jobs.
          </Typography>

          {specFields.length > 0 && (
            <>
              <Divider sx={{ mb: 2 }} />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Polje (source_field_name)</TableCell>
                    <TableCell>Primjer vrijednosti</TableCell>
                    <TableCell align="right">Br. proizvoda</TableCell>
                    <TableCell>Status mappinga</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {specFields.map((field) => (
                    <TableRow key={field.name}>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {field.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {field.exampleValue.length > 60
                            ? field.exampleValue.slice(0, 60) + "…"
                            : field.exampleValue}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{field.productCount}</TableCell>
                      <TableCell>
                        {field.mapping ? (
                          <Chip
                            size="small"
                            color="success"
                            label={`→ ${field.mapping.attributeSlug} (${field.mapping.matchMode})`}
                          />
                        ) : (
                          <Chip size="small" color="default" label="nije mapirano" />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={mappingBusy}
                            onClick={() => handleOpenMappingDialog(field)}
                          >
                            {field.mapping ? "Uredi" : "Mapiraj"}
                          </Button>
                          {field.mapping && (
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              disabled={mappingBusy}
                              onClick={() => void handleDeleteMapping(field.mapping!.id)}
                            >
                              Briši
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}

          {specFields.length === 0 && selectedSupplierId && !specFieldsLoading && (
            <Typography variant="body2" color="text.secondary" component="div">
              {specFieldsMeta && specFieldsMeta.productsInTree === 0 ? (
                <>
                  U ovoj kategoriji i podkategorijama nema proizvoda (nijedan red u{" "}
                  <code>products</code> sa odgovarajućim <code>category_id</code>). Zato nema ni polja iz
                  snapshotova.
                </>
              ) : specFieldsMeta && specFieldsMeta.supplierRowsWithSnapshot === 0 ? (
                <>
                  Za ovog dobavljača nema vezanih <code>supplier_products</code> sa <code>spec_snapshot</code> za
                  proizvode u ovom stablu kategorija (ili su ponude još bez <code>product_id</code>). Provjeri
                  odabir dobavljača (npr. iPon vs PCX) i pokreni scrape ili import.
                </>
              ) : specFieldsMeta && specFieldsMeta.supplierRowsWithSnapshot > 0 ? (
                <>
                  Postoji {specFieldsMeta.supplierRowsWithSnapshot} snapshot red(ova), ali u{" "}
                  <code>spec_snapshot.specs</code> nema parsabilnih parova ime/vrijednost (prazan niz ili
                  neočekivan format).
                </>
              ) : (
                <>Nema podataka za prikaz. Pokušaj ponovo „Učitaj polja“.</>
              )}
            </Typography>
          )}
        </Card>
      ) : null}

      {mode === "edit" && categoryId ? (
        <Card className="p-3">
          <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Search products in category"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
            />
            <Button
              variant="outlined"
              onClick={() => {
                setProductPage(1);
                void loadProducts(categoryId, 1, productQuery);
              }}
            >
              Search
            </Button>
          </Stack>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Brand</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="center">Top pick</TableCell>
                <TableCell align="right">Priority</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {productsLoading ? (
                <TableRow>
                  <TableCell colSpan={5}>Loading...</TableCell>
                </TableRow>
              ) : sortedCategoryProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>No products in this category.</TableCell>
                </TableRow>
              ) : (
                sortedCategoryProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>{product.brand ?? "-"}</TableCell>
                    <TableCell align="right">{product.price}</TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant={product.highlighted ? "contained" : "outlined"}
                        color="info"
                        onClick={() =>
                          void updateTopPick(product, !product.highlighted, product.priority ?? 100)
                        }
                      >
                        {product.highlighted ? "Top pick" : "Set Top pick"}
                      </Button>
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={product.priority ?? 100}
                        disabled={!product.highlighted}
                        onChange={(e) =>
                          setProducts((prev) =>
                            prev.map((row) =>
                              row.id === product.id
                                ? { ...row, priority: Number(e.target.value || 0) }
                                : row
                            )
                          )
                        }
                        onBlur={(e) => {
                          if (!product.highlighted) return;
                          void updateTopPick(product, true, Number(e.target.value || 0));
                        }}
                        sx={{ width: 110 }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      <Dialog
        open={valueAliasDialog.open}
        onClose={() => setValueAliasDialog((d) => ({ ...d, open: false }))}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Vrijednosti: {valueAliasDialog.attributeName}{" "}
          <Typography component="span" fontFamily="monospace" variant="body2">
            ({valueAliasDialog.attributeSlug})
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Ručno mapiranje: alias (od dobavljača) → normalizovano (u filteru). Nema automatske normalizacije.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                fullWidth
                size="small"
                label="Alias (od dobavljača)"
                placeholder="SATA III"
                value={newValueAlias.alias}
                onChange={(e) => setNewValueAlias((p) => ({ ...p, alias: e.target.value }))}
              />
              <TextField
                fullWidth
                size="small"
                label="Normalizovano (filter)"
                placeholder="SATA 3"
                value={newValueAlias.canonicalLabel}
                onChange={(e) => setNewValueAlias((p) => ({ ...p, canonicalLabel: e.target.value }))}
              />
              <Button
                variant="contained"
                disabled={valueAliasBusy}
                onClick={() => void handleAddValueAlias()}
                sx={{ minWidth: 100, alignSelf: { sm: "center" } }}
              >
                Dodaj
              </Button>
            </Stack>

            {valueAliasLoading ? (
              <CircularProgress size={24} />
            ) : valueAliasGroups.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nema ručnih mapa za ovaj atribut.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Normalizovano</TableCell>
                    <TableCell>Alias</TableCell>
                    <TableCell align="right">Proizvoda</TableCell>
                    <TableCell align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {valueAliasGroups.map((group) =>
                    group.aliases.map((row, idx) => (
                      <TableRow key={row.id}>
                        <TableCell>{idx === 0 ? group.canonicalLabel : ""}</TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {row.alias}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{idx === 0 ? group.productCount : ""}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={valueAliasBusy}
                            onClick={() => void handleDeleteValueAlias(row.id)}
                          >
                            Obriši
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}

            {valueAliasCatalog.length > 0 ? (
              <>
                <Divider />
                <Typography variant="subtitle2">Vrijednosti u katalogu (ova kategorija)</Typography>
                <Typography variant="caption" color="text.secondary">
                  Informativno — klikni „Mapiraj” da popuniš formu iznad. Vrijednosti bez mape ostaju u filteru
                  nepromijenjene.
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Vrijednost</TableCell>
                      <TableCell align="right">Proizvoda</TableCell>
                      <TableCell>Mapirano na</TableCell>
                      <TableCell align="right" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {valueAliasCatalog.map((row) => (
                      <TableRow key={row.value}>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {row.value}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">{row.productCount}</TableCell>
                        <TableCell>{row.mappedTo ?? "—"}</TableCell>
                        <TableCell align="right">
                          {!row.mappedTo ? (
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => handleMapCatalogValue(row.value, row.value)}
                            >
                              Mapiraj
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setValueAliasDialog((d) => ({ ...d, open: false }))}>Zatvori</Button>
          <Button
            variant="outlined"
            disabled={valueAliasApplyBusy || valueAliasGroups.length === 0}
            onClick={() => void handleApplyValueAliases()}
          >
            {valueAliasApplyBusy ? <CircularProgress size={16} /> : "Primijeni mape na postojeće"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={enrichmentDialogOpen}
        onClose={() => !enrichmentRunBusy && setEnrichmentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Pokreni enrichment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enrichment puni atribute iz već sačuvanih snapshotova dobavljača (bez novog skrejpa) za proizvode u ovoj
            kategoriji.
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={enrichmentOverwrite}
                onChange={(e) => setEnrichmentOverwrite(e.target.checked)}
                disabled={enrichmentRunBusy}
              />
            }
            label="Prepiši postojeće atribute"
          />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4, mt: -0.5 }}>
            Standardno: popunjava samo atribute koji još nemaju vrijednost. S ovom opcijom ponovo čita spec i primjenjuje
            alias + unit normalizaciju (npr. 5pcs → 5 kom). Ručne vrijednosti u products.attributes JSON i dalje se ne
            diraju.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button disabled={enrichmentRunBusy} onClick={() => setEnrichmentDialogOpen(false)}>
            Otkaži
          </Button>
          <Button
            variant="contained"
            color="secondary"
            disabled={enrichmentRunBusy}
            onClick={() => void runCategoryEnrichment(enrichmentOverwrite)}
          >
            {enrichmentRunBusy ? <CircularProgress size={16} color="inherit" /> : "Pokreni"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={mappingDialog.open} onClose={() => setMappingDialog((d) => ({ ...d, open: false }))} maxWidth="sm" fullWidth>
        <DialogTitle>
          {mappingDialog.mappingId ? "Uredi mapping" : "Novi mapping"}:{" "}
          <Typography component="span" fontFamily="monospace">
            {mappingDialog.fieldName}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Interni atribut (ova kategorija)"
              value={mappingDialog.attributeId}
              onChange={(e) => setMappingDialog((d) => ({ ...d, attributeId: e.target.value }))}
            >
              <MenuItem value="">— odaberi —</MenuItem>
              {mappingAttributeChoices.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.name} ({a.slug})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              fullWidth
              size="small"
              label="Match mode"
              value={mappingDialog.matchMode}
              onChange={(e) =>
                setMappingDialog((d) => ({ ...d, matchMode: e.target.value as "exact" | "contains" | "regex" }))
              }
            >
              <MenuItem value="exact">exact</MenuItem>
              <MenuItem value="contains">contains</MenuItem>
              <MenuItem value="regex">regex</MenuItem>
            </TextField>
            <TextField
              fullWidth
              size="small"
              type="number"
              label="Priority (manji = viši prioritet)"
              value={mappingDialog.priority}
              onChange={(e) => setMappingDialog((d) => ({ ...d, priority: Number(e.target.value) }))}
              inputProps={{ min: 1, step: 1 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMappingDialog((d) => ({ ...d, open: false }))}>Otkaži</Button>
          <Button
            variant="contained"
            disabled={mappingBusy || !mappingDialog.attributeId}
            onClick={() => void handleSaveMapping()}
          >
            Sačuvaj
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
