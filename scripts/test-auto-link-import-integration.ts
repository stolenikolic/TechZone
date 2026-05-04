import assert from "node:assert/strict";
import { decideMatchFromCandidates, mergeMatchAudit } from "../src/lib/suppliers/matchSupplierProduct";
import { extractIponIdentifiers } from "../src/lib/suppliers/ipon/importProducts";

function run() {
  const identifiers = extractIponIdentifiers({
    id: "42",
    displayName: "Demo GPU",
    grossPrice: 1000,
    manufacturerPartNumber: "  ABC-42  ",
    gtin13: "385-600-777-1111"
  });
  assert.equal(identifiers.mpn, "ABC-42");
  assert.equal(identifiers.ean, "3856007771111");

  const resolution = decideMatchFromCandidates(identifiers, {
    byEan: [{ id: "master-1", ean: "3856007771111", mpn: "ABC-42", created_at: null }],
    byMpn: []
  });
  assert.equal(resolution.productId, "master-1");

  const supplierRaw = mergeMatchAudit({ source: "ipon", productName: "Demo GPU" }, resolution.audit);
  const audit = supplierRaw.matchAudit as { method?: string; result?: string; matchedProductId?: string };
  assert.equal(audit.method, "ean");
  assert.equal(audit.result, "linked");
  assert.equal(audit.matchedProductId, "master-1");
}

run();
console.log("[test-auto-link-import-integration] ok");
