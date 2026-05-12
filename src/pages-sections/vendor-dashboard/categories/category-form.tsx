"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
// MUI
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
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

  const [newAttribute, setNewAttribute] = useState({
    name: "",
    slug: "",
    displayType: "checkbox" as "checkbox" | "range",
    unit: "",
    step: "1"
  });

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
  }, [mode, categorySlug]);

  const saveCategory = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        parentId: parentId || null,
        imageUrl: imageUrl.trim() || null,
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
        setNotice("Category created.");
        router.push("/admin/categories");
        return;
      }

      if (!categoryId) throw new Error("Category not loaded.");
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

  const saveCategoryAttribute = async (row: CategoryAttributeRow) => {
    if (!categoryId) return;
    try {
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
      if (!response.ok || data.error) throw new Error(data.error ?? "Attribute save failed.");
      setNotice("Attribute updated.");
      await loadCategoryAttributes(slug.trim() || categorySlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Attribute save failed.");
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
                  onChange={(e) => setNewAttribute((prev) => ({ ...prev, name: e.target.value }))}
                />
              </Grid>
              <Grid size={{ md: 3, xs: 12 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Slug"
                  value={newAttribute.slug}
                  onChange={(e) => setNewAttribute((prev) => ({ ...prev, slug: e.target.value }))}
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
                <Button fullWidth variant="contained" onClick={() => void createCategoryAttribute()}>
                  Add
                </Button>
              </Grid>
            </Grid>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Order</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Slug</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Step</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categoryAttributes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>No category attributes.</TableCell>
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
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" variant="outlined" onClick={() => void saveCategoryAttribute(attribute)}>
                            Save
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            onClick={() => void detachCategoryAttribute(attribute.id)}
                          >
                            Detach
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Stack>
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
              ) : products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>No products in this category.</TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
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
    </Stack>
  );
}
