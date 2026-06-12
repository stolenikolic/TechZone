/** Writing angles rotated deterministically per product to reduce duplicate phrasing. */
export const DESCRIPTION_ANGLES = [
  "praktična upotreba",
  "za koga je idealan",
  "šta dobijaš",
  "ključne prednosti"
] as const;

/** Banned cliché phrases (case-insensitive substring match). */
export const BANNED_PHRASES = [
  "u današnjem svijetu",
  "kada je riječ o",
  "nesumnjivo",
  "savršen izbor za sve",
  "bez sumnje",
  "revolucionaran",
  "najbolji na tržištu",
  "nezaobilazan",
  "apsolutno savršen"
] as const;

export const ALLOWED_HTML_TAGS = ["p", "ul", "li", "strong", "h2", "h3"] as const;

export const TARGET_WORD_COUNT_MIN = 120;
export const TARGET_WORD_COUNT_MAX = 320;

export const MAX_SPECS_IN_PROMPT = 8;
export const MIN_SPECS_TO_GENERATE = 3;

export const DEFAULT_MODEL =
  process.env.AI_DESCRIPTIONS_MODEL?.trim() || "gemini-2.0-flash";
