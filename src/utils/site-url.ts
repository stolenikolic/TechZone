function withProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export function getServerBaseUrl(): string {
  // SSR admin/data fetches must hit this Next process in dev — not production SITE_URL.
  if (process.env.NODE_ENV === "development") {
    const port = process.env.PORT ?? "3000";
    return `http://127.0.0.1:${port}`;
  }

  const url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.VERCEL_URL;

  return url ? withProtocol(url).replace(/\/$/, "") : "http://localhost:3000";
}
