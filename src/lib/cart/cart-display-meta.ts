import type { CartItem } from "contexts/CartContext";
import { offerChoiceLabel } from "lib/cart/cart-line-id";
import {
  formatDeliveryDate,
  parseDeliveryDateStorageKey,
  parseDisplayDeliveryDate
} from "lib/product-offers/delivery-estimate";

const MS_PER_DAY = 86_400_000;

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
  /** Latest (slowest) delivery date across lines — global promise. */
  globalDate: Date | null;
  globalDateFormatted: string | null;
  hasMixedDeliveryDates: boolean;
  /** Per line id: show individual delivery when any line dates differ. */
  showLineDeliveryById: Record<string, boolean>;
};

export function computeCartDeliverySummary(cart: CartItem[]): CartDeliverySummary {
  const dated = cart
    .map((item) => ({ id: item.id, date: parseEstimatedDeliveryDate(item) }))
    .filter((row): row is { id: string; date: Date } => row.date != null);

  if (!dated.length) {
    return {
      globalDate: null,
      globalDateFormatted: null,
      hasMixedDeliveryDates: false,
      showLineDeliveryById: {}
    };
  }

  const times = dated.map((row) => row.date.getTime());
  const globalTime = Math.max(...times);
  const uniqueTimes = new Set(times);
  const hasMixedDeliveryDates = uniqueTimes.size > 1;
  const globalDate = new Date(globalTime);

  const showLineDeliveryById: Record<string, boolean> = {};
  for (const row of dated) {
    showLineDeliveryById[row.id] = hasMixedDeliveryDates;
  }

  return {
    globalDate,
    globalDateFormatted: formatDeliveryDate(globalDate),
    hasMixedDeliveryDates,
    showLineDeliveryById
  };
}

export function formatLineDeliveryFromDate(date: Date): string {
  const today = startOfLocalDay(new Date());
  const days = Math.max(0, Math.round((date.getTime() - today.getTime()) / MS_PER_DAY));
  if (days === 0) return formatDeliveryDate(date);
  if (days === 1) return `sutra (${formatDeliveryDate(date)})`;
  return `${formatDeliveryDate(date)} (za ~${days} dana)`;
}

/** Prikaz roka na liniji — uvijek iz estimatedDeliveryDate (ne zastarjelog deliveryLabel). */
export function getLineDeliveryDisplayText(
  item: Pick<CartItem, "estimatedDeliveryDate" | "deliveryLabel">
): string | null {
  const date = parseEstimatedDeliveryDate(item);
  if (!date) return null;
  return `Isporuka od: ${formatLineDeliveryFromDate(date)}`;
}
