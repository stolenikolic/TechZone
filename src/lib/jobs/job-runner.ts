/**
 * Generic background job orchestration helper.
 *
 * Writes lifecycle markers and structured events into `job_runs` / `job_run_events`
 * (added in migration 00025). Coexists with the older `match_runs` tables; do not
 * delete or migrate those.
 *
 * Strategy: helpers are non-throwing. Logging failures must never break the
 * underlying business logic (importer, scraper, aggregator, matcher).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "utils/supabase";

export type JobType =
  | "ipon_import"
  | "ipon_xml_sync"
  | "ipon_scrape_details"
  | "pcx_import"
  | "firstshop_import"
  | "pcland_import"
  | "oazis_import"
  | "konzolvilag_import"
  | "comtrade_import"
  | "comtrade_price_sync"
  | "comtrade_enrich"
  | "aggregate_prices"
  | "auto_match"
  | "enrichment"
  | "apply_value_aliases"
  | "ai_descriptions";

export type JobStatus = "running" | "success" | "failed" | "partial";

export type JobTriggeredBy = "manual" | "cron" | "chain";

export type JobEventLevel = "info" | "warn" | "error";

export type JobSummary = Record<string, unknown>;

export type StartJobRunOptions = {
  jobType: JobType;
  supplierId?: string | null;
  triggeredBy?: JobTriggeredBy;
  initialSummary?: JobSummary;
};

export type FinishJobRunOptions = {
  status: JobStatus;
  summary?: JobSummary;
  errorMessage?: string | null;
};

export type LogEventOptions = {
  level?: JobEventLevel;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
};

export type JobRunHandle = {
  runId: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

function getSupabaseSafe(): SupabaseClient | null {
  try {
    return createSupabaseServiceClient();
  } catch (err) {
    console.warn("[job-runner] Supabase client unavailable:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

function resolveTriggeredBy(explicit?: JobTriggeredBy): JobTriggeredBy {
  if (explicit) return explicit;
  const envVal = process.env.JOB_TRIGGERED_BY?.trim().toLowerCase();
  if (envVal === "manual" || envVal === "cron" || envVal === "chain") return envVal;
  return "manual";
}

/**
 * Create a new `job_runs` row in status `running` and return its handle.
 * Never throws; if the DB call fails, returns a handle with `runId = null` and all
 * subsequent logger calls become no-ops.
 */
export async function startJobRun(options: StartJobRunOptions): Promise<JobRunHandle> {
  const supabase = getSupabaseSafe();
  if (!supabase) return { runId: null };

  const triggeredBy = resolveTriggeredBy(options.triggeredBy);
  const payload = {
    job_type: options.jobType,
    supplier_id: options.supplierId ?? null,
    status: "running" as JobStatus,
    triggered_by: triggeredBy,
    started_at: nowIso(),
    summary: options.initialSummary ?? {}
  };

  const { data, error } = await supabase.from("job_runs").insert(payload).select("id").maybeSingle();
  if (error || !data?.id) {
    console.warn("[job-runner] startJobRun failed:", error?.message ?? "no id returned");
    return { runId: null };
  }

  return { runId: data.id as string };
}

/**
 * Append a structured event row to the run. Safe to call concurrently.
 * If `runId` is null (start failed), this is a no-op.
 */
export async function logEvent(handle: JobRunHandle, options: LogEventOptions): Promise<void> {
  if (!handle.runId) return;
  const supabase = getSupabaseSafe();
  if (!supabase) return;

  const { error } = await supabase.from("job_run_events").insert({
    run_id: handle.runId,
    level: options.level ?? "info",
    message: options.message,
    entity_type: options.entityType ?? null,
    entity_id: options.entityId ?? null
  });
  if (error) {
    console.warn("[job-runner] logEvent failed:", error.message);
  }
}

/**
 * Finalize a run with status + summary. If `errorMessage` provided, also writes a
 * companion `error`-level event for visibility in the events stream.
 */
export async function finishJobRun(handle: JobRunHandle, options: FinishJobRunOptions): Promise<void> {
  if (!handle.runId) return;
  const supabase = getSupabaseSafe();
  if (!supabase) return;

  const { error } = await supabase
    .from("job_runs")
    .update({
      status: options.status,
      summary: options.summary ?? {},
      error_message: options.errorMessage ?? null,
      finished_at: nowIso()
    })
    .eq("id", handle.runId);
  if (error) {
    console.warn("[job-runner] finishJobRun failed:", error.message);
  }

  if (options.errorMessage) {
    await logEvent(handle, { level: "error", message: options.errorMessage });
  }
}

export type WithJobRunOptions = StartJobRunOptions;

export type WithJobRunResult<T> = {
  runId: string | null;
  value: T;
};

/**
 * Wraps an async function with start/finish lifecycle.
 *
 * - On success: status = `success`, summary = whatever the callback returned in
 *   `result.summary` (if provided), or the raw return value if it looks like a
 *   plain object.
 * - On thrown error: status = `failed`, error_message recorded; error is rethrown
 *   so the caller's process can still exit non-zero.
 *
 * The callback receives the run handle so it can append intermediate events.
 */
export async function withJobRun<T>(
  options: WithJobRunOptions,
  fn: (handle: JobRunHandle) => Promise<T>
): Promise<WithJobRunResult<T>> {
  const handle = await startJobRun(options);
  await logEvent(handle, { level: "info", message: `${options.jobType} started` });

  try {
    const value = await fn(handle);
    const summary = extractSummary(value);
    const status = inferStatus(value);
    await logEvent(handle, { level: "info", message: `${options.jobType} finished (${status})` });
    await finishJobRun(handle, { status, summary });
    return { runId: handle.runId, value };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await finishJobRun(handle, { status: "failed", errorMessage: message });
    throw err;
  }
}

function extractSummary(value: unknown): JobSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const obj = value as Record<string, unknown>;
  if ("summary" in obj && obj.summary && typeof obj.summary === "object" && !Array.isArray(obj.summary)) {
    return obj.summary as JobSummary;
  }
  const out: JobSummary = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val == null) continue;
    const t = typeof val;
    if (t === "string" || t === "number" || t === "boolean") out[key] = val;
  }
  return out;
}

function inferStatus(value: unknown): JobStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "success";
  const obj = value as Record<string, unknown>;
  if (typeof obj.success === "boolean" && obj.success === false) return "partial";
  if (typeof obj.error === "string" && obj.error.trim()) return "partial";
  if (typeof obj.errors === "number" && obj.errors > 0) return "partial";
  if (typeof obj.errorsCount === "number" && obj.errorsCount > 0) return "partial";
  if (typeof obj.errors_count === "number" && obj.errors_count > 0) return "partial";
  return "success";
}
