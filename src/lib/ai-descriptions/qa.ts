import {
  ALLOWED_HTML_TAGS,
  BANNED_PHRASES,
  TARGET_WORD_COUNT_MAX,
  TARGET_WORD_COUNT_MIN
} from "lib/ai-descriptions/constants";
import type { AiDescriptionOutput, PromptSpecLine } from "lib/ai-descriptions/types";

export type QaResult = { ok: true } | { ok: false; reasons: string[] };

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function countWords(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function extractNumbers(text: string): string[] {
  const matches = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  return matches.map((n) => n.replace(",", "."));
}

function numberExistsInSources(num: string, sources: string[]): boolean {
  const normalized = num.replace(/\.0+$/, "");
  for (const src of sources) {
    const srcNums = extractNumbers(src);
    if (srcNums.some((s) => s === num || s === normalized || s.replace(/\.0+$/, "") === normalized)) {
      return true;
    }
  }
  return false;
}

function validateHtmlTags(html: string): string[] {
  const reasons: string[] = [];
  const tagRegex = /<\/?([a-z0-9]+)\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  const allowed = new Set(ALLOWED_HTML_TAGS);
  while ((match = tagRegex.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    if (!allowed.has(tag as (typeof ALLOWED_HTML_TAGS)[number])) {
      reasons.push(`Nedozvoljen HTML tag: <${tag}>`);
    }
  }
  return reasons;
}

export function validateAiDescriptionOutput(
  output: AiDescriptionOutput,
  productName: string,
  specs: PromptSpecLine[]
): QaResult {
  const reasons: string[] = [];

  if (!output.description_html?.trim()) reasons.push("description_html je prazan");
  if (!output.meta_description?.trim()) reasons.push("meta_description je prazan");
  if (!output.title_suggestion?.trim()) reasons.push("title_suggestion je prazan");
  if (!output.og_description?.trim()) reasons.push("og_description je prazan");
  if (!Array.isArray(output.faq) || output.faq.length < 2) {
    reasons.push("faq mora imati najmanje 2 pitanja");
  }

  const plain = stripHtml(output.description_html ?? "");
  const wordCount = countWords(plain);
  if (wordCount < TARGET_WORD_COUNT_MIN || wordCount > TARGET_WORD_COUNT_MAX) {
    reasons.push(`Dužina opisa ${wordCount} riječi (očekivano ${TARGET_WORD_COUNT_MIN}-${TARGET_WORD_COUNT_MAX})`);
  }

  const lowerCombined = `${plain} ${output.meta_description} ${output.og_description}`.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lowerCombined.includes(phrase.toLowerCase())) {
      reasons.push(`Zabranjena fraza: "${phrase}"`);
    }
  }

  reasons.push(...validateHtmlTags(output.description_html ?? ""));

  if ((output.meta_description?.length ?? 0) > 155) {
    reasons.push("meta_description prelazi 155 karaktera");
  }
  if ((output.og_description?.length ?? 0) > 150) {
    reasons.push("og_description prelazi 150 karaktera");
  }
  if ((output.title_suggestion?.length ?? 0) > 60) {
    reasons.push("title_suggestion prelazi 60 karaktera");
  }

  const sources = [productName, ...specs.map((s) => `${s.label} ${s.value}`)];
  const allText = `${plain} ${output.meta_description} ${(output.faq ?? []).map((f) => `${f.q} ${f.a}`).join(" ")}`;
  for (const num of extractNumbers(allText)) {
    if (!numberExistsInSources(num, sources)) {
      reasons.push(`Broj "${num}" nije u specifikacijama ili nazivu`);
    }
  }

  if (reasons.length > 0) return { ok: false, reasons };
  return { ok: true };
}

export function parseAiDescriptionJson(raw: string): AiDescriptionOutput {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const firstBrace = text.indexOf("{");
  if (firstBrace !== -1) {
    const lastBrace = text.lastIndexOf("}");
    if (lastBrace > firstBrace) text = text.slice(firstBrace, lastBrace + 1);
  }
  const parsed = JSON.parse(text) as Partial<AiDescriptionOutput>;
  if (!parsed.description_html || !parsed.meta_description || !parsed.title_suggestion || !parsed.og_description) {
    throw new Error("AI JSON missing required fields");
  }
  const faq = Array.isArray(parsed.faq)
    ? parsed.faq
        .filter((item): item is { q: string; a: string } => Boolean(item?.q && item?.a))
        .map((item) => ({ q: String(item.q).trim(), a: String(item.a).trim() }))
    : [];
  return {
    description_html: String(parsed.description_html).trim(),
    meta_description: String(parsed.meta_description).trim(),
    title_suggestion: String(parsed.title_suggestion).trim(),
    og_description: String(parsed.og_description).trim(),
    faq
  };
}
