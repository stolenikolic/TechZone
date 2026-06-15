/**
 * iPon XML feed sync (cijene, dostupnost, deaktivacija).
 * Run: npx tsx scripts/run-ipon-xml-sync.ts
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { runIponXmlSync } = await import("../src/lib/suppliers/ipon/xmlSync");
  const { IPON_SUPPLIER_ID } = await import("../src/lib/suppliers/ipon/categories");
  const { withJobRun } = await import("../src/lib/jobs/job-runner");

  const { value } = await withJobRun(
    { jobType: "ipon_xml_sync", supplierId: IPON_SUPPLIER_ID },
    async () => runIponXmlSync()
  );

  console.log("iPon XML sync finished:", JSON.stringify(value, null, 2));
  if (!value.success) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
