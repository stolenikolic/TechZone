"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

const JOB_TYPES = [
  "ipon_import",
  "ipon_scrape_details",
  "pcx_import",
  "aggregate_prices",
  "auto_match"
] as const;

const STATUSES = ["running", "success", "failed", "partial"] as const;
const TRIGGERS = ["manual", "cron", "chain"] as const;

type AdminJobRunListItem = {
  id: string;
  jobType: string;
  status: string;
  triggeredBy: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  summary: Record<string, unknown> | null;
  errorMessage: string | null;
  supplier: { id: string; name: string | null; code: string | null } | null;
};

type ListResponse = {
  items: AdminJobRunListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type StatsResponse = {
  windowHours: number;
  totals: { running: number; success: number; failed: number; partial: number };
  byJobType: {
    jobType: string;
    running: number;
    success: number;
    failed: number;
    partial: number;
    lastStartedAt: string | null;
  }[];
};

type DetailEvent = {
  id: number;
  level: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
};

type DetailResponse = AdminJobRunListItem & { events: DetailEvent[] };

type ScheduleItem = {
  jobType: string;
  isPaused: boolean;
  notes: string | null;
  updatedAt: string;
};

function statusColor(status: string): "default" | "primary" | "success" | "warning" | "error" | "info" {
  switch (status) {
    case "running":
      return "info";
    case "success":
      return "success";
    case "failed":
      return "error";
    case "partial":
      return "warning";
    default:
      return "default";
  }
}

function levelColor(level: string): "default" | "warning" | "error" {
  if (level === "warn") return "warning";
  if (level === "error") return "error";
  return "default";
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const restSec = sec - min * 60;
  if (min < 60) return `${min}m ${restSec}s`;
  const hr = Math.floor(min / 60);
  const restMin = min - hr * 60;
  return `${hr}h ${restMin}m`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return `${t.toLocaleDateString()} ${t.toLocaleTimeString()}`;
}

function summaryPreview(summary: Record<string, unknown> | null): string {
  if (!summary) return "—";
  const entries = Object.entries(summary).filter(([, v]) => v != null);
  if (entries.length === 0) return "—";
  return entries
    .slice(0, 6)
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");
}

export default function AdminJobsPageView() {
  const [list, setList] = useState<AdminJobRunListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [jobTypeFilter, setJobTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [triggerFilter, setTriggerFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [runBusy, setRunBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      if (jobTypeFilter) params.set("job_type", jobTypeFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (triggerFilter) params.set("triggered_by", triggerFilter);

      const res = await fetch(`/api/admin/jobs?${params.toString()}`, { cache: "no-store" });
      const json = (await res.json()) as ListResponse | { error: string };
      if (!res.ok || "error" in json) {
        throw new Error("error" in json ? json.error : "Load failed");
      }
      setList(json.items);
      setTotal(json.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, jobTypeFilter, statusFilter, triggerFilter]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/jobs/stats?hours=24", { cache: "no-store" });
      const json = (await res.json()) as StatsResponse | { error: string };
      if (!res.ok || "error" in json) return;
      setStats(json);
    } catch {
      /* ignore stats errors */
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/jobs/schedules", { cache: "no-store" });
      const json = (await res.json()) as { items?: ScheduleItem[]; error?: string };
      if (!res.ok || json.error) return;
      setSchedules(json.items ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const handleRunNow = useCallback(
    async (jobType: string) => {
      setRunBusy(jobType);
      setActionMessage(null);
      try {
        const res = await fetch("/api/admin/jobs/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobType })
        });
        const json = (await res.json()) as { success?: boolean; error?: string; runId?: string };
        if (!res.ok || json.error) {
          setActionMessage(`Greška: ${json.error ?? "Run failed"}`);
        } else {
          setActionMessage(`Pokrenut ${jobType}${json.runId ? ` (runId=${json.runId})` : ""}.`);
          await loadList();
          await loadStats();
        }
      } catch (e) {
        setActionMessage(e instanceof Error ? e.message : String(e));
      } finally {
        setRunBusy(null);
      }
    },
    [loadList, loadStats]
  );

  const handleTogglePause = useCallback(
    async (jobType: string, isPaused: boolean) => {
      try {
        const res = await fetch("/api/admin/jobs/schedules", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobType, isPaused })
        });
        if (!res.ok) {
          const json = (await res.json()) as { error?: string };
          setActionMessage(`Greška: ${json.error ?? "Pause toggle failed"}`);
        } else {
          await loadSchedules();
        }
      } catch (e) {
        setActionMessage(e instanceof Error ? e.message : String(e));
      }
    },
    [loadSchedules]
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void loadSchedules();
  }, [loadSchedules]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/jobs/${id}`, { cache: "no-store" });
      const json = (await res.json()) as DetailResponse | { error: string };
      if (res.ok && !("error" in json)) {
        setDetail(json as DetailResponse);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
  };

  return (
    <Box p={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">Background Jobs</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            onClick={() => {
              void loadList();
              void loadStats();
            }}
          >
            Osvježi
          </Button>
        </Stack>
      </Stack>

      <Typography variant="body2" color="text.secondary" paragraph>
        Pregled svih pozadinskih poslova (importeri, scraper, aggregator, matcher). Klik na red prikazuje detaljnu istoriju eventova.
      </Typography>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {stats ? (
          <>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Running (24h)" value={stats.totals.running} color="info" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Success (24h)" value={stats.totals.success} color="success" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Failed (24h)" value={stats.totals.failed} color="error" />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Partial (24h)" value={stats.totals.partial} color="warning" />
            </Grid>
          </>
        ) : (
          <Grid size={12}>
            <Card sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Učitavanje statistike…
              </Typography>
            </Card>
          </Grid>
        )}
      </Grid>

      {actionMessage && (
        <Typography sx={{ mb: 2 }} color={actionMessage.startsWith("Greška") ? "error" : "info.main"}>
          {actionMessage}
        </Typography>
      )}

      <Card sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Cron raspored i ručno pokretanje
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Pause uklanja job iz GitHub Actions ciklusa (workflow provjerava `job_schedules` prije izvršenja).
          Run now pokreće odmah i upisuje u `job_runs`.
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Job type</TableCell>
              <TableCell>Pause</TableCell>
              <TableCell>Note</TableCell>
              <TableCell align="right">Run now</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {JOB_TYPES.map((jt) => {
              const sch = schedules.find((s) => s.jobType === jt);
              return (
                <TableRow key={jt}>
                  <TableCell>{jt}</TableCell>
                  <TableCell>
                    <Switch
                      size="small"
                      checked={Boolean(sch?.isPaused)}
                      onChange={(e) => void handleTogglePause(jt, e.target.checked)}
                    />
                  </TableCell>
                  <TableCell>{sch?.notes ?? "—"}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="contained"
                      disabled={runBusy != null || Boolean(sch?.isPaused)}
                      onClick={() => void handleRunNow(jt)}
                    >
                      {runBusy === jt ? "Pokrećem…" : "Run now"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {stats && stats.byJobType.length > 0 && (
        <Card sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            Posljednjih 24h po tipu posla
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Job type</TableCell>
                <TableCell align="right">Running</TableCell>
                <TableCell align="right">Success</TableCell>
                <TableCell align="right">Failed</TableCell>
                <TableCell align="right">Partial</TableCell>
                <TableCell>Last started</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stats.byJobType.map((row) => (
                <TableRow key={row.jobType}>
                  <TableCell>{row.jobType}</TableCell>
                  <TableCell align="right">{row.running}</TableCell>
                  <TableCell align="right">{row.success}</TableCell>
                  <TableCell align="right">{row.failed}</TableCell>
                  <TableCell align="right">{row.partial}</TableCell>
                  <TableCell>{formatDate(row.lastStartedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField
            select
            size="small"
            label="Job type"
            value={jobTypeFilter}
            onChange={(e) => {
              setJobTypeFilter(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Svi</MenuItem>
            {JOB_TYPES.map((j) => (
              <MenuItem key={j} value={j}>
                {j}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Svi</MenuItem>
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Triggered by"
            value={triggerFilter}
            onChange={(e) => {
              setTriggerFilter(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">Svi</MenuItem>
            {TRIGGERS.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Card>

      <Card sx={{ p: 0, mb: 3 }}>
        {loading ? (
          <Box p={3} display="flex" alignItems="center" gap={2}>
            <CircularProgress size={20} />
            <Typography>Učitavanje runova…</Typography>
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Started</TableCell>
                <TableCell>Job type</TableCell>
                <TableCell>Supplier</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Trigger</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Summary</TableCell>
                <TableCell>Error</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                      Nema runova za zadane filtere.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                list.map((row) => (
                  <TableRow
                    key={row.id}
                    hover
                    onClick={() => void openDetail(row.id)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>{formatDate(row.startedAt)}</TableCell>
                    <TableCell>{row.jobType}</TableCell>
                    <TableCell>{row.supplier?.name ?? row.supplier?.code ?? "—"}</TableCell>
                    <TableCell>
                      <Chip size="small" label={row.status} color={statusColor(row.status)} />
                    </TableCell>
                    <TableCell>{row.triggeredBy}</TableCell>
                    <TableCell>{formatDuration(row.durationMs)}</TableCell>
                    <TableCell sx={{ maxWidth: 300, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {summaryPreview(row.summary)}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {row.errorMessage ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Stack direction="row" spacing={2} alignItems="center" justifyContent="flex-end">
        <Typography variant="body2" color="text.secondary">
          Ukupno: {total}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prethodna
        </Button>
        <Typography variant="body2">
          {page} / {totalPages}
        </Typography>
        <Button
          variant="outlined"
          size="small"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Sljedeća
        </Button>
      </Stack>

      <Dialog open={selectedId != null} onClose={closeDetail} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <span>Job run details</span>
            <IconButton size="small" onClick={closeDetail}>
              <Box component="span" sx={{ fontSize: 18 }}>
                ×
              </Box>
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading || !detail ? (
            <Box display="flex" alignItems="center" gap={2} p={2}>
              <CircularProgress size={20} />
              <Typography>Učitavanje…</Typography>
            </Box>
          ) : (
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Job type
                  </Typography>
                  <Typography>{detail.jobType}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Status
                  </Typography>
                  <Box>
                    <Chip size="small" label={detail.status} color={statusColor(detail.status)} />
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Started
                  </Typography>
                  <Typography>{formatDate(detail.startedAt)}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Finished
                  </Typography>
                  <Typography>{formatDate(detail.finishedAt)}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Duration
                  </Typography>
                  <Typography>{formatDuration(detail.durationMs)}</Typography>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Triggered by
                  </Typography>
                  <Typography>{detail.triggeredBy}</Typography>
                </Grid>
                <Grid size={12}>
                  <Typography variant="caption" color="text.secondary">
                    Summary
                  </Typography>
                  <Box component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 12, background: "rgba(0,0,0,0.04)", p: 1.5, borderRadius: 1 }}>
                    {JSON.stringify(detail.summary ?? {}, null, 2)}
                  </Box>
                </Grid>
                {detail.errorMessage && (
                  <Grid size={12}>
                    <Typography variant="caption" color="error">
                      Error
                    </Typography>
                    <Typography color="error">{detail.errorMessage}</Typography>
                  </Grid>
                )}
                {(detail.status === "failed" || detail.status === "partial") && (
                  <Grid size={12}>
                    <Button
                      variant="outlined"
                      color="warning"
                      disabled={runBusy != null}
                      onClick={() => {
                        closeDetail();
                        void handleRunNow(detail.jobType);
                      }}
                    >
                      Retry ({detail.jobType})
                    </Button>
                  </Grid>
                )}
              </Grid>

              <Divider />

              <Typography variant="subtitle2">Events ({detail.events.length})</Typography>
              <Stack spacing={1}>
                {detail.events.map((ev) => (
                  <Box key={ev.id} sx={{ borderLeft: "3px solid", borderLeftColor: `${levelColor(ev.level) === "default" ? "info.main" : `${levelColor(ev.level)}.main`}`, pl: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(ev.createdAt)}
                      </Typography>
                      <Chip size="small" label={ev.level} color={levelColor(ev.level) === "default" ? "default" : levelColor(ev.level)} />
                      {ev.entityType && (
                        <Typography variant="caption" color="text.secondary">
                          {ev.entityType}:{ev.entityId ?? "—"}
                        </Typography>
                      )}
                    </Stack>
                    <Typography variant="body2">{ev.message}</Typography>
                  </Box>
                ))}
              </Stack>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

function StatCard({
  label,
  value,
  color
}: {
  label: string;
  value: number;
  color: "info" | "success" | "warning" | "error";
}) {
  return (
    <Card sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" color={`${color}.main`}>
        {value}
      </Typography>
    </Card>
  );
}
