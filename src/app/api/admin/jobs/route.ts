import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type JobRunRow = {
  id: string;
  job_type: string;
  supplier_id: string | null;
  status: string;
  triggered_by: string;
  started_at: string;
  finished_at: string | null;
  summary: Record<string, unknown> | null;
  error_message: string | null;
};

type JoinedSupplier = { id: string; name: string | null; code: string | null } | null;

type JobRunWithSupplier = JobRunRow & {
  suppliers: JoinedSupplier | JoinedSupplier[];
};

export type AdminJobRunListItem = {
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

export type AdminJobRunListResponse = {
  items: AdminJobRunListItem[];
  total: number;
  page: number;
  pageSize: number;
};

function firstSupplier(raw: JobRunWithSupplier["suppliers"]): JoinedSupplier {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

function computeDuration(startedAt: string, finishedAt: string | null): number | null {
  if (!finishedAt) return null;
  const start = Date.parse(startedAt);
  const end = Date.parse(finishedAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  const diff = end - start;
  return diff >= 0 ? diff : null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;
    const jobType = params.get("job_type")?.trim() || null;
    const status = params.get("status")?.trim() || null;
    const supplierId = params.get("supplier_id")?.trim() || null;
    const triggeredBy = params.get("triggered_by")?.trim() || null;
    const fromIso = params.get("from")?.trim() || null;
    const toIso = params.get("to")?.trim() || null;

    const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const pageSizeRaw = Number.parseInt(params.get("page_size") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT;
    const pageSize = Math.min(MAX_LIMIT, Math.max(1, pageSizeRaw));
    const offset = (page - 1) * pageSize;

    const supabase = createSupabaseServiceClient();
    let query = supabase
      .from("job_runs")
      .select(
        "id, job_type, supplier_id, status, triggered_by, started_at, finished_at, summary, error_message, suppliers(id, name, code)",
        { count: "exact" }
      )
      .order("started_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (jobType) query = query.eq("job_type", jobType);
    if (status) query = query.eq("status", status);
    if (supplierId) query = query.eq("supplier_id", supplierId);
    if (triggeredBy) query = query.eq("triggered_by", triggeredBy);
    if (fromIso) query = query.gte("started_at", fromIso);
    if (toIso) query = query.lte("started_at", toIso);

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const items: AdminJobRunListItem[] = ((data ?? []) as JobRunWithSupplier[]).map((row) => {
      const supplier = firstSupplier(row.suppliers);
      return {
        id: row.id,
        jobType: row.job_type,
        status: row.status,
        triggeredBy: row.triggered_by,
        startedAt: row.started_at,
        finishedAt: row.finished_at,
        durationMs: computeDuration(row.started_at, row.finished_at),
        summary: row.summary ?? null,
        errorMessage: row.error_message,
        supplier:
          supplier && supplier.id
            ? { id: supplier.id, name: supplier.name ?? null, code: supplier.code ?? null }
            : null
      };
    });

    const body: AdminJobRunListResponse = {
      items,
      total: count ?? items.length,
      page,
      pageSize
    };
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/jobs GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
