import type { DeliveryPolicy } from "./types";

const MS_PER_DAY = 86_400_000;
const MONDAY = 1;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

function daysUntilWeekday(from: Date, weekday: number): number {
  const current = from.getDay();
  return (weekday - current + 7) % 7;
}

/** Prvi ponedjeljak (ili drugi dan iz policy) na ili poslije datuma `from`. */
function nextInboundDayOnOrAfter(from: Date, weekday: number): Date {
  const base = startOfLocalDay(from);
  const offset = daysUntilWeekday(base, weekday);
  return addDays(base, offset);
}

/**
 * Svi dobavljači: roba kod nas stiže svakog ponedjeljka.
 * Prvo se čeka lead time dobavljača (po supplieru: iPon 0, ostali 7), zatim prvi ponedjeljak ≥ taj datum.
 */
export function normalizeDeliveryPolicy(raw: unknown): DeliveryPolicy {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    if (o.type === "daily") return { type: "daily" };
    const weekday =
      typeof o.weekday === "number" && o.weekday >= 0 && o.weekday <= 6
        ? Math.round(o.weekday)
        : MONDAY;
    return { type: "weekly", weekday };
  }
  return { type: "weekly", weekday: MONDAY };
}

export function estimateTechZoneDeliveryDate(
  _policy: DeliveryPolicy,
  supplierLeadDays: number,
  fromDate: Date = new Date()
): Date {
  const policy = normalizeDeliveryPolicy(_policy);
  const lead = Math.max(0, Math.round(supplierLeadDays));
  const readyAt = addDays(startOfLocalDay(fromDate), lead);
  if (policy.type === "daily") return readyAt;
  return nextInboundDayOnOrAfter(readyAt, policy.weekday);
}

export function daysBetween(from: Date, to: Date): number {
  const a = startOfLocalDay(from).getTime();
  const b = startOfLocalDay(to).getTime();
  return Math.max(0, Math.round((b - a) / MS_PER_DAY));
}

const MONTH_NAMES_BS = [
  "januar",
  "februar",
  "mart",
  "april",
  "maj",
  "juni",
  "juli",
  "august",
  "septembar",
  "oktobar",
  "novembar",
  "decembar"
] as const;

const MONTH_INDEX_BS: Record<string, number> = Object.fromEntries(
  MONTH_NAMES_BS.map((name, index) => [name, index])
);

/** Stabilan prikaz datuma (izbjegava Intl fallback tipa „2026 M06 15”). */
export function formatDeliveryDate(date: Date): string {
  const d = startOfLocalDay(date);
  const month = MONTH_NAMES_BS[d.getMonth()] ?? MONTH_NAMES_BS[0];
  return `${d.getDate()}. ${month} ${d.getFullYear()}.`;
}

/** Lokalni kalendarski dan za storage (izbjegava UTC pomak u korpi). */
export function toDeliveryDateStorageKey(date: Date): string {
  const d = startOfLocalDay(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function parseDeliveryDateStorageKey(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfLocalDay(parsed);
}

/** Parsira „9. juni 2026.“ iz Rok isporuke / Procijenjena isporuka teksta (legacy korpa). */
export function parseDisplayDeliveryDate(text: string): Date | null {
  const match = /(\d{1,2})\.\s*([a-zčćžšđA-ZČĆŽŠĐ]+)\s+(\d{4})/i.exec(text.trim());
  if (!match) return null;

  const day = Number(match[1]);
  const year = Number(match[3]);
  const month = MONTH_INDEX_BS[match[2].toLowerCase()];
  if (month === undefined || !Number.isFinite(day) || !Number.isFinite(year)) return null;

  const parsed = new Date(year, month, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return startOfLocalDay(parsed);
}

export function formatDeliveryLabel(date: Date, daysFromToday: number): string {
  if (daysFromToday <= 0) {
    return `Procijenjena isporuka: ${formatDeliveryDate(date)}`;
  }
  if (daysFromToday === 1) {
    return `Procijenjena isporuka: sutra (${formatDeliveryDate(date)})`;
  }
  return `Procijenjena isporuka: ${formatDeliveryDate(date)} (za ~${daysFromToday} dana)`;
}
