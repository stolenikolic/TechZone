const KONZOLVILAG_DELIVERY_FALLBACK_DAYS = 14;

/**
 * Map Konzolvilág stock labels to delivery_days.
 * Készleten → 0, Rendelésre / Előrendelhető → 7.
 */
export function parseKonzolvilagDeliveryDays(text: string | null | undefined): number {
  if (!text?.trim()) return KONZOLVILAG_DELIVERY_FALLBACK_DAYS;
  const normalized = text.replace(/\s+/g, " ").trim();

  if (/készleten/i.test(normalized)) return 0;
  if (/rendelésre/i.test(normalized)) return 7;
  if (/előrendelhető/i.test(normalized)) return 7;

  if (/schema\.org\/InStock/i.test(normalized)) return 0;
  if (/schema\.org\/OutOfStock/i.test(normalized)) return 7;
  if (/schema\.org\/PreOrder/i.test(normalized)) return 7;

  console.warn("[Konzolvilág] Unknown delivery format, fallback 14:", normalized.slice(0, 120));
  return KONZOLVILAG_DELIVERY_FALLBACK_DAYS;
}

/** Prefer PDP „Házhoz szállítás” row over per-store stock. */
export function extractHazhozSzallitasStatusFromDetailHtml(html: string): string | null {
  const blockM = html.match(
    /Házhoz szállítás[\s\S]{0,400}?<div class="right[^"]*"[^>]*>([\s\S]{0,120}?)<\/div>/i
  );
  if (!blockM?.[1]) return null;
  const text = blockM[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (/készleten/i.test(text)) return "Készleten";
  if (/rendelésre/i.test(text)) return "Rendelésre";
  if (/előrendelhető/i.test(text)) return "Előrendelhető";
  return text.length > 0 ? text : null;
}

export function extractListingStockLabel(block: string): string | null {
  const m =
    block.match(/<li class="clear"[^>]*>[\s\S]*?Készleten/i) ??
    block.match(/<li class="clear"[^>]*>[\s\S]*?Rendelésre/i) ??
    block.match(/<li class="clear"[^>]*>[\s\S]*?Előrendelhető/i);
  if (!m) return null;
  if (/készleten/i.test(m[0])) return "Készleten";
  if (/rendelésre/i.test(m[0])) return "Rendelésre";
  if (/előrendelhető/i.test(m[0])) return "Előrendelhető";
  return null;
}
