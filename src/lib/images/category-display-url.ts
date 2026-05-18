/**
 * Ensures category image URLs bust browser + Next/Image optimizer caches.
 * Versioned storage paths include a timestamp in the filename; legacy `{id}.webp` gets a static bust param.
 */
export function categoryImageDisplayUrl(imageUrl: string | null | undefined): string {
  const trimmed = imageUrl?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return trimmed;

  const versionMatch = trimmed.match(/\/(\d{10,13})\.webp(?:\?|$)/i);
  if (versionMatch) {
    const token = versionMatch[1];
    if (trimmed.includes("v=")) return trimmed;
    const separator = trimmed.includes("?") ? "&" : "?";
    return `${trimmed}${separator}v=${token}`;
  }

  if (trimmed.includes("v=")) return trimmed;
  const separator = trimmed.includes("?") ? "&" : "?";
  return `${trimmed}${separator}v=1`;
}
