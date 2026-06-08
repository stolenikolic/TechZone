import { COLOR_TRANSLATIONS } from "lib/attributes/dictionaries/color-translations";

/** Attribute slugs that receive global color translation during enrichment. */
const COLOR_ATTRIBUTE_SLUGS = new Set([
  "color",
  "colour",
  "boja",
  "case_color",
  "product_color",
  "primary_color"
]);

const COLOR_TOKEN_SPLIT = /\s+-\s+|\s*\/\s*|\s*,\s*|\s+&\s+|\s+and\s+/i;
const OUTPUT_SEPARATOR = " - ";

function lookupColorTranslation(token: string): string | null {
  const key = token.trim().toLowerCase();
  if (!key) return null;
  return COLOR_TRANSLATIONS[key] ?? null;
}

export function isColorAttributeSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  if (COLOR_ATTRIBUTE_SLUGS.has(slug)) return true;
  if (slug.endsWith("_color") && !slug.includes("temperature")) return true;
  return false;
}

/**
 * Splits combinations (Black - Brown, Fekete/Barna), translates only known basic tokens.
 * Unknown tokens (e.g. "Space white") stay unchanged. Output always uses " - ".
 * Returns null when no token was translated (caller keeps raw value).
 */
export function normalizeColorValue(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  const tokens = trimmed
    .split(COLOR_TOKEN_SPLIT)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return null;

  let anyTranslated = false;
  const out: string[] = [];

  for (const token of tokens) {
    const translated = lookupColorTranslation(token);
    if (translated) {
      anyTranslated = true;
      out.push(translated);
    } else {
      out.push(token);
    }
  }

  if (!anyTranslated) return null;

  return out.join(OUTPUT_SEPARATOR);
}
