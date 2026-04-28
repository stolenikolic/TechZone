import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase client for browser and server (uses anon key).
 * Use for authenticated user operations and public data.
 */
export function createSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Supabase client with service role key. Use only in server-side code (API routes, Server Components, server actions).
 * Bypasses RLS – never expose or use in client components.
 */
export function createSupabaseServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(supabaseUrl, serviceRoleKey);
}
