import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "utils/supabase/server";
import type { AppRole, UserProfile } from "./types";

export async function getAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone, avatar_url, role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as UserProfile;
}

export async function getSessionProfile(): Promise<UserProfile | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const profile = await getUserProfile(user.id);
  if (!profile) return null;

  return { ...profile, email: user.email ?? undefined };
}

export async function requireUser(redirectTo = "/login") {
  const user = await getAuthUser();
  if (!user) redirect(redirectTo);
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  const profile = await getUserProfile(user.id);
  if (!profile || profile.role !== "admin") {
    redirect("/login?next=/admin");
  }
  return { user, profile };
}

export { isAdminRole } from "./roles";
