"use client";

import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import DropZone from "components/DropZone";
import FlexBox from "components/flex-box/flex-box";
import { homepageImageDisplayUrl } from "lib/homepage/image-display-url";
import { rowToDbBlock } from "lib/homepage/map-blocks";
import type { DbHomepageBlock } from "lib/homepage/types";
import type { HomepageZone } from "lib/homepage/zones";
import { HOMEPAGE_ZONE_LIMITS } from "lib/homepage/zones";
import { PreviewFile } from "models/Common";
import { UploadImageBox, StyledClear } from "../styles";

type Props = {
  zone: HomepageZone;
  title: string;
  description: string;
};

type ContentFields = Record<string, string>;

function contentToFields(block: DbHomepageBlock): ContentFields {
  const c = block.content as Record<string, string>;
  if (block.zone === "hero_carousel") {
    return {
      title: c.title ?? "",
      categoryLabel: c.categoryLabel ?? "",
      description: c.description ?? "",
      buttonLink: c.buttonLink ?? "",
      buttonLabel: c.buttonLabel ?? ""
    };
  }
  if (block.zone === "hero_side") {
    return {
      tag: c.tag ?? "",
      title: c.title ?? "",
      linkUrl: c.linkUrl ?? "",
      buttonLabel: c.buttonLabel ?? ""
    };
  }
  return {
    title: c.title ?? "",
    description: c.description ?? "",
    buttonLink: c.buttonLink ?? "",
    buttonLabel: c.buttonLabel ?? ""
  };
}

function fieldsToContent(zone: HomepageZone, fields: ContentFields): Record<string, string> {
  if (zone === "hero_carousel") {
    return {
      title: fields.title,
      categoryLabel: fields.categoryLabel,
      description: fields.description,
      buttonLink: fields.buttonLink,
      buttonLabel: fields.buttonLabel
    };
  }
  if (zone === "hero_side") {
    return {
      tag: fields.tag,
      title: fields.title,
      linkUrl: fields.linkUrl,
      buttonLabel: fields.buttonLabel
    };
  }
  return {
    title: fields.title,
    description: fields.description,
    buttonLink: fields.buttonLink,
    buttonLabel: fields.buttonLabel
  };
}

async function adminFetch(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, cache: "no-store" });
}

const DEFAULT_FIELDS: Record<HomepageZone, ContentFields> = {
  hero_carousel: {
    title: "",
    categoryLabel: "",
    description: "",
    buttonLink: "/products",
    buttonLabel: "EXPLORE NOW"
  },
  hero_side: {
    tag: "",
    title: "",
    linkUrl: "/",
    buttonLabel: "EXPLORE NOW"
  },
  promo: {
    title: "",
    description: "",
    buttonLink: "/products/search",
    buttonLabel: "Shop Now"
  }
};

export default function ZoneBlockEditor({ zone, title, description }: Props) {
  const [blocks, setBlocks] = useState<DbHomepageBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const limit = HOMEPAGE_ZONE_LIMITS[zone];

  const load = useCallback(async () => {
    setError(null);
    const res = await adminFetch(`/api/admin/homepage/blocks?zone=${encodeURIComponent(zone)}`);
    const data = (await res.json()) as { blocks?: DbHomepageBlock[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Load failed.");
    setBlocks(data.blocks ?? []);
  }, [zone]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const canAdd = limit == null || blocks.length < limit;

  return (
    <Stack spacing={2}>
      <div>
        <Typography variant="h5" fontWeight={600}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
          {limit != null ? ` (max ${limit} blocks)` : ""}
        </Typography>
      </div>

      {error ? (
        <Typography color="error">{error}</Typography>
      ) : null}
      {notice ? (
        <Typography color="info.main">{notice}</Typography>
      ) : null}

      {loading ? (
        <Typography>Loading...</Typography>
      ) : (
        blocks.map((block, index) => (
          <BlockCard
            key={block.id}
            block={block}
            zone={zone}
            sortOrder={index}
            onSaved={async (updated) => {
              setNotice("Saved.");
              if (updated) {
                setBlocks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
              } else {
                await load();
              }
            }}
            onDeleted={async () => {
              setNotice("Deleted.");
              await load();
            }}
            onError={(msg) => setError(msg)}
          />
        ))
      )}

      <Button
        variant="outlined"
        color="info"
        disabled={!canAdd}
        onClick={() => void addBlock()}
      >
        Add block
      </Button>
    </Stack>
  );

  async function addBlock() {
    setError(null);
    setNotice(null);
    try {
      const res = await adminFetch("/api/admin/homepage/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone,
          sortOrder: blocks.length,
          isActive: true,
          content: fieldsToContent(zone, DEFAULT_FIELDS[zone])
        })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Create failed.");
      setNotice("Block created. Add image and text, then save.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
}

function BlockCard({
  block,
  zone,
  sortOrder,
  onSaved,
  onDeleted,
  onError
}: {
  block: DbHomepageBlock;
  zone: HomepageZone;
  sortOrder: number;
  onSaved: (updated?: DbHomepageBlock) => Promise<void>;
  onDeleted: () => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [fields, setFields] = useState<ContentFields>(() => contentToFields(block));
  const [imageUrl, setImageUrl] = useState(block.image_url ?? "");
  const [isActive, setIsActive] = useState(block.is_active);
  const [files, setFiles] = useState<PreviewFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);

  useEffect(() => {
    setFields(contentToFields(block));
    setImageUrl(block.image_url ?? "");
    setIsActive(block.is_active);
  }, [block]);

  const setField = (key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleChangeDropZone = (incoming: File[]) => {
    incoming.forEach((file) => Object.assign(file, { preview: URL.createObjectURL(file) }));
    setFiles(incoming as PreviewFile[]);
  };

  const handleFileDelete = (file: File) => () => {
    setFiles((state) => state.filter((item) => item.name !== file.name));
  };

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.set("file", file);
    const res = await adminFetch(`/api/admin/homepage/blocks/${block.id}/image`, {
      method: "POST",
      body: formData
    });
    const data = (await res.json()) as { imageUrl?: string; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Image upload failed.");
    if (data.imageUrl) {
      setImageUrl(data.imageUrl);
      setPreviewNonce((value) => value + 1);
    }
  };

  const save = async () => {
    setSaving(true);
    onError(null);
    try {
      if (files[0]) {
        await uploadImage(files[0]);
        setFiles([]);
      }

      const res = await adminFetch(`/api/admin/homepage/blocks/${block.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sortOrder,
          isActive,
          imageUrl: imageUrl.trim() || null,
          content: fieldsToContent(zone, fields)
        })
      });
      const data = (await res.json()) as { block?: DbHomepageBlock; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      const updated = data.block ? rowToDbBlock(data.block) : undefined;
      setPreviewNonce((value) => value + 1);
      await onSaved(updated);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this block?")) return;
    setSaving(true);
    onError(null);
    try {
      const res = await adminFetch(`/api/admin/homepage/blocks/${block.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      await onDeleted();
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-3">
      <Stack spacing={2}>
        <FormControlLabel
          control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
          label="Active on homepage"
        />

        {zone === "hero_carousel" ? (
          <>
            <TextField label="Title" value={fields.title} onChange={(e) => setField("title", e.target.value)} />
            <TextField
              label="Category label"
              value={fields.categoryLabel}
              onChange={(e) => setField("categoryLabel", e.target.value)}
            />
            <TextField
              label="Description"
              multiline
              rows={3}
              value={fields.description}
              onChange={(e) => setField("description", e.target.value)}
            />
          </>
        ) : null}

        {zone === "hero_side" ? (
          <>
            <TextField label="Tag" value={fields.tag} onChange={(e) => setField("tag", e.target.value)} />
            <TextField label="Title" value={fields.title} onChange={(e) => setField("title", e.target.value)} />
          </>
        ) : null}

        {zone === "promo" ? (
          <>
            <TextField label="Title" value={fields.title} onChange={(e) => setField("title", e.target.value)} />
            <TextField
              label="Description"
              multiline
              rows={3}
              value={fields.description}
              onChange={(e) => setField("description", e.target.value)}
            />
          </>
        ) : null}

        <TextField
          label={zone === "hero_side" ? "Link URL" : "Button link"}
          value={zone === "hero_side" ? fields.linkUrl : fields.buttonLink}
          onChange={(e) =>
            setField(zone === "hero_side" ? "linkUrl" : "buttonLink", e.target.value)
          }
        />
        <TextField
          label="Button label"
          value={fields.buttonLabel}
          onChange={(e) => setField("buttonLabel", e.target.value)}
        />

        <TextField
          fullWidth
          label="Image URL"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          helperText="External URL is converted to WebP on save. Or upload a file below."
        />

        {imageUrl ? (
          <Box
            component="img"
            src={homepageImageDisplayUrl(imageUrl, `${block.updated_at}-${previewNonce}`)}
            alt="preview"
            sx={{ maxWidth: 320, maxHeight: 200, objectFit: "contain", borderRadius: 1 }}
          />
        ) : null}

        <DropZone onChange={handleChangeDropZone} />
        <FlexBox flexDirection="row" mt={1} flexWrap="wrap" gap={1}>
          {files.map((file, index) => (
            <UploadImageBox key={index}>
              <Box component="img" alt="upload" src={file.preview} width="100%" />
              <StyledClear onClick={handleFileDelete(file)} />
            </UploadImageBox>
          ))}
        </FlexBox>

        <Stack direction="row" spacing={1}>
          <Button variant="contained" color="info" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button variant="outlined" color="error" disabled={saving} onClick={() => void remove()}>
            Delete
          </Button>
        </Stack>
      </Stack>
    </Card>
  );
}
