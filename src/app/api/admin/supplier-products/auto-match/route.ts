import { NextResponse } from "next/server";
import { withJobRun } from "lib/jobs/job-runner";
import { runAutoMatch, type AutoMatchResult } from "lib/auto-match/runAutoMatch";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";

/** Full pending scan can take 1–2 min; default serverless timeout is too short. */
export const maxDuration = 300;

const EVENTS_LIMIT = 120;

type MatchRunRow = {
  id: string;
  source: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  scanned: number;
  linked: number;
  skipped: number;
  errors_count: number;
};

type MatchRunEventRow = {
  id: number;
  run_id: string;
  level: string;
  message: string;
  supplier_product_id: string | null;
  matched_product_id: string | null;
  created_at: string;
};

async function readRunWithEvents(runId?: string) {
  const supabase = createSupabaseServiceClient();
  const runQuery = runId
    ? supabase.from("match_runs").select("*").eq("id", runId).maybeSingle()
    : supabase.from("match_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle();
  const { data: run, error: runError } = await runQuery;
  if (runError) return { error: runError.message };
  if (!run) return { run: null, events: [] };

  const { data: events, error: eventsError } = await supabase
    .from("match_run_events")
    .select("*")
    .eq("run_id", (run as MatchRunRow).id)
    .order("created_at", { ascending: false })
    .limit(EVENTS_LIMIT);

  if (eventsError) return { error: eventsError.message };
  return {
    run: run as MatchRunRow,
    events: ((events ?? []) as MatchRunEventRow[]).reverse()
  };
}

export async function GET(request: Request) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId")?.trim() || undefined;
  const result = await readRunWithEvents(runId);
  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}

export async function POST() {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const wrapResult = await withJobRun<AutoMatchResult>(
      { jobType: "auto_match", triggeredBy: "manual" },
      async (jobHandle) => runAutoMatch(jobHandle)
    );
    const result = wrapResult.value;
    if (!result.success) {
      const status = result.error ? 400 : 200;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/supplier-products/auto-match]", message);
    return NextResponse.json(
      { success: false, scanned: 0, linked: 0, skipped: 0, error: message },
      { status: 500 }
    );
  }
}
