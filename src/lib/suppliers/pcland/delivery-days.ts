/**
 * PCLand PDP availability lead — ports client-side Type1 (személyes átvétel) logic
 * from pcland.hu product pages (stock status + portalDataShippingDays in Vonalkód).
 */

const MS_PER_DAY = 86_400_000;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addCalendarDays(date: Date, days: number): Date {
  const d = startOfLocalDay(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isWeekend(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

function extractRestrictedShippingDays(html: string): Set<string> {
  const out = new Set<string>();
  const m = html.match(/restrictedShippingDays\s*=\s*\[([\s\S]*?)\]/i);
  if (!m?.[1]) return out;
  const re = /["'](\d{4}-\d{2}-\d{2})["']/g;
  let hit: RegExpExecArray | null;
  while ((hit = re.exec(m[1])) !== null) {
    out.add(hit[1]);
  }
  return out;
}

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isNonWorkingDay(date: Date, restricted: Set<string>): boolean {
  return isWeekend(date) || restricted.has(dateKey(date));
}

function firstWorkingOnOrAfter(date: Date, restricted: Set<string>): Date {
  let d = startOfLocalDay(date);
  while (isNonWorkingDay(d, restricted)) {
    d = addCalendarDays(d, 1);
  }
  return d;
}

function nextWorkingDay(date: Date, restricted: Set<string>): Date {
  return firstWorkingOnOrAfter(addCalendarDays(date, 1), restricted);
}

export function daysBetween(from: Date, to: Date): number {
  const a = startOfLocalDay(from).getTime();
  const b = startOfLocalDay(to).getTime();
  return Math.max(0, Math.round((b - a) / MS_PER_DAY));
}

export type PclandStockContext = {
  stockStatusId: number | null;
  portalShippingDays: number;
  stockLabel: string | null;
};

export function parsePclandStockContextFromDetailHtml(html: string): PclandStockContext {
  const idM = html.match(/id="pclandStockStatusId"[^>]*>\s*(\d+)/i);
  const stockStatusId = idM?.[1] ? Number(idM[1]) : null;

  const labelM = html.match(
    /class="param-value productstock-param"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i
  );
  const stockLabel = labelM?.[1]?.trim() ?? null;

  let portalShippingDays = 5;
  const gtinM = html.match(
    /class="param-value product-gtin-param"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i
  );
  const gtinRaw = gtinM?.[1]?.trim();
  if (gtinRaw?.includes("|")) {
    const parts = gtinRaw.split("|");
    const parsed = Number(parts[2]);
    if (Number.isFinite(parsed)) portalShippingDays = parsed;
  }

  return { stockStatusId, portalShippingDays, stockLabel };
}

/**
 * Days until PCLand can hand over the product (Type1 személyes átvétel date).
 * Raktáron (9): 0 when same-day pickup applies, else 1.
 */
export function computePclandDeliveryDays(
  html: string,
  now: Date = new Date()
): number {
  const { stockStatusId, portalShippingDays } = parsePclandStockContextFromDetailHtml(html);
  const restricted = extractRestrictedShippingDays(html);

  const today = startOfLocalDay(now);
  const currentHour = now.getHours();
  const todayIsNonWorking = isNonWorkingDay(today, restricted);

  const orderWorkDay = todayIsNonWorking ? firstWorkingOnOrAfter(today, restricted) : today;

  let readyDate: Date;

  if (stockStatusId === 9) {
    if (todayIsNonWorking) {
      readyDate = firstWorkingOnOrAfter(today, restricted);
    } else if (currentHour < 17) {
      readyDate = today;
    } else {
      readyDate = nextWorkingDay(today, restricted);
    }
  } else if (stockStatusId === 12 || stockStatusId === 13) {
    const portalDays = Number.isFinite(portalShippingDays) ? portalShippingDays : 10;
    const portalDate = addCalendarDays(orderWorkDay, portalDays);
    readyDate = firstWorkingOnOrAfter(portalDate, restricted);
  } else {
    // Unknown status — conservative fallback from portal shipping days
    const portalDays = Number.isFinite(portalShippingDays) ? portalShippingDays : 14;
    const portalDate = addCalendarDays(orderWorkDay, portalDays);
    readyDate = firstWorkingOnOrAfter(portalDate, restricted);
  }

  return daysBetween(today, readyDate);
}
