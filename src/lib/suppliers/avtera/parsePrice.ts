function parseAmount(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw !== "string") return null;
  const s = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** cenaAkcijska ako > 0, inače nabavnaCena. */
export function resolveAvteraPrice(item: {
  cenaAkcijska?: unknown;
  nabavnaCena?: unknown;
}): number | null {
  const akcijska = parseAmount(item.cenaAkcijska);
  if (akcijska != null) return akcijska;
  return parseAmount(item.nabavnaCena);
}
