const ALLOWED_TAGS = new Set(["p", "ul", "li", "strong", "h2", "h3"]);

/** Elements whose inner markup must not be reparsed as HTML. */
const DROP_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "noscript",
  "noframes",
  "noembed",
  "template",
  "textarea",
  "title",
  "svg",
  "math",
  "xmp",
  "plaintext"
]);

type Tag = { name: string; closing: boolean; end: number };

function isNameStart(char: string): boolean {
  return (char >= "A" && char <= "Z") || (char >= "a" && char <= "z");
}

function isNameChar(char: string): boolean {
  return isNameStart(char) || (char >= "0" && char <= "9");
}

function escapeText(text: string): string {
  return text
    .replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]+|#[0-9]+|#x[0-9a-fA-F]+);)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Read one tag starting at `<`. Returns null when the `<` is not a tag. */
function readTag(input: string, start: number): Tag | null {
  let i = start + 1;
  if (i >= input.length) return null;

  let closing = false;
  if (input[i] === "/") {
    closing = true;
    i += 1;
  }
  if (i >= input.length || !isNameStart(input[i])) return null;

  const nameStart = i;
  i += 1;
  while (i < input.length && isNameChar(input[i])) i += 1;
  const name = input.slice(nameStart, i).toLowerCase();

  let quote: '"' | "'" | null = null;
  while (i < input.length) {
    const char = input[i];
    if (quote) {
      if (char === quote) quote = null;
      i += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      i += 1;
      continue;
    }
    if (char === ">") return { name, closing, end: i + 1 };
    i += 1;
  }
  return null;
}

function skipMarkup(input: string, start: number): number | null {
  if (input.startsWith("<!--", start)) {
    const end = input.indexOf("-->", start + 4);
    return end === -1 ? input.length : end + 3;
  }
  if (input.startsWith("<![CDATA[", start)) {
    const end = input.indexOf("]]>", start + 9);
    return end === -1 ? input.length : end + 3;
  }
  if (input.startsWith("<?", start)) {
    const end = input.indexOf("?>", start + 2);
    return end === -1 ? input.length : end + 2;
  }
  if (input.startsWith("<!", start)) {
    const end = input.indexOf(">", start + 2);
    return end === -1 ? input.length : end + 1;
  }
  return null;
}

function isSelfClosing(input: string, tagEnd: number): boolean {
  let i = tagEnd - 2;
  while (
    i > 0 &&
    (input[i] === " " || input[i] === "\n" || input[i] === "\r" || input[i] === "\t")
  ) {
    i -= 1;
  }
  return input[i] === "/";
}

/** Skip a raw/foreign element through its matching end tag, or to the end of the string. */
function skipElement(input: string, from: number, name: string): number {
  let depth = 1;
  let i = from;
  while (i < input.length && depth > 0) {
    const next = input.indexOf("<", i);
    if (next === -1) return input.length;
    const tag = readTag(input, next);
    if (!tag) {
      i = next + 1;
      continue;
    }
    if (tag.name === name) {
      if (tag.closing) depth -= 1;
      else if (!isSelfClosing(input, tag.end)) depth += 1;
    }
    i = tag.end;
  }
  return i;
}

/**
 * Sanitize AI product description HTML.
 * Keeps p, ul, li, strong, h2 and h3, and drops every attribute.
 * Does not use a DOM parser: jsdom's encoding sniffer currently require()s an ESM package and crashes SSR.
 */
export function sanitizeProductHtml(html: string): string {
  const input = html.replace(/\u0000/g, "");
  let out = "";
  let i = 0;

  while (i < input.length) {
    const lt = input.indexOf("<", i);
    if (lt === -1) {
      out += escapeText(input.slice(i));
      break;
    }

    out += escapeText(input.slice(i, lt));
    const skipped = skipMarkup(input, lt);
    if (skipped !== null) {
      i = skipped;
      continue;
    }

    const tag = readTag(input, lt);
    if (!tag) {
      out += "&lt;";
      i = lt + 1;
      continue;
    }

    if (!tag.closing && DROP_WITH_CONTENT.has(tag.name) && !isSelfClosing(input, tag.end)) {
      i = skipElement(input, tag.end, tag.name);
      continue;
    }

    if (ALLOWED_TAGS.has(tag.name)) {
      out += tag.closing ? `</${tag.name}>` : `<${tag.name}>`;
    }
    i = tag.end;
  }

  return out;
}
