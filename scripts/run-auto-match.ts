/**
 * Auto-match supplier_products → master products.
 * Run: npx tsx scripts/run-auto-match.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { runAutoMatch } = await import("../src/lib/auto-match/runAutoMatch");
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const { value } = await withJobRun({ jobType: "auto_match" }, async (handle) =>
    runAutoMatch(handle)
  );
  console.log("auto-match finished:", JSON.stringify(value, null, 2));
  if (!value.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
