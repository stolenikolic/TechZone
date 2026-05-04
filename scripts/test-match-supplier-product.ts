import assert from "node:assert/strict";
import { decideMatchFromCandidates, mergeMatchAudit } from "../src/lib/suppliers/matchSupplierProduct";

function run() {
  const eanSingle = decideMatchFromCandidates(
    { ean: "3856001234567", mpn: "ABC-123" },
    {
      byEan: [{ id: "p1", ean: "3856001234567", mpn: "XYZ", created_at: null }],
      byMpn: []
    }
  );
  assert.equal(eanSingle.productId, "p1");
  assert.equal(eanSingle.audit.method, "ean");
  assert.equal(eanSingle.audit.result, "linked");

  const eanAmbiguous = decideMatchFromCandidates(
    { ean: "1234567890123" },
    {
      byEan: [
        { id: "p1", ean: "1234567890123", mpn: null, created_at: null },
        { id: "p2", ean: "1234567890123", mpn: null, created_at: null }
      ],
      byMpn: []
    }
  );
  assert.equal(eanAmbiguous.productId, null);
  assert.equal(eanAmbiguous.audit.reason, "ambiguous_ean");

  const mpnFallback = decideMatchFromCandidates(
    { ean: "0000000000000", mpn: " RTX 5080 " },
    {
      byEan: [],
      byMpn: [{ id: "p9", ean: null, mpn: "rtx 5080", created_at: null }]
    }
  );
  assert.equal(mpnFallback.productId, "p9");
  assert.equal(mpnFallback.audit.method, "mpn");

  const mpnAmbiguous = decideMatchFromCandidates(
    { mpn: "ABC-1" },
    {
      byEan: [],
      byMpn: [
        { id: "p1", ean: null, mpn: "ABC-1", created_at: null },
        { id: "p2", ean: null, mpn: "abc-1", created_at: null }
      ]
    }
  );
  assert.equal(mpnAmbiguous.productId, null);
  assert.equal(mpnAmbiguous.audit.reason, "ambiguous_mpn");

  const none = decideMatchFromCandidates(
    { ean: null, mpn: null },
    { byEan: [], byMpn: [] }
  );
  assert.equal(none.productId, null);
  assert.equal(none.audit.reason, "missing_identifiers");

  const withAudit = mergeMatchAudit({ source: "pcx" }, eanAmbiguous.audit);
  const withAuditRecord = withAudit as Record<string, unknown>;
  assert.equal((withAudit.matchAudit as { reason?: string }).reason, "ambiguous_ean");
  assert.equal(withAuditRecord.source, "pcx");
}

run();
console.log("[test-match-supplier-product] ok");
