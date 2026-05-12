import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { aggregatePrices } = await import("../src/lib/pricing");
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const { value: r } = await withJobRun({ jobType: "aggregate_prices" }, async () =>
    aggregatePrices()
  );
  console.log(JSON.stringify(r, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
