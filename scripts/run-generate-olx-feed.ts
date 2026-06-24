import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { generateAndStoreOlxFeed } = await import("../src/lib/feeds/generate-and-store");
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const { value: r } = await withJobRun({ jobType: "olx_feed_export" }, async () =>
    generateAndStoreOlxFeed()
  );
  console.log(JSON.stringify(r, null, 2));
  if (!r.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
