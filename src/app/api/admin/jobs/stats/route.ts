import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";

export const dynamic = "force-dynamic";

type WindowRow = {
  job_type: string;
  status: string;
  started_at: string;
};

export type AdminJobStatsResponse = {
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

const DEFAULT_WINDOW_HOURS = 24;
const MAX_WINDOW_HOURS = 24 * 30;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const hoursRaw = Number.parseInt(url.searchParams.get("hours") ?? String(DEFAULT_WINDOW_HOURS), 10);
    const windowHours = Math.min(MAX_WINDOW_HOURS, Math.max(1, Number.isFinite(hoursRaw) ? hoursRaw : DEFAULT_WINDOW_HOURS));
    const sinceIso = new Date(Date.now() - windowHours * 3600 * 1000).toISOString();

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("job_runs")
      .select("job_type, status, started_at")
      .gte("started_at", sinceIso)
      .order("started_at", { ascending: false })
      .limit(10000);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const rows = (data ?? []) as WindowRow[];
    const totals = { running: 0, success: 0, failed: 0, partial: 0 };
    const grouped = new Map<
      string,
      { running: number; success: number; failed: number; partial: number; lastStartedAt: string | null }
    >();

    for (const row of rows) {
      if (row.status === "running") totals.running += 1;
      else if (row.status === "success") totals.success += 1;
      else if (row.status === "failed") totals.failed += 1;
      else if (row.status === "partial") totals.partial += 1;

      const entry = grouped.get(row.job_type) ?? {
        running: 0,
        success: 0,
        failed: 0,
        partial: 0,
        lastStartedAt: null
      };
      if (row.status === "running") entry.running += 1;
      else if (row.status === "success") entry.success += 1;
      else if (row.status === "failed") entry.failed += 1;
      else if (row.status === "partial") entry.partial += 1;
      if (!entry.lastStartedAt || row.started_at > entry.lastStartedAt) {
        entry.lastStartedAt = row.started_at;
      }
      grouped.set(row.job_type, entry);
    }

    const byJobType = Array.from(grouped.entries())
      .map(([jobType, v]) => ({ jobType, ...v }))
      .sort((a, b) => a.jobType.localeCompare(b.jobType));

    const body: AdminJobStatsResponse = {
      windowHours,
      totals,
      byJobType
    };
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/jobs/stats GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
