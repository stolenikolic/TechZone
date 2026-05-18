function fetchHeadersForImageUrl(url: string): HeadersInit {
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
    Accept: "image/*,image/webp,image/apng,*/*;q=0.8"
  };

  try {
    const origin = new URL(url).origin;
    headers.Referer = `${origin}/`;
  } catch {
    // ignore invalid URL
  }

  return headers;
}

/**
 * Download image bytes from a remote URL (supplier CDN, manufacturer sites, etc.).
 */
export async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: fetchHeadersForImageUrl(url),
    next: { revalidate: 0 }
  });
  if (!res.ok) {
    throw new Error(`Image fetch failed: ${res.status} ${res.statusText} for ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
