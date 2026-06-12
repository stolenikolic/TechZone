/**
 * AI product description generation job.
 *
 * Usage:
 *   npx tsx scripts/run-ai-descriptions.ts
 *   npx tsx scripts/run-ai-descriptions.ts --category-id=<uuid>
 *   npx tsx scripts/run-ai-descriptions.ts --verbose
 *   npx tsx scripts/run-ai-descriptions.ts --auto-approve
 */

import { runAiDescriptions } from "lib/ai-descriptions/runAiDescriptions";
import { withJobRun } from "lib/jobs/job-runner";

const args = process.argv.slice(2);
const categoryId = args.find((a) => a.startsWith("--category-id="))?.split("=")[1];
const verbose = args.includes("--verbose");
const overwrite = args.includes("--overwrite");
const autoApprove =
  args.includes("--auto-approve") || process.env.AI_DESCRIPTIONS_AUTO_APPROVE === "1";

async function main() {
  const run = () =>
    runAiDescriptions({ categoryId, verbose, overwrite, autoApprove });

  const triggeredBy = process.env.JOB_TRIGGERED_BY?.trim().toLowerCase();
  if (triggeredBy === "cron" || triggeredBy === "chain") {
    const { value } = await withJobRun(
      { jobType: "ai_descriptions", triggeredBy: triggeredBy === "cron" ? "cron" : "chain" },
      run
    );
    return value;
  }

  return run();
}

main()
  .then((result) => {
    console.log("[run-ai-descriptions] Result:", JSON.stringify(result, null, 2));
    process.exit(result?.success !== false ? 0 : 1);
  })
  .catch((err) => {
    console.error("[run-ai-descriptions] Fatal:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
