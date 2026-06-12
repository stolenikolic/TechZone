"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PageWrapper from "../../page-wrapper";

type ReviewItem = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  description: string | null;
  ai_meta_description: string | null;
  ai_title_suggestion: string | null;
  ai_description_status: string;
  ai_description_generated_at: string | null;
  categories: { name: string; slug: string } | { name: string; slug: string }[] | null;
};

export function AiDescriptionsReviewPageView() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/products/ai-descriptions?status=generated", {
        cache: "no-store"
      });
      const data = (await res.json()) as { items?: ReviewItem[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Učitavanje nije uspjelo.");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Učitavanje nije uspjelo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (productId: string) => {
    setNotice(null);
    const res = await fetch("/api/admin/products/ai-descriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, action: "approve" })
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Odobravanje nije uspjelo.");
      return;
    }
    setNotice("Opis odobren.");
    await load();
  };

  return (
    <PageWrapper title="AI opisi — pregled">
      <Stack spacing={2}>
        {error ? <Alert severity="error">{error}</Alert> : null}
        {notice ? <Alert severity="success">{notice}</Alert> : null}
        <Typography variant="body2" color="text.secondary">
          Pregledaj generisane opise prije objave. Nakon odobravanja status postaje{" "}
          <code>approved</code>.
        </Typography>
        {loading ? (
          <Typography>Učitavam…</Typography>
        ) : items.length === 0 ? (
          <Card className="p-3">
            <Typography>Nema opisa na čekanju (status: generated).</Typography>
          </Card>
        ) : (
          items.map((item) => {
            const category = Array.isArray(item.categories) ? item.categories[0] : item.categories;
            return (
              <Card key={item.id} className="p-3">
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <Typography variant="h6">{item.name}</Typography>
                    <Chip size="small" label={item.ai_description_status} />
                    {category ? <Chip size="small" variant="outlined" label={category.name} /> : null}
                  </Stack>
                  {item.ai_title_suggestion ? (
                    <Typography variant="body2">
                      <strong>SEO naslov:</strong> {item.ai_title_suggestion}
                    </Typography>
                  ) : null}
                  {item.ai_meta_description ? (
                    <Typography variant="body2">
                      <strong>Meta:</strong> {item.ai_meta_description}
                    </Typography>
                  ) : null}
                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      p: 2,
                      maxHeight: 280,
                      overflow: "auto"
                    }}
                    dangerouslySetInnerHTML={{ __html: item.description ?? "" }}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" onClick={() => void approve(item.id)}>
                      Odobri
                    </Button>
                    <Button component={Link} href={`/admin/products/${item.slug}`} variant="outlined">
                      Uredi proizvod
                    </Button>
                  </Stack>
                </Stack>
              </Card>
            );
          })
        )}
      </Stack>
    </PageWrapper>
  );
}
