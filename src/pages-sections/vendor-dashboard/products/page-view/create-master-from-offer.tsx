"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type {
  CreateMasterFromOfferPayload,
  CreateMasterFromOfferResponse,
  SupplierOfferCreateMasterData
} from "app/api/admin/supplier-products/[id]/route";
import PageWrapper from "../../page-wrapper";

type Props = SupplierOfferCreateMasterData;

type FormState = {
  name: string;
  slug: string;
  brand: string;
  description: string;
  categoryId: string;
  mainImage: string;
  imageUrlsText: string;
  mpn: string;
  ean: string;
  attributesJson: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function priceRefreshMessage(result: CreateMasterFromOfferResponse) {
  const refresh = result.priceRefresh;
  if (refresh?.error) return `Master product created, but price refresh failed: ${refresh.error}`;
  return `Master product created and linked. Prices refreshed: ${refresh?.updated ?? 0} products updated in ${refresh?.batches ?? 0} batch(es).`;
}

function parseAttributesJson(value: string) {
  const parsed = JSON.parse(value || "{}") as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Attributes must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function parseImageUrls(value: string) {
  const tokens = value
    .split(/[\n,]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
  return Array.from(new Set(tokens));
}

export default function CreateMasterFromOfferPageView({ offer, categories }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ severity: "success" | "error"; text: string; slug?: string } | null>(null);
  const [form, setForm] = useState<FormState>(() => ({
    name: offer.suggested.name,
    slug: slugify(offer.suggested.name),
    brand: offer.suggested.brand,
    description: offer.suggested.description,
    categoryId: "",
    mainImage: offer.suggested.mainImage,
    imageUrlsText: offer.suggested.mainImage ? offer.suggested.mainImage : "",
    mpn: offer.suggested.mpn,
    ean: offer.suggested.ean,
    attributesJson: JSON.stringify(offer.suggested.attributes ?? {}, null, 2)
  }));

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        label: category.parentId ? `${category.name} (${category.slug})` : category.name
      })),
    [categories]
  );

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    if (!form.categoryId) return;

    const selectedCategory = categoryOptions.find((category) => category.id === form.categoryId);
    if (!selectedCategory) return;

    try {
      const current = parseAttributesJson(form.attributesJson);
      const template = Object.fromEntries(
        (selectedCategory.attributeSlugs ?? []).map((slug) => [slug, ""])
      ) as Record<string, unknown>;
      const merged = { ...template, ...current };
      const next = JSON.stringify(merged, null, 2);
      if (next !== form.attributesJson) {
        setForm((previous) => ({ ...previous, attributesJson: next }));
      }
    } catch {
      // Keep user-entered JSON as-is if invalid until they fix it.
    }
  }, [form.categoryId, form.attributesJson, categoryOptions]);

  async function handleSubmit() {
    setMessage(null);
    let attributes: Record<string, unknown>;

    try {
      attributes = parseAttributesJson(form.attributesJson);
    } catch (err) {
      setMessage({
        severity: "error",
        text: err instanceof Error ? err.message : "Attributes JSON is invalid."
      });
      return;
    }

    const payload: CreateMasterFromOfferPayload = {
      name: form.name,
      slug: form.slug,
      brand: form.brand || null,
      description: form.description || null,
      categoryId: form.categoryId,
      mainImage: form.mainImage || null,
      imageUrls: parseImageUrls(form.imageUrlsText),
      mpn: form.mpn || null,
      ean: form.ean || null,
      attributes
    };

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/supplier-products/${offer.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as CreateMasterFromOfferResponse;

      if (!response.ok || result.error) {
        setMessage({ severity: "error", text: result.error ?? "Create master failed." });
        return;
      }

      setMessage({ severity: result.priceRefresh?.error ? "error" : "success", text: priceRefreshMessage(result), slug: result.slug });
      router.refresh();
    } catch (err) {
      setMessage({
        severity: "error",
        text: err instanceof Error ? err.message : "Create master failed."
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageWrapper title="Create Master from Offer">
      <Stack spacing={2}>
        {message ? (
          <Alert
            severity={message.severity}
            action={
              message.slug ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => router.push(`/admin/products/${message.slug}`)}
                >
                  View Product
                </Button>
              ) : undefined
            }
          >
            {message.text}
          </Alert>
        ) : null}

        <Card sx={{ p: 2 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ md: 8, xs: 12 }}>
              <Typography variant="body2" color="text.secondary">
                Supplier offer
              </Typography>
              <Typography variant="h6">
                {offer.supplier} / {offer.supplierProductId}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Price: {offer.priceAmount ?? "-"} {offer.currency || ""} | MPN: {offer.mpn ?? "-"} | EAN:{" "}
                {offer.ean ?? "-"}
              </Typography>
            </Grid>

            <Grid size={{ md: 4, xs: 12 }}>
              <Box display="flex" justifyContent={{ md: "flex-end", xs: "flex-start" }}>
                <Avatar variant="rounded" sx={{ width: 72, height: 72 }}>
                  {form.mainImage ? (
                    <Image fill src={form.mainImage} alt={form.name || "Product image"} sizes="72px" />
                  ) : null}
                </Avatar>
              </Box>
            </Grid>
          </Grid>
        </Card>

        <Card sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid size={{ md: 8, xs: 12 }}>
              <TextField
                fullWidth
                required
                color="info"
                label="Product Name"
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  updateField("name", name);
                  updateField("slug", slugify(name));
                }}
              />
            </Grid>

            <Grid size={{ md: 4, xs: 12 }}>
              <TextField
                fullWidth
                color="info"
                label="Slug"
                value={form.slug}
                onChange={(e) => updateField("slug", slugify(e.target.value))}
              />
            </Grid>

            <Grid size={{ md: 4, xs: 12 }}>
              <TextField
                fullWidth
                color="info"
                label="Brand"
                value={form.brand}
                onChange={(e) => updateField("brand", e.target.value)}
              />
            </Grid>

            <Grid size={{ md: 4, xs: 12 }}>
              <TextField
                select
                fullWidth
                required
                color="info"
                label="Category"
                value={form.categoryId}
                onChange={(e) => updateField("categoryId", e.target.value)}
              >
                {categoryOptions.map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {category.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid size={{ md: 4, xs: 12 }}>
              <TextField
                fullWidth
                color="info"
                label="Main Image URL"
                value={form.mainImage}
                onChange={(e) => updateField("mainImage", e.target.value)}
                helperText="Fallback URL if no processed image URL is provided below."
              />
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                color="info"
                label="Image URLs (one per line or comma-separated)"
                value={form.imageUrlsText}
                onChange={(e) => updateField("imageUrlsText", e.target.value)}
                helperText="These URLs go through download -> resize -> webp -> Supabase Storage pipeline."
              />
            </Grid>

            <Grid size={{ md: 6, xs: 12 }}>
              <TextField
                fullWidth
                color="info"
                label="MPN"
                value={form.mpn}
                onChange={(e) => updateField("mpn", e.target.value)}
              />
            </Grid>

            <Grid size={{ md: 6, xs: 12 }}>
              <TextField
                fullWidth
                color="info"
                label="EAN"
                value={form.ean}
                onChange={(e) => updateField("ean", e.target.value)}
              />
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                minRows={5}
                color="info"
                label="Description"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
              />
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                minRows={8}
                color="info"
                label="Attributes JSON"
                helperText="Template keys are auto-prepared from selected category; fill only values."
                value={form.attributesJson}
                onChange={(e) => updateField("attributesJson", e.target.value)}
              />
            </Grid>

            <Grid size={12}>
              <Stack direction={{ sm: "row", xs: "column" }} spacing={2}>
                <Button
                  color="info"
                  variant="contained"
                  disabled={submitting || !form.name.trim() || !form.categoryId}
                  onClick={handleSubmit}
                >
                  {submitting ? "Creating..." : "Create and Link"}
                </Button>

                <Button variant="outlined" onClick={() => router.push("/admin/products/supplier-offers")}>
                  Back to Supplier Offers
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Card>

        <Card sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Raw Supplier Data
          </Typography>
          <Box
            component="pre"
            sx={{ m: 0, p: 2, maxHeight: 420, overflow: "auto", bgcolor: "grey.100", borderRadius: 1, fontSize: 12 }}
          >
            {JSON.stringify(offer.rawJson ?? {}, null, 2)}
          </Box>
        </Card>
      </Stack>
    </PageWrapper>
  );
}
