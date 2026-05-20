import type { SupabaseClientOptions } from "@supabase/supabase-js";

/**
 * Node.js < 22 has no native WebSocket; @supabase/realtime-js requires one at client init.
 * Browser and Node 22+ skip this. Used by service scripts and GitHub Actions.
 */
export function getSupabaseNodeClientOptions(): SupabaseClientOptions | undefined {
  if (typeof globalThis.WebSocket !== "undefined") {
    return undefined;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const WebSocketImpl = require("ws") as typeof import("ws");
  return {
    realtime: { transport: WebSocketImpl as unknown as typeof WebSocket },
    global: { WebSocket: WebSocketImpl as unknown as typeof WebSocket }
  };
}
