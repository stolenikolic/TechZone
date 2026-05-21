/**
 * Debug supplier ↔ master match for specific MPNs or offer ids.
 * Run: npx tsx scripts/debug-mpn-match.ts
 * Optional: npx tsx scripts/debug-mpn-match.ts "GV-R76GAMING"
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const needle = process.argv[2]?.trim() || "R76GAMING";
  const { createSupabaseServiceClient } = await import("../src/utils/supabase");
  const { resolveSupplierProductMatch } = await import("../src/lib/suppliers/matchSupplierProduct");
  const { normalizeMpnForMatchCompare, normalizeMpn } = await import(
    "../src/lib/suppliers/normalizeProductIdentifiers"
  );

  const supabase = createSupabaseServiceClient();

  const { data: masters, error: mastersErr } = await supabase
    .from("products")
    .select("id, name, mpn, ean, is_active")
    .or(`mpn.ilike.%${needle}%,name.ilike.%7600%`)
    .limit(20);
  if (mastersErr) throw mastersErr;
  console.log("\n=== products (masters) ===");
  for (const m of masters ?? []) {
    console.log({
      id: m.id,
      mpn: m.mpn,
      ean: m.ean,
      compare: normalizeMpnForMatchCompare(m.mpn),
      is_active: m.is_active,
      name: (m.name as string)?.slice(0, 80)
    });
  }

  const { data: offers, error: offersErr } = await supabase
    .from("supplier_products")
    .select(
      "id, supplier_product_id, mpn, ean, product_id, is_active, master_match_status, suppliers(code)"
    )
    .or(`mpn.ilike.%${needle}%`)
    .limit(20);
  if (offersErr) throw offersErr;
  console.log("\n=== supplier_products offers ===");
  for (const o of offers ?? []) {
    const code = Array.isArray(o.suppliers) ? o.suppliers[0]?.code : (o.suppliers as { code?: string })?.code;
    console.log({
      supplier: code,
      supplier_product_id: o.supplier_product_id,
      mpn: o.mpn,
      mpn_normalized: normalizeMpn(o.mpn),
      compare: normalizeMpnForMatchCompare(o.mpn),
      ean: o.ean,
      product_id: o.product_id,
      is_active: o.is_active,
      master_match_status: o.master_match_status
    });

    const match = await resolveSupplierProductMatch(supabase, { mpn: o.mpn, ean: o.ean });
    console.log("  resolveSupplierProductMatch:", {
      productId: match.productId,
      method: match.method,
      reason: match.audit.reason,
      candidateCount: match.audit.candidateCount,
      normalizedMpn: match.audit.normalized?.mpn
    });
  }

  const testPairs = [
    { mpn: "GV-R76GAMING OC-8GD", ean: null },
    { mpn: "GV-R76GAMING-OC-8GD", ean: "4719331313425" }
  ];
  console.log("\n=== synthetic resolve ===");
  for (const ids of testPairs) {
    const match = await resolveSupplierProductMatch(supabase, ids);
    console.log(ids, "->", {
      productId: match.productId,
      reason: match.audit.reason,
      candidateCount: match.audit.candidateCount
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
