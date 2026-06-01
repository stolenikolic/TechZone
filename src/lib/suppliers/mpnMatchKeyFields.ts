import { mpnMatchKeyFromMpn, normalizeMpn } from "./normalizeProductIdentifiers";

/** Normalized mpn + indexed match key for DB writes. */
export function mpnFieldsForStorage(mpn: string | null | undefined): {
  mpn: string | null;
  mpn_match_key: string | null;
} {
  const normalized = normalizeMpn(mpn);
  return {
    mpn: normalized,
    mpn_match_key: mpnMatchKeyFromMpn(normalized)
  };
}
