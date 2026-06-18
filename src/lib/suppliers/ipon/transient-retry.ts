/**
 * Kratki retry za privremene mrežne greške (Supabase PostgREST i iPon HTTP).
 * Koristi se u import/sync skriptama; nije za poslovnu logiku (RLS, validacija).
 */

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const TRANSIENT =
  /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|socket hang up|EAI_AGAIN|getaddrinfo|certificate|TLS|SSL|other side closed|UND_ERR_SOCKET|UND_ERR_CONNECT_TIMEOUT|ECONNABORTED/i;

/** Poruke iz Error lanca (message + cause + code) za detekciju privremenih grešaka. */
export function errorMessageChain(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  while (current) {
    if (current instanceof Error) {
      parts.push(current.message);
      const code = (current as Error & { code?: unknown }).code;
      if (typeof code === "string") parts.push(code);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join(" | ");
}

export function isTransientNetworkError(error: unknown): boolean {
  return TRANSIENT.test(errorMessageChain(error));
}

export function isTransientSupabaseNetworkError(message: string): boolean {
  return TRANSIENT.test(message);
}

/**
 * Ponavlja `fn` dok ne uspije (`!error`) ili dok greška nije privremena mrežna.
 * Hvata i throw (npr. TypeError: fetch failed) i `{ error }` iz PostgREST klijenta.
 */
export async function withPostgrestTransientRetry<R extends { error: { message: string } | null }>(
  label: string,
  fn: () => Promise<R>,
  options?: { attempts?: number; baseDelayMs?: number }
): Promise<R> {
  const attempts = options?.attempts ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 700;

  for (let i = 0; i < attempts; i++) {
    try {
      const result = await fn();
      if (!result.error) return result;
      const msg = result.error.message;
      if (i < attempts - 1 && isTransientSupabaseNetworkError(msg)) {
        console.warn(`[iPon] ${label}: ${msg} — retry ${i + 2}/${attempts}`);
        await sleep(baseDelayMs * (i + 1));
        continue;
      }
      return result;
    } catch (e) {
      if (i < attempts - 1 && isTransientNetworkError(e)) {
        console.warn(`[iPon] ${label} threw: ${errorMessageChain(e)} — retry ${i + 2}/${attempts}`);
        await sleep(baseDelayMs * (i + 1));
        continue;
      }
      throw e;
    }
  }

  throw new Error(`[iPon] ${label}: exhausted retries (unexpected)`);
}

export type WithTransientHttpRetryOptions<T> = {
  attempts?: number;
  backoffMs?: readonly number[];
  onBeforeRetry?: (attempt: number, error: unknown) => Promise<void>;
  isRetryableResponse?: (value: T) => boolean;
};

/**
 * Retry za iPon (i slične) HTTP pozive — hvata throw i opciono retryable Response status.
 */
export async function withTransientHttpRetry<T>(
  label: string,
  fn: () => Promise<T>,
  options?: WithTransientHttpRetryOptions<T>
): Promise<T> {
  const backoffMs = options?.backoffMs ?? ([2000, 5000, 10000] as const);
  const attempts = options?.attempts ?? 1 + backoffMs.length;

  for (let i = 0; i < attempts; i++) {
    try {
      const result = await fn();
      if (options?.isRetryableResponse?.(result) && i < attempts - 1) {
        console.warn(`[iPon][retry] ${label}: retryable HTTP status — retry ${i + 2}/${attempts}`);
        if (options.onBeforeRetry) await options.onBeforeRetry(i + 1, null);
        await sleep(backoffMs[i] ?? backoffMs[backoffMs.length - 1]!);
        continue;
      }
      return result;
    } catch (e) {
      if (i < attempts - 1 && isTransientNetworkError(e)) {
        console.warn(`[iPon][retry] ${label}: ${errorMessageChain(e)} — retry ${i + 2}/${attempts}`);
        if (options?.onBeforeRetry) await options.onBeforeRetry(i + 1, e);
        await sleep(backoffMs[i] ?? backoffMs[backoffMs.length - 1]!);
        continue;
      }
      throw e;
    }
  }

  throw new Error(`[iPon][retry] ${label}: exhausted retries (unexpected)`);
}
