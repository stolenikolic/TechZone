import type { OfferChoiceKey } from "lib/product-offers";

const LINE_SEP = ":";

export function buildCartLineId(productId: string, supplierProductId: string): string {
  return `${productId.trim()}${LINE_SEP}${supplierProductId.trim()}`;
}

export function parseCartLineId(lineId: string): {
  productId: string;
  supplierProductId: string | null;
} {
  const idx = lineId.indexOf(LINE_SEP);
  if (idx <= 0) {
    return { productId: lineId.trim(), supplierProductId: null };
  }
  return {
    productId: lineId.slice(0, idx).trim(),
    supplierProductId: lineId.slice(idx + 1).trim() || null
  };
}

export function offerChoiceLabel(choice: OfferChoiceKey): string {
  return choice === "fastest" ? "Najbrza dostava" : "Najjeftinije";
}

export function formatCartDeliverySubtitle(deliveryLabel: string | undefined): string | null {
  if (!deliveryLabel?.trim()) return null;
  return deliveryLabel.replace(/^Rok isporuke:\s*/i, "").trim() || null;
}
