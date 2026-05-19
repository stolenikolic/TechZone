"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

type SettingsState = Record<string, string>;

type TierRow = {
  id?: string;
  min_cost_km: string;
  max_cost_km: string;
  margin_multiplier: string;
  sort_order: string;
};

const LEGENDS: Record<string, string> = {
  kurs_eur: "Broj forinti za 1 EUR (dijeljenje HUF / kurs_eur u formuli nabavne).",
  eur_km_rate: "Množitelj iz EUR u KM u nabavnoj formuli.",
  alza_tax: "Dodatni faktor za mađarske izvore osim iPon (HUF formula * alza_tax * pdv_bih).",
  pdv_bih: "PDV / stopa uključena u nabavnu KM (npr. 1.17).",
  default_selling_margin: "Prodajni multiplier ako nema override na kategoriji/proizvodu i nijedan tier ne pokriva nabavnu cijenu.",
  min_absolute_profit_km: "Minimalna apsolutna zarada: prodajna >= nabavna + ovo.",
  min_margin_percent: "Minimalna relativna marža kao decimala (npr. 0.10 = 10%): prodajna >= nabavna * (1 + ovo).",
  high_cost_threshold_km: "Od koje nabavne (KM) vrijedi plafon marže za skupe artikle.",
  high_cost_max_margin_multiplier: "Maksimalni multiplier m kada je nabavna >= praga (npr. 1.06).",
  original_price_markup_percent:
    "Procenat iznad effective cijene za precrtanu (original) cijenu. Zaokružuje se na najbliži cijeli KM (npr. 10 = +10%)."
};

function numOrEmpty(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function AdminPricingPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsState>({});
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [categories, setCategories] = useState<
    { id: string; name: string; slug: string; selling_margin_default: number | null }[]
  >([]);
  const [suppliers, setSuppliers] = useState<
    { id: string; name: string; code: string; pricing_formula: string | null; cost_adjustment_multiplier: number }[]
  >([]);
  const [aggResult, setAggResult] = useState<string | null>(null);
  const [productMarginId, setProductMarginId] = useState("");
  const [productMarginVal, setProductMarginVal] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pricing", { cache: "no-store" });
      const json = (await res.json()) as {
        error?: string;
        settings: Record<string, unknown> | null;
        tiers: Record<string, unknown>[];
        categories: { id: string; name: string; slug: string; selling_margin_default: number | null }[];
        suppliers: {
          id: string;
          name: string;
          code: string;
          pricing_formula: string | null;
          cost_adjustment_multiplier: number;
        }[];
      };
      if (!res.ok) throw new Error(json.error ?? "Load failed");
      const s = json.settings ?? {};
      setSettings({
        kurs_eur: s.kurs_eur != null ? String(s.kurs_eur) : "",
        eur_km_rate: s.eur_km_rate != null ? String(s.eur_km_rate) : "",
        alza_tax: s.alza_tax != null ? String(s.alza_tax) : "",
        pdv_bih: s.pdv_bih != null ? String(s.pdv_bih) : "",
        default_selling_margin: s.default_selling_margin != null ? String(s.default_selling_margin) : "",
        min_absolute_profit_km: s.min_absolute_profit_km != null ? String(s.min_absolute_profit_km) : "",
        min_margin_percent: s.min_margin_percent != null ? String(s.min_margin_percent) : "",
        high_cost_threshold_km: s.high_cost_threshold_km != null ? String(s.high_cost_threshold_km) : "",
        high_cost_max_margin_multiplier:
          s.high_cost_max_margin_multiplier != null ? String(s.high_cost_max_margin_multiplier) : "",
        original_price_markup_percent:
          s.original_price_markup_percent != null ? String(s.original_price_markup_percent) : ""
      });
      setTiers(
        (json.tiers ?? []).map((t, i) => ({
          id: t.id as string | undefined,
          min_cost_km: String(t.min_cost_km ?? ""),
          max_cost_km: t.max_cost_km != null ? String(t.max_cost_km) : "",
          margin_multiplier: String(t.margin_multiplier ?? ""),
          sort_order: String(t.sort_order ?? i)
        }))
      );
      setCategories(json.categories ?? []);
      setSuppliers(json.suppliers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const settingsPayload = useMemo(() => {
    const out: Record<string, number | null> = {};
    for (const key of Object.keys(settings)) {
      const v = numOrEmpty(settings[key] ?? "");
      out[key] = v;
    }
    return out;
  }, [settings]);

  const saveAll = async () => {
    setSaveMsg(null);
    setError(null);
    try {
      const tierPayload = tiers.map((t, i) => ({
        min_cost_km: Number(t.min_cost_km),
        max_cost_km: t.max_cost_km.trim() === "" ? null : Number(t.max_cost_km),
        margin_multiplier: Number(t.margin_multiplier),
        sort_order: Number(t.sort_order) || i
      }));
      const res = await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: settingsPayload, tiers: tierPayload })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setSaveMsg("Sačuvano.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const runAggregate = async () => {
    setAggResult(null);
    try {
      const res = await fetch("/api/admin/aggregate-prices", { method: "POST" });
      const json = await res.json();
      setAggResult(JSON.stringify(json, null, 2));
    } catch (e) {
      setAggResult(e instanceof Error ? e.message : String(e));
    }
  };

  const patchCategoryMargin = async (id: string, raw: string) => {
    const v = raw.trim() === "" ? null : Number(raw);
    await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selling_margin_default: v })
    });
    await load();
  };

  const patchProductMargin = async () => {
    const id = productMarginId.trim();
    if (!id) return;
    const raw = productMarginVal.trim();
    const v = raw === "" ? null : Number(raw);
    if (v != null && (!Number.isFinite(v) || v <= 0)) {
      setError("Override mora biti prazan (null) ili pozitivan broj.");
      return;
    }
    await fetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selling_margin_override: v })
    });
    setProductMarginId("");
    setProductMarginVal("");
    await load();
  };

  const patchSupplier = async (id: string, formula: string, mult: string) => {
    await fetch(`/api/admin/suppliers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pricing_formula: formula === "" ? null : formula,
        cost_adjustment_multiplier: Number(mult)
      })
    });
    await load();
  };

  if (loading) {
    return (
      <Box p={3}>
        <Typography>Učitavanje…</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Typography variant="h5" gutterBottom>
        Pricing (nabavna / prodajna)
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Svi poslovni brojevi su u bazi. Popunite prazan red u <code>pricing_settings</code> prije prve agregacije. Env{" "}
        <code>PRICING_*</code> služi samo kao fallback za kurs / EUR / PDV dok DB polja budu prazna.
      </Typography>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      {saveMsg && (
        <Typography color="success.main" sx={{ mb: 2 }}>
          {saveMsg}
        </Typography>
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <Button variant="contained" onClick={() => void saveAll()}>
          Sačuvaj postavke i tierove
        </Button>
        <Button variant="outlined" onClick={() => void runAggregate()}>
          Pokreni aggregate cijena
        </Button>
        <Button variant="text" onClick={() => void load()}>
          Osvježi
        </Button>
      </Stack>

      {aggResult && (
        <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2">Rezultat aggregate</Typography>
          <Box component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
            {aggResult}
          </Box>
        </Card>
      )}

      <Card sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Globalne postavke
        </Typography>
        <Stack spacing={2}>
          {(
            [
              "kurs_eur",
              "eur_km_rate",
              "alza_tax",
              "pdv_bih",
              "default_selling_margin",
              "min_absolute_profit_km",
              "min_margin_percent",
              "high_cost_threshold_km",
              "high_cost_max_margin_multiplier",
              "original_price_markup_percent"
            ] as const
          ).map((key) => (
            <Box key={key}>
              <TextField
                label={key}
                fullWidth
                value={settings[key] ?? ""}
                onChange={(e) => setSettings((prev) => ({ ...prev, [key]: e.target.value }))}
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                {LEGENDS[key] ?? ""}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Card>

      <Card sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6">Margin tierovi (nema category/product override)</Typography>
          <Button
            size="small"
            onClick={() =>
              setTiers((t) => [
                ...t,
                { min_cost_km: "0", max_cost_km: "", margin_multiplier: "1.15", sort_order: String(t.length) }
              ])
            }
          >
            Dodaj red
          </Button>
        </Stack>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>min_cost_km</TableCell>
              <TableCell>max_cost_km (prazan = ∞)</TableCell>
              <TableCell>margin_multiplier</TableCell>
              <TableCell>sort_order</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {tiers.map((row, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <TextField
                    size="small"
                    value={row.min_cost_km}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTiers((t) => t.map((x, i) => (i === idx ? { ...x, min_cost_km: v } : x)));
                    }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={row.max_cost_km}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTiers((t) => t.map((x, i) => (i === idx ? { ...x, max_cost_km: v } : x)));
                    }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={row.margin_multiplier}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTiers((t) => t.map((x, i) => (i === idx ? { ...x, margin_multiplier: v } : x)));
                    }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={row.sort_order}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTiers((t) => t.map((x, i) => (i === idx ? { ...x, sort_order: v } : x)));
                    }}
                  />
                </TableCell>
                <TableCell>
                  <Button size="small" color="error" onClick={() => setTiers((t) => t.filter((_, i) => i !== idx))}>
                    Obriši
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          Za nabavnu cijenu c KM bira se prvi tier gdje je min_cost_km ≤ c &lt; max_cost_km (max prazan = gornja granica ne postoji).
        </Typography>
      </Card>

      <Card sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Dobavljači (formula nabavne)
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Naziv</TableCell>
              <TableCell>Code</TableCell>
              <TableCell>pricing_formula</TableCell>
              <TableCell>cost_adjustment_multiplier</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {suppliers.map((s) => (
              <SupplierRow key={s.id} s={s} onSave={(f, m) => void patchSupplier(s.id, f, m)} />
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Proizvod — override multiplier (UUID)
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Postavlja <code>products.selling_margin_override</code>; prazno polje marže šalje <code>null</code> (tier/category opet vrijede).
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-start">
          <TextField
            label="product id (uuid)"
            size="small"
            fullWidth
            value={productMarginId}
            onChange={(e) => setProductMarginId(e.target.value)}
          />
          <TextField
            label="selling_margin_override"
            size="small"
            value={productMarginVal}
            onChange={(e) => setProductMarginVal(e.target.value)}
            placeholder="npr. 1.22"
          />
          <Button variant="outlined" onClick={() => void patchProductMargin()}>
            Sačuvaj override
          </Button>
        </Stack>
      </Card>

      <Card sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Kategorije — default prodajni multiplier
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          Kada je postavljeno, zamjenjuje tier za sve proizvode u toj kategoriji (osim ako proizvod ima svoj override).
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Naziv</TableCell>
              <TableCell>selling_margin_default</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  {c.name} <Typography variant="caption">({c.slug})</Typography>
                </TableCell>
                <TableCell>
                  <CategoryMarginCell
                    initial={c.selling_margin_default != null ? String(c.selling_margin_default) : ""}
                    onSave={(v) => void patchCategoryMargin(c.id, v)}
                  />
                </TableCell>
                <TableCell />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Box>
  );
}

function CategoryMarginCell({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [val, setVal] = useState(initial);
  useEffect(() => setVal(initial), [initial]);
  return (
    <TextField
      size="small"
      placeholder="prazno = tier"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onSave(val)}
    />
  );
}

function SupplierRow({
  s,
  onSave
}: {
  s: { id: string; name: string; code: string; pricing_formula: string | null; cost_adjustment_multiplier: number };
  onSave: (formula: string, mult: string) => void;
}) {
  const [formula, setFormula] = useState(s.pricing_formula ?? "");
  const [mult, setMult] = useState(String(s.cost_adjustment_multiplier ?? 1));
  useEffect(() => {
    setFormula(s.pricing_formula ?? "");
    setMult(String(s.cost_adjustment_multiplier ?? 1));
  }, [s.pricing_formula, s.cost_adjustment_multiplier]);
  return (
    <TableRow>
      <TableCell>{s.name}</TableCell>
      <TableCell>{s.code}</TableCell>
      <TableCell>
        <TextField
          select
          size="small"
          fullWidth
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          SelectProps={{ displayEmpty: true }}
        >
          <MenuItem value="">
            <em>legacy (convert)</em>
          </MenuItem>
          <MenuItem value="ipon_huf">ipon_huf</MenuItem>
          <MenuItem value="hungary_huf_alza_tax">hungary_huf_alza_tax</MenuItem>
          <MenuItem value="domestic_custom">domestic_custom</MenuItem>
        </TextField>
      </TableCell>
      <TableCell>
        <TextField size="small" value={mult} onChange={(e) => setMult(e.target.value)} />
      </TableCell>
      <TableCell>
        <Button size="small" onClick={() => onSave(formula, mult)}>
          Sačuvaj
        </Button>
      </TableCell>
    </TableRow>
  );
}
