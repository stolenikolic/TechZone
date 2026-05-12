"use client";

import { useCallback, useEffect, useState } from "react";
import NextLink from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

type SupplierItem = {
  id: string;
  name: string;
  code: string;
  kind: string | null;
  baseUrl: string | null;
  defaultCurrency: string | null;
  createsMasterProducts: boolean;
  isActive: boolean;
  createdAt: string;
};

export default function AdminSuppliersPageView() {
  const [items, setItems] = useState<SupplierItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/suppliers", { cache: "no-store" });
      const json = (await res.json()) as { items?: SupplierItem[]; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "Load failed");
      setItems(json.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Box p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Suppliers</Typography>
        <Button variant="outlined" onClick={() => void load()} disabled={loading}>
          Osvježi
        </Button>
      </Stack>

      <Typography variant="body2" color="text.secondary" paragraph>
        Lista dobavljača. Klik na red otvara detalj sa konfiguracijom (Categories, Attribute Mappings, Scrape Config).
        Stara hardcoded mapiranja ostaju kao fallback ako u DB tabelama nema redova.
      </Typography>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Card sx={{ p: 0 }}>
        {loading ? (
          <Box p={3} display="flex" alignItems="center" gap={2}>
            <CircularProgress size={20} />
            <Typography>Učitavanje…</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Kind</TableCell>
                <TableCell>Base URL</TableCell>
                <TableCell>Currency</TableCell>
                <TableCell>Master products</TableCell>
                <TableCell>Active</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography align="center" sx={{ py: 2 }} color="text.secondary">
                      Nema dobavljača.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.kind ?? "—"}</TableCell>
                    <TableCell sx={{ maxWidth: 280, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.baseUrl ?? "—"}
                    </TableCell>
                    <TableCell>{item.defaultCurrency ?? "—"}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={item.createsMasterProducts ? "yes" : "no"}
                        color={item.createsMasterProducts ? "primary" : "default"}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={item.isActive ? "active" : "inactive"}
                        color={item.isActive ? "success" : "default"}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button component={NextLink} href={`/admin/suppliers/${item.id}`} size="small" variant="text">
                        Otvori
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </Box>
  );
}
