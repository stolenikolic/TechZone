import type { CartItem } from "contexts/CartContext";
import { offerChoiceLabel } from "lib/cart/cart-line-id";
import { deliveryBandFromCalendarDays, type DeliveryBand } from "lib/product-offers/delivery-band";
import {
  daysBetween,
  parseDeliveryDateStorageKey,
  parseDisplayDeliveryDate
} from "lib/product-offers/delivery-estimate";

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseEstimatedDeliveryDate(item: {
  estimatedDeliveryDate?: string;
  deliveryLabel?: string;
}): Date | null {
  if (item.estimatedDeliveryDate?.trim()) {
    const fromDateKey = parseDeliveryDateStorageKey(item.estimatedDeliveryDate);
    if (fromDateKey) return fromDateKey;

    const d = new Date(item.estimatedDeliveryDate);
    if (!Number.isNaN(d.getTime())) return startOfLocalDay(d);
  }

  if (item.deliveryLabel?.trim()) {
    return parseDisplayDeliveryDate(item.deliveryLabel);
  }

  return null;
}

function productHasFastestLine(cart: CartItem[], productId: string): boolean {
  return cart.some((line) => line.productId === productId && line.offerChoice === "fastest");
}

/** Offer label on cart line — only when needed to distinguish options. */
export function getOfferLabelForCartLine(item: CartItem, cart: CartItem[]): string | null {
  if (item.offerChoice === "fastest") {
    return offerChoiceLabel("fastest");
  }
  if (item.offerChoice === "cheapest" && productHasFastestLine(cart, item.productId)) {
    return offerChoiceLabel("cheapest");
  }
  return null;
}

export type CartDeliverySummary = {
  /** Latest (slowest) delivery date across lines — kept for the order promise, not shown to the shopper. */
  globalDate: Date | null;
  /** Working-day range of the slowest line, e.g. "7–10 radnih dana". */
  globalRangeLabel: string | null;
  globalTone: DeliveryBand["tone"] | null;
  /** True when shopper-facing ranges differ. Exact dates inside one range stay one promise. */
  hasMixedDeliveryBands: boolean;
  /** Per line id: show that line's range only when bands differ. */
  showLineDeliveryById: Record<string, boolean>;
};

export function computeCartDeliverySummary(cart: CartItem[]): CartDeliverySummary {
  const dated = cart
    .map((item) => ({ id: item.id, date: parseEstimatedDeliveryDate(item) }))
    .filter((row): row is { id: string; date: Date } => row.date != null);

  if (!dated.length) {
    return {
      globalDate: null,
      globalRangeLabel: null,
      globalTone: null,
      hasMixedDeliveryBands: false,
      showLineDeliveryById: {}
    };
  }

  const today = new Date();
  const withBands = dated.map((row) => ({
    ...row,
    band: deliveryBandFromCalendarDays(daysBetween(today, row.date))
  }));
  const globalTime = Math.max(...withBands.map((row) => row.date.getTime()));
  const globalRow = withBands.find((row) => row.date.getTime() === globalTime) ?? withBands[0];
  const uniqueRanges = new Set(withBands.map((row) => row.band.rangeLabel));
  const hasMixedDeliveryBands = uniqueRanges.size > 1;

  const showLineDeliveryById: Record<string, boolean> = {};
  for (const row of withBands) {
    showLineDeliveryById[row.id] = hasMixedDeliveryBands;
  }

  return {
    globalDate: globalRow.date,
    globalRangeLabel: globalRow.band.rangeLabel,
    globalTone: globalRow.band.tone,
    hasMixedDeliveryBands,
    showLineDeliveryById
  };
}

/** Shopper-facing range for one line. Date stays on the line; this does not expose it. */
export function getLineDeliveryBand(
  item: Pick<CartItem, "estimatedDeliveryDate" | "deliveryLabel">
): DeliveryBand | null {
  const date = parseEstimatedDeliveryDate(item);
  if (!date) return null;
  return deliveryBandFromCalendarDays(daysBetween(new Date(), date));
}
