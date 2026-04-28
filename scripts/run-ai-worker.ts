/**
 * Standalone entry point for the AI attribute worker.
 * Run with: npm run worker:ai  or  npx tsx scripts/run-ai-worker.ts
 * Requires: .env.local (or .env) with OPENAI_API_KEY, SUPABASE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { runWorker } from "../src/lib/ai/worker";

runWorker();
