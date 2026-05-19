/** First number in an attribute value string (e.g. "2048GB" → 2048). Used for facet min/max. */
export function parseNumericFromAttributeValue(value: string | null): number | null {
  if (value == null || value === "") return null;
  const match = String(value).match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isNaN(n) ? null : n;
}

/** Clamp a single value to [min, max] and snap to step grid from min. */
export function clampRangeValue(value: number, min: number, max: number, step = 1): number {
  if (!Number.isFinite(value)) return min;
  const bounded = Math.max(min, Math.min(max, value));
  if (!Number.isFinite(step) || step <= 0) return bounded;
  const steps = Math.round((bounded - min) / step);
  return Math.max(min, Math.min(max, min + steps * step));
}

/** Clamp both ends and ensure low <= high. */
export function clampRangeTuple(
  tuple: [number, number],
  min: number,
  max: number,
  step = 1
): [number, number] {
  const low = clampRangeValue(tuple[0], min, max, step);
  const high = clampRangeValue(tuple[1], min, max, step);
  return [Math.min(low, high), Math.max(low, high)];
}

/** Parse URL param "min-max" into a clamped tuple; default is full span. */
export function parseRangeParamToTuple(
  param: string | null,
  bounds: { min: number; max: number },
  step = 1
): [number, number] {
  const { min, max } = bounds;
  if (!param?.trim()) return [min, max];

  const parts = param.split("-").map((segment) => Number(segment.trim()));
  if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
    return clampRangeTuple([parts[0], parts[1]], min, max, step);
  }
  if (parts.length === 1 && Number.isFinite(parts[0])) {
    return clampRangeTuple([parts[0], parts[0]], min, max, step);
  }

  return [min, max];
}

export function formatRangeParam(tuple: [number, number]): string {
  return `${tuple[0]}-${tuple[1]}`;
}

/** True when URL param represents the full span (no effective filter). */
export function isFullRangeSelection(
  tuple: [number, number],
  bounds: { min: number; max: number }
): boolean {
  return tuple[0] === bounds.min && tuple[1] === bounds.max;
}
