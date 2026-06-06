export const IPON_ROW_NULL_LEAD_DAYS = 0;
export const OTHER_SUPPLIER_FALLBACK_LEAD_DAYS = 7;

function normalizeLeadDays(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(Number(value))) return 0;
  return Math.max(0, Math.round(Number(value)));
}

/**
 * Per-offer lead + supplier inbound default (admin `inbound_lead_days_default`).
 * iPon: default 0 → samo `supplier_products.delivery_days`. Ostali: default 7.
 * NULL na redu = 0. NULL na supplieru = fallback 7.
 */
export function resolveInboundLeadDays(
  _supplierId: string | null | undefined,
  rowDeliveryDays: number | null | undefined,
  supplierDefaultLeadDays: number | null | undefined
): number {
  const fromRow = normalizeLeadDays(rowDeliveryDays);
  const fromSupplier = normalizeLeadDays(supplierDefaultLeadDays);
  const supplierInbound =
    supplierDefaultLeadDays == null ? OTHER_SUPPLIER_FALLBACK_LEAD_DAYS : fromSupplier;
  return fromRow + supplierInbound;
}
