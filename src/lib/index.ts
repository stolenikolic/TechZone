import { formatDistanceStrict } from "date-fns/formatDistanceStrict";

/**
 * GET THE DIFFERENCE DATE FORMAT
 * @param  DATE | NUMBER | STRING
 * @returns FORMATTED DATE STRING
 */

export function getDateDifference(date: string | number | Date) {
  const distance = formatDistanceStrict(new Date(), new Date(date));
  return distance + " ago";
}

/**
 * RENDER THE PRODUCT PAGINATION INFO
 * @param page - CURRENT PAGE NUMBER
 * @param perPageProduct - PER PAGE PRODUCT LIST
 * @param totalProduct - TOTAL PRODUCT NUMBER
 * @returns
 */

export function renderProductCount(page: number, perPageProduct: number, totalProduct: number) {
  const startNumber = (page - 1) * perPageProduct;
  let endNumber = page * perPageProduct;

  if (endNumber > totalProduct) {
    endNumber = totalProduct;
  }

  return `Showing ${startNumber + 1}-${endNumber} of ${totalProduct} products`;
}

/**
 * CALCULATE PRICE WITH PRODUCT DISCOUNT THEN RETURN NEW PRODUCT PRICES
 * @param  price - PRODUCT PRICE
 * @param  discount - DISCOUNT PERCENT
 * @returns - RETURN NEW PRICE
 */

export function calculateDiscount(price: number, discount: number) {
  const afterDiscount = price - price * (discount / 100);
  return formatPrice(afterDiscount);
}

/**
 * Format money for dashboards, carts, summaries: "1234.56 KM" (dot as decimal separator).
 */
export function currency(price: number, fraction: number = 2) {
  if (!Number.isFinite(price)) return `${Number(0).toFixed(fraction)} KM`;
  return `${Number(price).toFixed(fraction)} KM`;
}

/**
 * Format price for display: "420.00 KM". Rounds to nearest integer, two decimals, " KM" suffix.
 * Use for all product prices (category list, search, product page, cards).
 * Never places currency before the number; never produces "KM0".
 */
export function formatPrice(price: number): string {
  if (!Number.isFinite(price) || price < 0) return "0.00 KM";
  return `${Math.round(Number(price)).toFixed(2)} KM`;
}
