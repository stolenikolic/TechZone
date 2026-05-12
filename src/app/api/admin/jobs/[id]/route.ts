import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";

export const dynamic = "force-dynamic";

const DEFAULT_EVENT_LIMIT = 500;

type EventRow = {
  id: number;
  run_id: string;
  level: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
};

type RunRow = {
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

type RunWithSupplier = RunRow & {
  suppliers: JoinedSupplier | JoinedSupplier[];
};

export type AdminJobRunDetail = {
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
  events: {
    id: number;
    level: string;
    message: string;
    entityType: string | null;
    entityId: string | null;
    createdAt: string;
  }[];
};

function firstSupplier(raw: RunWithSupplier["suppliers"]): JoinedSupplier {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

function computeDuration(startedAt: string, finishedAt: string | null): number | null {
  if (!finishedAt) return null;
  const s = Date.parse(startedAt);
  const e = Date.parse(finishedAt);
  if (Number.isNaN(s) || Number.isNaN(e)) return null;
  return e - s >= 0 ? e - s : null;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase
      .from("job_runs")
      .select(
        "id, job_type, supplier_id, status, triggered_by, started_at, finished_at, summary, error_message, suppliers(id, name, code)"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: "Job run not found." }, { status: 404 });
    }

    const url = new URL(request.url);
    const eventLimit = Math.min(
      2000,
      Math.max(1, Number.parseInt(url.searchParams.get("event_limit") ?? String(DEFAULT_EVENT_LIMIT), 10) || DEFAULT_EVENT_LIMIT)
    );

    const { data: eventRows, error: eventsError } = await supabase
      .from("job_run_events")
      .select("id, run_id, level, message, entity_type, entity_id, created_at")
      .eq("run_id", id)
      .order("created_at", { ascending: true })
      .limit(eventLimit);

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 400 });
    }

    const row = data as RunWithSupplier;
    const supplier = firstSupplier(row.suppliers);
    const events = ((eventRows ?? []) as EventRow[]).map((e) => ({
      id: e.id,
      level: e.level,
      message: e.message,
      entityType: e.entity_type,
      entityId: e.entity_id,
      createdAt: e.created_at
    }));

    const body: AdminJobRunDetail = {
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
          : null,
      events
    };
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/jobs/:id GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
