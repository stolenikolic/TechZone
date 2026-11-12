/** media.icdn.hu URLs found in iPon HTML. No storage or network imports. */

const ICDN_RE = /https?:\/\/media\.icdn\.hu\/[^\s"'<>\\)]+/gi;

export function extractIcdnImageUrls(html: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = new RegExp(ICDN_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const url = match[0].replace(/&amp;/g, "&").replace(/[),.;]+$/g, "");
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function imagePath(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    return new URL(url.trim()).pathname;
  } catch {
    return url.split("?")[0] ?? null;
  }
}

/** Drops the feed main image (same pathname, ignore query/size variants). */
export function galleryUrlsExcludingMain(urls: string[], mainUrl: string | null | undefined): string[] {
  const main = imagePath(mainUrl);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    const path = imagePath(url);
    if (main && path === main) continue;
    const key = path ?? url;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(url);
  }
  return out;
}
