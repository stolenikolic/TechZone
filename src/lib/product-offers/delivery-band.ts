export type DeliveryBandTone = "fast" | "standard" | "slow";

export type DeliveryBand = {
  tone: DeliveryBandTone;
  /** Customer-facing span, e.g. "3–5 radnih dana". */
  rangeLabel: string;
};

/**
 * Map calendar days until the internal delivery date to a stable working-day range.
 * 0–6 → next inbound Monday. 7–13 → typical other-supplier lead. 14+ → slower stock.
 */
export function deliveryBandFromCalendarDays(daysFromToday: number): DeliveryBand {
  const days = Math.max(0, Math.round(daysFromToday));
  if (days <= 6) return { tone: "fast", rangeLabel: "3–5 radnih dana" };
  if (days <= 13) return { tone: "standard", rangeLabel: "7–10 radnih dana" };
  return { tone: "slow", rangeLabel: "12–15 radnih dana" };
}
