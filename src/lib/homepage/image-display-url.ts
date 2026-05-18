/** Bust browser/CDN cache for homepage image URLs in admin preview. */
export function homepageImageDisplayUrl(url: string, cacheToken: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("blob:")) return trimmed;
  const token = cacheToken.trim();
  if (!token) return trimmed;
  const separator = trimmed.includes("?") ? "&" : "?";
  return `${trimmed}${separator}v=${encodeURIComponent(token)}`;
}
