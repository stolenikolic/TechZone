"use client";

import type { Provider } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "utils/supabase/browser";
import { getAuthCallbackUrl, getPasswordResetRedirectUrl } from "./paths";

export async function signInWithEmail(email: string, password: string) {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(email: string, password: string, fullName: string) {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: getAuthCallbackUrl()
    }
  });
}

export async function resetPasswordForEmail(email: string) {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetRedirectUrl()
  });
}

export async function resendSignupConfirmation(email: string) {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: getAuthCallbackUrl() }
  });
}

export async function signInWithOAuth(provider: Provider) {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: getAuthCallbackUrl() }
  });
}

export async function signOut() {
  const supabase = createSupabaseBrowserClient();
  return supabase.auth.signOut();
}
