import { createHash } from "crypto";
import type { PromptSpecLine } from "lib/ai-descriptions/types";

/**
 * Stable hash of product name + selected specification values used for idempotent regeneration.
 */
export function computeInputHash(productName: string, specs: PromptSpecLine[]): string {
  const normalizedName = productName.trim().toLowerCase();
  const specPart = [...specs]
    .map((s) => `${s.label.trim().toLowerCase()}:${s.value.trim().toLowerCase()}`)
    .sort()
    .join("|");
  return createHash("sha256").update(`${normalizedName}::${specPart}`).digest("hex");
}

/** Pick a writing angle deterministically from product id or hash. */
export function pickAngle(seed: string, angles: readonly string[]): string {
  if (angles.length === 0) return "praktična upotreba";
  const hash = createHash("sha256").update(seed).digest();
  const index = hash.readUInt32BE(0) % angles.length;
  return angles[index] ?? angles[0];
}
