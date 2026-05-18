import { createBrowserClient } from "@supabase/ssr";
import { requireSupabaseAnonKey, requireSupabaseUrl } from "./config";

export function createSupabaseBrowserClient() {
  return createBrowserClient(requireSupabaseUrl(), requireSupabaseAnonKey());
}
