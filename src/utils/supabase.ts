import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export function hasSupabasePublicConfig() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function hasSupabaseServerConfig() {
  return Boolean(supabaseUrl && supabaseSecretKey);
}

function requireSupabaseUrl() {
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }

  return supabaseUrl;
}

/**
 * Supabase client for browser and server (uses publishable key).
 * Use for authenticated user operations and public data.
 */
export function createSupabaseClient() {
  if (!supabasePublishableKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set");
  }

  return createClient(requireSupabaseUrl(), supabasePublishableKey);
}

/**
 * Supabase client with secret key. Use only in server-side code (API routes, Server Components, server actions).
 * Never expose or use this key in client components.
 */
export function createSupabaseServiceClient() {
  if (!supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY is not set");
  }
  return createClient(requireSupabaseUrl(), supabaseSecretKey);
}
