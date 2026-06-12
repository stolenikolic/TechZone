"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DropZone from "components/DropZone";
import { currency } from "lib";
import PageWrapper from "../../page-wrapper";

type EditPayload = {
  product: {
    id: string;
    name: string;
    slug: string;
    description: string;
    brand: string;
    categoryId: string | null;
    category: {
      id: string;
      name: string;
      slug: string;
      parentId: string | null;
      sellingMarginDefault: number | null;
    } | null;
    mainImage: string;
    price: number | null;
    customPrice: number | null;
    isActive: boolean;
    mpn: string;
    ean: string;
    sellingMarginOverride: number | null;
    aiMetaDescription: string;
    aiTitleSuggestion: string;
    aiOgDescription: string;
    aiDescriptionStatus: string;
    aiDescriptionLocked: boolean;
    aiDescriptionGeneratedAt: string | null;
  };
  categories: {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
    sellingMarginDefault: number | null;
  }[];
  images: string[];
  categoryAttributes: { slug: string; name: string }[];
  categoryAttributeMap: Record<string, { slug: string; name: string }[]>;
  attributes: { slug: string; value: string }[];
  pricingPreview: {
    minAcquisitionKm: number;
    multiplier: number;
    projectedSellingKm: number;
    source: "product_override" | "category_default" | "tier_or_global";
  } | null;
  linkedOffers: {
    id: string;
    supplierProductId: string;
    supplierName: string;
    supplierCode: string;
    priceAmountHuf: number | null;
    currency: string;
    acquisitionKm: number | null;
    updatedAt: string;
  }[];
};

type Notice = { severity: "success" | "error"; text: string } | null;

function normalizeField(value: string): string {
  return value.trim();
}

export default function EditProductPageView() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [payload, setPayload] = useState<EditPayload | null>(null);

  const [basic, setBasic] = useState({
    name: "",
    brand: "",
    description: "",
    mpn: "",
    ean: "",
    isActive: true,
    customPrice: ""
  });
  const [pricing, setPricing] = useState({
    price: "",
    sellingMarginOverride: ""
  });
  const [parentCategoryId, setParentCategoryId] = useState("none");
  const [childCategoryId, setChildCategoryId] = useState("none");
  const [mainImage, setMainImage] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [attributesText, setAttributesText] = useState("{}");
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [aiDescriptionLocked, setAiDescriptionLocked] = useState(false);
  const [aiDescriptionStatus, setAiDescriptionStatus] = useState("pending");
  const [initialDescription, setInitialDescription] = useState("");

  const roots = useMemo(
    () => (payload?.categories ?? []).filter((item) => item.parentId == null),
    [payload?.categories]
  );
  const children = useMemo(
    () =>
      (payload?.categories ?? []).filter((item) => item.parentId === (parentCategoryId === "none" ? "" : parentCategoryId)),
    [payload?.categories, parentCategoryId]
  );
  const selectedChild = useMemo(
    () => payload?.categories.find((item) => item.id === childCategoryId) ?? null,
    [payload?.categories, childCategoryId]
  );
  const effectiveCategoryAttributes = useMemo(
    () => (payload?.categoryAttributeMap?.[childCategoryId] ?? []),
    [payload?.categoryAttributeMap, childCategoryId]
  );

  const mergeAttributeTemplate = (rawJson: string, categoryAttrSlugs: string[]) => {
    let current: Record<string, unknown> = {};
    try {
      current = JSON.parse(rawJson) as Record<string, unknown>;
      if (!current || typeof current !== "object" || Array.isArray(current)) current = {};
    } catch {
      current = {};
    }
    const out: Record<string, string> = {};
    for (const slug of categoryAttrSlugs) {
      const value = current[slug];
      if (value == null) out[slug] = "";
      else out[slug] = String(value);
    }
    return JSON.stringify(out, null, 2);
  };

  const load = async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/products/by-slug/${encodeURIComponent(slug)}`, {
        cache: "no-store"
      });
      const data = (await response.json()) as EditPayload | { error: string };
      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Failed to load product.");
      }
      setPayload(data);
      setBasic({
        name: data.product.name,
        brand: data.product.brand,
        description: data.product.description,
        mpn: data.product.mpn,
        ean: data.product.ean,
        isActive: data.product.isActive,
        customPrice:
          data.product.customPrice != null && Number.isFinite(data.product.customPrice)
            ? String(data.product.customPrice)
            : ""
      });
      setInitialDescription(data.product.description ?? "");
      setAiDescriptionLocked(Boolean(data.product.aiDescriptionLocked));
      setAiDescriptionStatus(data.product.aiDescriptionStatus ?? "pending");
      setPricing({
        price: data.product.price != null && Number.isFinite(data.product.price) ? String(data.product.price) : "",
        sellingMarginOverride:
          data.product.sellingMarginOverride != null && Number.isFinite(data.product.sellingMarginOverride)
            ? String(data.product.sellingMarginOverride)
            : ""
      });
      const loadedCategoryId = data.product.categoryId ?? "none";
      const loadedCategory = (data.categories ?? []).find((item) => item.id === loadedCategoryId) ?? null;
      const loadedParentId = loadedCategory?.parentId ?? "none";
      setParentCategoryId(loadedParentId);
      setChildCategoryId(loadedCategoryId);
      setMainImage(data.product.mainImage ?? "");
      setImageUrls(data.images ?? []);
      const initialAttributes = JSON.stringify(
        Object.fromEntries((data.attributes ?? []).map((item) => [item.slug, item.value])),
        null,
        2
      );
      const initialTemplate = mergeAttributeTemplate(
        initialAttributes,
        (data.categoryAttributeMap?.[loadedCategoryId] ?? []).map((item) => item.slug)
      );
      setAttributesText(initialTemplate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load product.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (!payload) return;
    if (childCategoryId === "none") return;
    setAttributesText((prev) =>
      mergeAttributeTemplate(
        prev,
        (payload.categoryAttributeMap?.[childCategoryId] ?? []).map((item) => item.slug)
      )
    );
  }, [payload, childCategoryId]);

  const patch = async (body: Record<string, unknown>, successMessage: string) => {
    setNotice(null);
    const response = await fetch(`/api/admin/products/by-slug/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = (await response.json()) as { success?: boolean; error?: string };
    if (!response.ok || data.error) throw new Error(data.error ?? "Save failed.");
    setNotice({ severity: "success", text: successMessage });
    await load();
  };

  const normalizedImageUrls = useMemo(
    () => imageUrls.map((item) => item.trim()).filter(Boolean),
    [imageUrls]
  );

  const canSaveCategory = parentCategoryId !== "none" && childCategoryId !== "none";

  const isDirty = useMemo(() => {
    if (!payload) return false;
    const normalize = (value: string) => value.trim();
    const payloadImages = payload.images.join("\n");
    const localImages = normalizedImageUrls.join("\n");
    const payloadAttrs = JSON.stringify(
      Object.fromEntries((payload.attributes ?? []).map((item) => [item.slug, item.value])),
      null,
      2
    );
    const localCategoryId = childCategoryId === "none" ? null : childCategoryId;
    return (
      normalize(basic.name) !== normalize(payload.product.name) ||
      normalize(basic.brand) !== normalize(payload.product.brand ?? "") ||
      normalize(basic.description) !== normalize(payload.product.description ?? "") ||
      normalize(basic.mpn) !== normalize(payload.product.mpn ?? "") ||
      normalize(basic.ean) !== normalize(payload.product.ean ?? "") ||
      basic.isActive !== payload.product.isActive ||
      normalize(basic.customPrice) !==
        (payload.product.customPrice != null && Number.isFinite(payload.product.customPrice)
          ? String(payload.product.customPrice)
          : "") ||
      normalize(pricing.price) !==
        (payload.product.price != null && Number.isFinite(payload.product.price)
          ? String(payload.product.price)
          : "") ||
      normalize(pricing.sellingMarginOverride) !==
        (payload.product.sellingMarginOverride != null && Number.isFinite(payload.product.sellingMarginOverride)
          ? String(payload.product.sellingMarginOverride)
          : "") ||
      localCategoryId !== payload.product.categoryId ||
      normalize(mainImage) !== normalize(payload.product.mainImage ?? "") ||
      payloadImages !== localImages ||
      normalize(attributesText) !== normalize(payloadAttrs)
    );
  }, [payload, basic, pricing, childCategoryId, mainImage, normalizedImageUrls, attributesText]);

  const regenerateDescription = async () => {
    if (!slug) return;
    setRegenerating(true);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/admin/products/by-slug/${encodeURIComponent(slug)}/regenerate-description`,
        { method: "POST" }
      );
      const data = (await response.json()) as { success?: boolean; error?: string; message?: string };
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? data.error ?? "Regeneracija nije uspjela.");
      }
      setNotice({ severity: "success", text: "AI opis je regenerisan." });
      await load();
    } catch (err) {
      setNotice({
        severity: "error",
        text: err instanceof Error ? err.message : "Regeneracija nije uspjela."
      });
    } finally {
      setRegenerating(false);
    }
  };

  const saveAll = async () => {
    if (!canSaveCategory) {
      setNotice({ severity: "error", text: "Parent i child category su obavezni." });
      return;
    }
    let parsedAttributes: Record<string, unknown>;
    try {
      parsedAttributes = JSON.parse(attributesText) as Record<string, unknown>;
      if (!parsedAttributes || typeof parsedAttributes !== "object" || Array.isArray(parsedAttributes)) {
        throw new Error("Attributes JSON must be an object.");
      }
    } catch {
      setNotice({ severity: "error", text: "Attributes JSON is invalid." });
      return;
    }

    setSaving(true);
    try {
      await patch(
        {
          basic: {
            name: basic.name,
            brand: basic.brand || null,
            description: basic.description || null,
            markDescriptionManual:
              normalizeField(basic.description) !== normalizeField(initialDescription) &&
              Boolean(basic.description?.trim()),
            aiDescriptionLocked: aiDescriptionLocked,
            mpn: basic.mpn || null,
            ean: basic.ean || null,
            isActive: basic.isActive,
            customPrice: basic.customPrice.trim() === "" ? null : Number(basic.customPrice)
          },
          pricing: {
            price: pricing.price.trim() === "" ? null : Number(pricing.price),
            sellingMarginOverride:
              pricing.sellingMarginOverride.trim() === "" ? null : Number(pricing.sellingMarginOverride)
          },
          categoryId: childCategoryId,
          attributes: parsedAttributes,
          images: { mainImage: mainImage || null, imageUrls: normalizedImageUrls }
        },
        "All changes saved."
      );
    } catch (err) {
      setNotice({ severity: "error", text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  const uploadProductImageFile = async (file: File) => {
    const productSlug = payload?.product.slug;
    if (!productSlug) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(
        `/api/admin/products/by-slug/${encodeURIComponent(productSlug)}/images`,
        { method: "POST", body: formData }
      );
      const data = (await response.json()) as { imageUrl?: string; error?: string };
      if (!response.ok || data.error) throw new Error(data.error ?? "Image upload failed.");
      if (!data.imageUrl) throw new Error("Image upload did not return a URL.");
      setImageUrls((prev) => (prev.includes(data.imageUrl!) ? prev : [...prev, data.imageUrl!]));
      if (!mainImage.trim()) setMainImage(data.imageUrl);
    } catch (err) {
      setNotice({
        severity: "error",
        text: err instanceof Error ? err.message : "Image upload failed."
      });
    } finally {
      setImageUploading(false);
    }
  };

  const handleImageDropZone = (incoming: File[]) => {
    void (async () => {
      for (const file of incoming) {
        await uploadProductImageFile(file);
      }
    })();
  };

  const addImage = () => {
    const trimmed = newImageUrl.trim();
    if (!trimmed) return;
    setImageUrls((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setNewImageUrl("");
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= imageUrls.length) return;
    setImageUrls((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[nextIndex];
      copy[nextIndex] = temp;
      return copy;
    });
  };

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <PageWrapper title="Edit Product">
        <Typography>Loading...</Typography>
      </PageWrapper>
    );
  }

  if (error || !payload) {
    return (
      <PageWrapper title="Edit Product">
        <Alert severity="error">{error ?? "Product not found."}</Alert>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title={`Edit Product: ${payload.product.name}`}
      actions={
        <>
          <Button variant="outlined" onClick={() => void load()} disabled={saving}>
            Reset
          </Button>
          <Button variant="contained" onClick={() => void saveAll()} disabled={!isDirty || saving}>
            {saving ? "Saving..." : "Save All"}
          </Button>
        </>
      }
    >
      <Stack spacing={2}>
        {notice ? <Alert severity={notice.severity}>{notice.text}</Alert> : null}

        <Card sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Overview
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ md: 6, xs: 12 }}>
              <TextField
                fullWidth
                label="Name"
                value={basic.name}
                onChange={(e) => setBasic((prev) => ({ ...prev, name: e.target.value }))}
              />
            </Grid>
            <Grid size={{ md: 6, xs: 12 }}>
              <TextField
                fullWidth
                label="Brand"
                value={basic.brand}
                onChange={(e) => setBasic((prev) => ({ ...prev, brand: e.target.value }))}
              />
            </Grid>
            <Grid size={{ md: 6, xs: 12 }}>
              <TextField
                fullWidth
                label="MPN"
                value={basic.mpn}
                onChange={(e) => setBasic((prev) => ({ ...prev, mpn: e.target.value }))}
              />
            </Grid>
            <Grid size={{ md: 6, xs: 12 }}>
              <TextField
                fullWidth
                label="EAN"
                value={basic.ean}
                onChange={(e) => setBasic((prev) => ({ ...prev, ean: e.target.value }))}
              />
            </Grid>
            <Grid size={{ md: 8, xs: 12 }}>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip size="small" label={`AI status: ${aiDescriptionStatus}`} />
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={regenerating}
                    onClick={() => void regenerateDescription()}
                  >
                    {regenerating ? "Generišem…" : "Regeneriši opis"}
                  </Button>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={aiDescriptionLocked}
                        onChange={(e) => setAiDescriptionLocked(e.target.checked)}
                      />
                    }
                    label="Zaključaj opis (AI ne dira)"
                  />
                </Stack>
                <TextField
                  fullWidth
                  multiline
                  minRows={6}
                  label="Description (HTML dozvoljen)"
                  value={basic.description}
                  onChange={(e) => setBasic((prev) => ({ ...prev, description: e.target.value }))}
                />
                {payload?.product.aiTitleSuggestion ? (
                  <Typography variant="caption" color="text.secondary">
                    Predlog SEO naslova: {payload.product.aiTitleSuggestion}
                  </Typography>
                ) : null}
              </Stack>
            </Grid>
            <Grid size={{ md: 4, xs: 12 }}>
              <TextField
                fullWidth
                select
                label="Published"
                value={basic.isActive ? "1" : "0"}
                onChange={(e) => setBasic((prev) => ({ ...prev, isActive: e.target.value === "1" }))}
              >
                <MenuItem value="1">published</MenuItem>
                <MenuItem value="0">unpublished</MenuItem>
              </TextField>
              <TextField
                sx={{ mt: 2 }}
                fullWidth
                type="number"
                label="Add custom price"
                value={basic.customPrice}
                onChange={(e) => setBasic((prev) => ({ ...prev, customPrice: e.target.value }))}
              />
            </Grid>
          </Grid>
        </Card>

        <Card sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Category & Attributes
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ md: 6, xs: 12 }}>
              <TextField
                fullWidth
                select
                label="Parent Category"
                value={parentCategoryId}
                onChange={(e) => {
                  const parentId = e.target.value;
                  setParentCategoryId(parentId);
                  setChildCategoryId("none");
                }}
              >
                <MenuItem value="none">Select parent</MenuItem>
                {roots.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ md: 6, xs: 12 }}>
              <TextField
                fullWidth
                select
                label="Child Category"
                value={childCategoryId}
                disabled={parentCategoryId === "none"}
                onChange={(e) => setChildCategoryId(e.target.value)}
              >
                <MenuItem value="none">Select child (required)</MenuItem>
                {children.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            Allowed attributes: {effectiveCategoryAttributes.map((a) => a.slug).join(", ") || "-"}
          </Typography>
          <TextField
            sx={{ mt: 2 }}
            fullWidth
            multiline
            minRows={8}
            label="Attributes JSON"
            value={attributesText}
            onChange={(e) => setAttributesText(e.target.value)}
          />
        </Card>

        <Card sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Images
          </Typography>
          <TextField
            fullWidth
            label="Main Image URL"
            value={mainImage}
            onChange={(e) => setMainImage(e.target.value)}
            helperText="External URLs are converted to WebP in Storage when you save. Upload below for immediate WebP."
          />
          <Box sx={{ mt: 2 }}>
            <DropZone onChange={handleImageDropZone} />
            {imageUploading ? (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                Uploading and optimizing image…
              </Typography>
            ) : null}
          </Box>
          <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Add image URL"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
            />
            <Button variant="outlined" onClick={addImage}>
              Add
            </Button>
          </Stack>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {imageUrls.map((url, index) => (
              <Grid key={`${url}-${index}`} size={{ md: 4, xs: 12 }}>
                <Card variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar variant="rounded" src={url} sx={{ width: 72, height: 72 }} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="caption" sx={{ wordBreak: "break-all" }}>
                        {url}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button size="small" onClick={() => moveImage(index, -1)} disabled={index === 0}>
                      Up
                    </Button>
                    <Button
                      size="small"
                      onClick={() => moveImage(index, 1)}
                      disabled={index === imageUrls.length - 1}
                    >
                      Down
                    </Button>
                    <Button size="small" onClick={() => setMainImage(url)}>
                      Set Main
                    </Button>
                    <Button size="small" color="error" onClick={() => removeImage(index)}>
                      Remove
                    </Button>
                  </Stack>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
            <Button variant="outlined" onClick={() => setImageUrls(payload.images)}>
              Reset
            </Button>
          </Stack>
        </Card>

        <Card sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Pricing
          </Typography>
          <Stack spacing={1}>
            <Typography variant="body2">
              Current price: {payload.product.price != null ? currency(payload.product.price) : "-"}
            </Typography>
            <Typography variant="body2">
              Category default margin:{" "}
              {selectedChild?.sellingMarginDefault != null ? selectedChild.sellingMarginDefault : "-"}
            </Typography>
            {payload.pricingPreview ? (
              <Typography variant="body2">
                Preview: nabavna {currency(payload.pricingPreview.minAcquisitionKm)} x m=
                {payload.pricingPreview.multiplier}
                {" => "}
                {currency(payload.pricingPreview.projectedSellingKm)} ({payload.pricingPreview.source})
              </Typography>
            ) : (
              <Typography variant="body2">No pricing preview (no linked offers or missing inputs).</Typography>
            )}
          </Stack>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ md: 4, xs: 12 }}>
              <TextField
                fullWidth
                type="number"
                label="Manual Price Override"
                value={pricing.price}
                onChange={(e) => setPricing((prev) => ({ ...prev, price: e.target.value }))}
              />
            </Grid>
            <Grid size={{ md: 4, xs: 12 }}>
              <TextField
                fullWidth
                type="number"
                label="Selling Margin Override"
                value={pricing.sellingMarginOverride}
                onChange={(e) => setPricing((prev) => ({ ...prev, sellingMarginOverride: e.target.value }))}
              />
            </Grid>
            <Grid size={{ md: 4, xs: 12 }} />
          </Grid>
        </Card>

        <Card sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Linked Supplier Offers
          </Typography>
          {payload.linkedOffers.length === 0 ? (
            <Typography>No linked offers.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Supplier</TableCell>
                  <TableCell>Supplier Product ID</TableCell>
                  <TableCell align="right">HUF</TableCell>
                  <TableCell align="right">Nabavna (KM)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payload.linkedOffers.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.supplierName}
                      <Typography variant="caption" display="block" color="text.secondary">
                        {row.supplierCode}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.supplierProductId}</TableCell>
                    <TableCell align="right">{row.priceAmountHuf != null ? `${Math.round(row.priceAmountHuf)} HUF` : "-"}</TableCell>
                    <TableCell align="right">{row.acquisitionKm != null ? currency(row.acquisitionKm) : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <Box sx={{ mt: 2 }}>
            <Button variant="outlined" onClick={() => void load()}>
              Refresh offers
            </Button>
          </Box>
        </Card>
      </Stack>
    </PageWrapper>
  );
}
