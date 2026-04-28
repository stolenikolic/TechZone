/**
 * Kratki retry za privremene mrežne greške prema Supabase (Node fetch).
 * Koristi se u import/sync skriptama; nije za poslovnu logiku (RLS, validacija).
 */

import { sleep } from "./ipon-fetch";

const TRANSIENT =
  /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|socket hang up|EAI_AGAIN|getaddrinfo|certificate|TLS|SSL/i;

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
      const msg = e instanceof Error ? e.message : String(e);
      if (i < attempts - 1 && isTransientSupabaseNetworkError(msg)) {
        console.warn(`[iPon] ${label} threw: ${msg} — retry ${i + 2}/${attempts}`);
        await sleep(baseDelayMs * (i + 1));
        continue;
      }
      throw e;
    }
  }

  throw new Error(`[iPon] ${label}: exhausted retries (unexpected)`);
}
