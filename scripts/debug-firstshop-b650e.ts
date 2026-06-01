import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const { createSupabaseServiceClient } = await import("../src/utils/supabase");
  const { resolveSupplierProductMatch } = await import("../src/lib/suppliers/matchSupplierProduct");
  const { mpnMatchKeyFromMpn, normalizeMpnForMatchCompare } = await import(
    "../src/lib/suppliers/normalizeProductIdentifiers"
  );

  const supabase = createSupabaseServiceClient();

  const { data: offers, error: offerErr } = await supabase
    .from("supplier_products")
    .select(
      "id, supplier_product_id, mpn, mpn_match_key, ean, product_id, master_match_status, is_active, raw_json, suppliers(code)"
    )
    .or(
      "supplier_product_id.eq.ROGSTRIXB650E-EGAMINGWIFI,mpn.ilike.%B650E%,mpn_match_key.eq.rog strix b650e e gaming wifi"
    )
    .limit(10);

  if (offerErr) throw offerErr;

  console.log("=== FirstShop / B650E offers ===");
  for (const o of offers ?? []) {
    const code = Array.isArray(o.suppliers) ? o.suppliers[0]?.code : (o.suppliers as { code?: string })?.code;
    console.log({
      supplier: code,
      supplier_product_id: o.supplier_product_id,
      mpn: JSON.stringify(o.mpn),
      mpn_match_key: JSON.stringify(o.mpn_match_key),
      key_from_mpn: mpnMatchKeyFromMpn(o.mpn),
      key_match: o.mpn_match_key === mpnMatchKeyFromMpn(o.mpn),
      ean: o.ean,
      product_id: o.product_id,
      status: o.master_match_status,
      is_active: o.is_active
    });

    const match = await resolveSupplierProductMatch(supabase, { mpn: o.mpn, ean: o.ean });
    console.log("  resolve:", {
      productId: match.productId,
      method: match.method,
      reason: match.audit.reason,
      candidates: match.audit.candidateCount
    });
  }

  const { data: masters, error: masterErr } = await supabase
    .from("products")
    .select("id, name, mpn, mpn_match_key, ean")
    .or("mpn.ilike.%B650E-E GAMING%,mpn_match_key.eq.rog strix b650e e gaming wifi")
    .limit(10);

  if (masterErr) throw masterErr;

  console.log("\n=== masters ===");
  for (const m of masters ?? []) {
    console.log({
      id: m.id,
      mpn: JSON.stringify(m.mpn),
      mpn_match_key: JSON.stringify(m.mpn_match_key),
      key_from_mpn: mpnMatchKeyFromMpn(m.mpn),
      ean: m.ean
    });
  }

  const uiMpn = "ROG STRIX B650E-E GAMING WIFI";
  const key = normalizeMpnForMatchCompare(uiMpn);
  const { data: byKey, error: keyErr } = await supabase
    .from("products")
    .select("id, mpn, mpn_match_key")
    .eq("mpn_match_key", key ?? "")
    .limit(5);
  console.log("\n=== products.eq(mpn_match_key) ===", key);
  if (keyErr) console.error(keyErr);
  console.log(byKey);

  const { count: nullKeys } = await supabase
    .from("supplier_products")
    .select("*", { count: "exact", head: true })
    .is("mpn_match_key", null)
    .not("mpn", "is", null);
  console.log("\n=== supplier_products with mpn but null mpn_match_key ===", nullKeys);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
