export function parseAvteraZaloga(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  if (typeof raw === "string") {
    const n = Number(raw.trim().replace(",", "."));
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

export function isAvteraActiveFromZaloga(zaloga: number): boolean {
  return zaloga > 0;
}

export function deliveryDaysForZaloga(zaloga: number): number | null {
  return zaloga > 0 ? 1 : null;
}
