import assert from "node:assert/strict";
import {
  decideMatchFromCandidates,
  decideMatchFromLinkedOffers,
  mergeMatchAudit
} from "../src/lib/suppliers/matchSupplierProduct";
import {
  eanFromMpnField,
  mpnMatchKeyFromMpn,
  normalizeMpnForMatchCompare
} from "../src/lib/suppliers/normalizeProductIdentifiers";

function run() {
  assert.equal(normalizeMpnForMatchCompare("GV-R76GAMING OC-8GD"), "gv r76gaming oc 8gd");
  assert.equal(normalizeMpnForMatchCompare("GV-R76GAMING-OC-8GD"), "gv r76gaming oc 8gd");
  assert.equal(mpnMatchKeyFromMpn("GV-R76GAMING OC-8GD"), "gv r76gaming oc 8gd");
  assert.equal(mpnMatchKeyFromMpn("ROG STRIX B650E-E GAMING WIFI"), "rog strix b650e e gaming wifi");
  assert.equal(eanFromMpnField("4719331313425"), "4719331313425");
  assert.equal(eanFromMpnField("GV-R76GAMING OC-8GD"), null);

  const eanInMpnField = decideMatchFromCandidates(
    { mpn: "4719331313425", ean: null },
    {
      byEan: [],
      byMpn: [{ id: "p-gpu", ean: "4719331313425", mpn: "GV-R76GAMING-OC-8GD", created_at: null }]
    }
  );
  assert.equal(eanInMpnField.productId, "p-gpu");
  assert.equal(eanInMpnField.audit.method, "mpn");

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

  const mpnHyphenInsensitive = decideMatchFromCandidates(
    { mpn: "GV-R76GAMING OC-8GD" },
    {
      byEan: [],
      byMpn: [{ id: "gpu-7600", ean: "4719331313425", mpn: "GV-R76GAMING-OC-8GD", created_at: null }]
    }
  );
  assert.equal(mpnHyphenInsensitive.productId, "gpu-7600");
  assert.equal(mpnHyphenInsensitive.audit.method, "mpn");

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

  // --- Factor 2: linked supplier_products offers ---
  const mpnViaOffer = decideMatchFromLinkedOffers(
    { mpn: "100-100001084WOF" },
    {
      byEan: [],
      byMpn: [{ id: "master-pcx", ean: null, mpn: "100-100001084WOF", created_at: null }]
    }
  );
  assert.equal(mpnViaOffer.productId, "master-pcx");
  assert.equal(mpnViaOffer.method, "mpn_via_offer");
  assert.equal(mpnViaOffer.audit.method, "mpn_via_offer");

  const eanViaOffer = decideMatchFromLinkedOffers(
    { ean: "3856001234567", mpn: "OTHER" },
    {
      byEan: [{ id: "master-ean", ean: "3856001234567", mpn: "X", created_at: null }],
      byMpn: []
    }
  );
  assert.equal(eanViaOffer.productId, "master-ean");
  assert.equal(eanViaOffer.method, "ean_via_offer");

  const offerMpnAmbiguous = decideMatchFromLinkedOffers(
    { mpn: "SHARED-MPN" },
    {
      byEan: [],
      byMpn: [
        { id: "master-a", ean: null, mpn: "SHARED-MPN", created_at: null },
        { id: "master-b", ean: null, mpn: "shared-mpn", created_at: null }
      ]
    }
  );
  assert.equal(offerMpnAmbiguous.productId, null);
  assert.equal(offerMpnAmbiguous.audit.reason, "ambiguous_mpn");
  assert.equal(offerMpnAmbiguous.audit.method, "mpn_via_offer");

  // Factor 1 miss on products, factor 2 would apply (orchestrator gate)
  const tier1Miss = decideMatchFromCandidates(
    { mpn: "100-000000910" },
    { byEan: [], byMpn: [] }
  );
  assert.equal(tier1Miss.productId, null);
  assert.equal(tier1Miss.audit.reason, "no_unique_match");
  const tier2Hit = decideMatchFromLinkedOffers(
    { mpn: "100-000000910" },
    {
      byEan: [],
      byMpn: [{ id: "linked-master", ean: null, mpn: "100-000000910", created_at: null }]
    }
  );
  assert.equal(tier2Hit.productId, "linked-master");

  const tier1Ambiguous = decideMatchFromCandidates(
    { mpn: "DUP" },
    {
      byEan: [],
      byMpn: [
        { id: "p1", ean: null, mpn: "DUP", created_at: null },
        { id: "p2", ean: null, mpn: "dup", created_at: null }
      ]
    }
  );
  assert.equal(tier1Ambiguous.audit.reason, "ambiguous_mpn");
  const ambiguousReasons = ["ambiguous_ean", "ambiguous_mpn"] as const;
  const tier2Blocked =
    tier1Ambiguous.productId === null &&
    ambiguousReasons.includes(tier1Ambiguous.audit.reason as (typeof ambiguousReasons)[number]);
  assert.equal(tier2Blocked, true, "ambiguous tier1 must not run tier2");
}

run();
console.log("[test-match-supplier-product] ok");
