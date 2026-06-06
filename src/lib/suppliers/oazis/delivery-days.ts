const OAZIS_DELIVERY_FALLBACK_DAYS = 14;

/**
 * Parse munkanap range from availability text (listing or PDP).
 * "1-2 munkanap" → 2, "Rendelhető, 5-7 munkanap" → 7, "7-10 munkanap" → 10.
 */
export function parseOazisDeliveryDays(text: string | null | undefined): number {
  if (!text?.trim()) return OAZIS_DELIVERY_FALLBACK_DAYS;
  const normalized = text.replace(/\s+/g, " ").trim();

  const rangeM = normalized.match(/(\d+)\s*-\s*(\d+)\s*munkanap/i);
  if (rangeM) {
    const lo = Number(rangeM[1]);
    const hi = Number(rangeM[2]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      return Math.max(lo, hi);
    }
  }

  const singleM = normalized.match(/(\d+)\s*munkanap/i);
  if (singleM) {
    const n = Number(singleM[1]);
    if (Number.isFinite(n)) return n;
  }

  console.warn("[Oázis] Unknown delivery format, fallback 14:", normalized.slice(0, 120));
  return OAZIS_DELIVERY_FALLBACK_DAYS;
}

/** Parse warranty from PDP text, e.g. "36 hónap garancia". */
export function parseOazisWarrantyMonths(text: string | null | undefined): number | null {
  if (!text?.trim()) return null;
  const m =
    text.match(/(\d+)\s*hónap/i) ??
    text.match(/(\d+)\s*h&oacute;nap/i) ??
    text.match(/(\d+)\s*honap/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}
