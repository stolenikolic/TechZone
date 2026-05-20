/** Normalizovan URL (pathname + query) za lanac filter klikova bez stale searchParams. */

export function toFilterUrlSnapshot(pathname: string, searchParams: URLSearchParams | string): string {
  const qs =
    typeof searchParams === "string" ? searchParams : searchParams.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function parseFilterUrlSnapshot(snapshot: string): {
  pathname: string;
  params: URLSearchParams;
} {
  const qIndex = snapshot.indexOf("?");
  if (qIndex === -1) {
    return { pathname: snapshot, params: new URLSearchParams() };
  }
  return {
    pathname: snapshot.slice(0, qIndex),
    params: new URLSearchParams(snapshot.slice(qIndex + 1))
  };
}

export function cloneFilterParams(params: URLSearchParams): URLSearchParams {
  return new URLSearchParams(params.toString());
}
