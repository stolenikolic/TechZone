/**
 * Preload for GitHub Actions / Node < 22: Supabase realtime-js needs WebSocket.
 * Usage: npx tsx -r ./scripts/register-ws.cjs scripts/run-aggregate-prices.ts
 */
"use strict";

const WebSocketImpl = require("ws");
global.WebSocket = WebSocketImpl;
globalThis.WebSocket = WebSocketImpl;
