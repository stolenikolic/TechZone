import { IPON_SUPPLIER_ID } from "lib/suppliers/ipon/constants";

export const IPON_ROW_NULL_LEAD_DAYS = 0;
export const OTHER_SUPPLIER_FALLBACK_LEAD_DAYS = 7;

function normalizeLeadDays(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Math.max(0, Math.round(Number(value)));
}

/**
 * iPon: supplier_products.delivery_days iz API (deliveryDays). NULL na redu = 0.
 * Ostali: uvijek inbound_lead_days_default sa dobavljača (NULL na supplieru = 7).
 */
export function resolveInboundLeadDays(
  supplierId: string | null | undefined,
  rowDeliveryDays: number | null | undefined,
  supplierDefaultLeadDays: number | null | undefined
): number {
  if (supplierId === IPON_SUPPLIER_ID) {
    const fromRow = normalizeLeadDays(rowDeliveryDays);
    return fromRow ?? IPON_ROW_NULL_LEAD_DAYS;
  }

  const fromSupplier = normalizeLeadDays(supplierDefaultLeadDays);
  return fromSupplier ?? OTHER_SUPPLIER_FALLBACK_LEAD_DAYS;
}
