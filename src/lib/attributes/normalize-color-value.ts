import {
  COLOR_MODIFIER_PREFIXES,
  COLOR_TRANSLATIONS
} from "lib/attributes/dictionaries/color-translations";

/** Attribute slugs that receive global color translation during enrichment. */
const COLOR_ATTRIBUTE_SLUGS = new Set([
  "color",
  "colour",
  "boja",
  "case_color",
  "product_color",
  "primary_color"
]);

/** Split combined colors; hyphen works with or without spaces (White-Brown, Black - Brown). */
const COLOR_TOKEN_SPLIT = /\s*-\s*|\s*\/\s*|\s*,\s*|\s+&\s+|\s+and\s+/i;
const OUTPUT_SEPARATOR = " - ";

const MODIFIER_PREFIX_PATTERN =
  /^(dark|light|világos|vilagos|sötét|sotet)\s+(.+)$/i;

function lookupBaseColor(key: string): string | null {
  const normalized = key.trim().toLowerCase();
  if (!normalized) return null;
  return COLOR_TRANSLATIONS[normalized] ?? null;
}

function translateColorToken(token: string): { value: string; translated: boolean } {
  const trimmed = token.trim();
  if (!trimmed) return { value: trimmed, translated: false };

  const direct = lookupBaseColor(trimmed);
  if (direct) return { value: direct, translated: true };

  const modifierMatch = trimmed.match(MODIFIER_PREFIX_PATTERN);
  if (modifierMatch) {
    const modifierKey = modifierMatch[1].toLowerCase();
    const baseKey = modifierMatch[2].trim().toLowerCase();
    const modifier = COLOR_MODIFIER_PREFIXES[modifierKey];
    const base = lookupBaseColor(baseKey);
    if (modifier && base) {
      return { value: `${modifier} ${base}`, translated: true };
    }
  }

  return { value: trimmed, translated: false };
}

export function isColorAttributeSlug(slug: string | null | undefined): boolean {
  if (!slug) return false;
  if (COLOR_ATTRIBUTE_SLUGS.has(slug)) return true;
  if (slug.endsWith("_color") && !slug.includes("temperature")) return true;
  return false;
}

/**
 * Splits combinations (Black - Brown, White-Brown), translates tokens.
 * Modifiers: dark green → Tamno zelena (space, no extra "-").
 * Unknown tokens (e.g. "Space white") stay unchanged.
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
    const { value, translated } = translateColorToken(token);
    if (translated) anyTranslated = true;
    out.push(value);
  }

  if (!anyTranslated) return null;

  return out.join(OUTPUT_SEPARATOR);
}
