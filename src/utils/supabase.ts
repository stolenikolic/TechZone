import { createClient } from "@supabase/supabase-js";
import {
  hasSupabasePublicConfig,
  hasSupabaseServerConfig,
  requireSupabaseUrl,
  supabaseAnonKey,
  supabaseServiceKey
} from "./supabase/config";
import { getSupabaseNodeClientOptions } from "./supabase/node-client-options";

export { hasSupabasePublicConfig, hasSupabaseServerConfig };

/**
 * Legacy singleton-style client (no cookie session). Prefer createSupabaseBrowserClient / createSupabaseServerClient.
 */
export function createSupabaseClient() {
  if (!supabaseAnonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set");
  }
  return createClient(requireSupabaseUrl(), supabaseAnonKey, getSupabaseNodeClientOptions());
}

/**
 * Service role — server-only (jobs, migrations, admin data after auth check).
 */
export function createSupabaseServiceClient() {
  if (!supabaseServiceKey) {
    throw new Error(
      "Supabase service key is not set. Add SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY to your environment (e.g. .env.local). See .env.example."
    );
  }
  return createClient(requireSupabaseUrl(), supabaseServiceKey, getSupabaseNodeClientOptions());
}
