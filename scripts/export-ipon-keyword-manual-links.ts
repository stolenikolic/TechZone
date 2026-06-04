import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

async function main() {
  dotenv.config({ path: path.resolve(".env.local") });

  const mod = await import("../src/utils/supabase");
  const supabase = mod.createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("supplier_products")
    .select("id,supplier_product_id,product_id,updated_at,raw_json,suppliers(code,name),products(id,name,slug)")
    .eq("master_match_status", "linked")
    .order("updated_at", { ascending: false })
    .limit(5000);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []).filter(
    (row: any) => row?.raw_json?.matchAudit?.method === "ipon_keyword_slug_manual"
  );

  const header = [
    "id",
    "supplier_product_id",
    "supplier_code",
    "supplier_name",
    "product_id",
    "product_name",
    "product_slug",
    "updated_at",
    "raw_name",
    "ipon_name",
    "ipon_slug",
    "candidate_count"
  ];

  const csvEscape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    if (/[",\n\r]/.test(text)) {
      return `"${text.replace(/"/g, "\"\"")}"`;
    }
    return text;
  };

  const lines = [header.join(",")];

  for (const row of rows as any[]) {
    const supplier = Array.isArray(row.suppliers) ? row.suppliers[0] : row.suppliers;
    const product = Array.isArray(row.products) ? row.products[0] : row.products;

    const values = [
      row.id,
      row.supplier_product_id,
      supplier?.code ?? "",
      supplier?.name ?? "",
      row.product_id,
      product?.name ?? "",
      product?.slug ?? "",
      row.updated_at,
      row?.raw_json?.product_name ?? row?.raw_json?.displayName ?? "",
      row?.raw_json?.matchAudit?.iponDisplayName ?? "",
      row?.raw_json?.matchAudit?.iponSlug ?? "",
      row?.raw_json?.matchAudit?.candidateCount ?? ""
    ];

    lines.push(values.map(csvEscape).join(","));
  }

  const outputPath = path.resolve("ipon-keyword-manual-links-2026-06-02.csv");
  fs.writeFileSync(outputPath, lines.join("\n"), "utf8");

  console.log(
    JSON.stringify(
      {
        outputPath,
        count: rows.length
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
