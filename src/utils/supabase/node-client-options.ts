import type { SupabaseClientOptions } from "@supabase/supabase-js";

function nodeMajorVersion(): number | null {
  if (typeof process === "undefined" || !process.versions?.node) return null;
  return parseInt(process.versions.node.replace(/^v/, "").split(".")[0], 10);
}

/**
 * Node.js < 22: realtime-js rejects the runtime unless `ws` is passed as transport.
 * Node 20 may define experimental globalThis.WebSocket — we still must pass `ws`.
 */
export function getSupabaseNodeClientOptions(): SupabaseClientOptions<"public"> | undefined {
  const major = nodeMajorVersion();
  if (major == null) return undefined;
  if (major >= 22 && typeof globalThis.WebSocket !== "undefined") return undefined;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const WebSocketImpl = require("ws") as typeof WebSocket;
  globalThis.WebSocket = WebSocketImpl;

  return {
    realtime: { transport: WebSocketImpl }
  };
}
