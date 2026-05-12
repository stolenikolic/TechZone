/**
 * Exit with code 78 ("neutral skipped") when the job_schedules row says the
 * current JOB_TYPE is paused. The wrapping GitHub Actions step interprets a
 * non-zero exit as failure unless we explicitly `continue-on-error`; in
 * practice we just want the workflow to stop without firing the script.
 *
 * Falls back to "not paused" on any error so a missing table never blocks
 * the cron pipeline.
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const jobType = process.env.JOB_TYPE?.trim();
  if (!jobType) {
    console.warn("[check-job-paused] JOB_TYPE not set; proceeding.");
    return;
  }
  const { createSupabaseServiceClient } = await import("../src/utils/supabase");
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("job_schedules")
      .select("is_paused")
      .eq("job_type", jobType)
      .maybeSingle();
    if (error) {
      console.warn(`[check-job-paused] DB error: ${error.message}; proceeding.`);
      return;
    }
    if ((data as { is_paused: boolean } | null)?.is_paused) {
      console.log(`[check-job-paused] Job '${jobType}' is paused. Aborting.`);
      process.exit(1);
    }
    console.log(`[check-job-paused] Job '${jobType}' is active.`);
  } catch (err) {
    console.warn("[check-job-paused] Unexpected error; proceeding:", err instanceof Error ? err.message : String(err));
  }
}

main().catch((err) => {
  console.warn("[check-job-paused] Caught:", err instanceof Error ? err.message : String(err));
});
