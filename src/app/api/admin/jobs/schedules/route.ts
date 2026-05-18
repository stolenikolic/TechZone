import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "utils/supabase";
import { guardAdminApi } from "lib/auth/admin-route";

export const dynamic = "force-dynamic";

const ALLOWED_JOB_TYPES = [
  "ipon_import",
  "ipon_scrape_details",
  "pcx_import",
  "aggregate_prices",
  "auto_match"
] as const;

type Row = { job_type: string; is_paused: boolean; notes: string | null; updated_at: string };

export async function GET() {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("job_schedules")
      .select("job_type, is_paused, notes, updated_at")
      .order("job_type", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const items = ((data ?? []) as Row[]).map((r) => ({
      jobType: r.job_type,
      isPaused: r.is_paused,
      notes: r.notes,
      updatedAt: r.updated_at
    }));
    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = await guardAdminApi();
  if (denied) return denied;
  try {
    const body = (await request.json()) as { jobType?: string; isPaused?: boolean; notes?: string | null };
    if (!body.jobType || !ALLOWED_JOB_TYPES.includes(body.jobType as (typeof ALLOWED_JOB_TYPES)[number])) {
      return NextResponse.json({ error: "Invalid jobType" }, { status: 400 });
    }
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("job_schedules")
      .upsert(
        {
          job_type: body.jobType,
          is_paused: body.isPaused ?? false,
          notes: body.notes ?? null,
          updated_at: new Date().toISOString()
        },
        { onConflict: "job_type" }
      )
      .select("job_type, is_paused, notes, updated_at")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ item: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
