"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "utils/supabase/browser";
import type { UserProfile } from "lib/auth/types";
import { signOut as authSignOut } from "lib/auth/actions";

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(
    async (supabase: ReturnType<typeof createSupabaseBrowserClient>, userId: string) => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, phone, avatar_url, role")
          .eq("id", userId)
          .maybeSingle();

        if (error) {
          console.warn("[Auth] profiles fetch:", error.message);
          return null;
        }

        return (data as UserProfile | null) ?? null;
      } catch (err) {
        console.warn("[Auth] profiles fetch failed:", err);
        return null;
      }
    },
    []
  );

  const applySessionUser = useCallback(
    async (supabase: ReturnType<typeof createSupabaseBrowserClient>, currentUser: User | null) => {
      setUser(currentUser);
      if (!currentUser) {
        setProfile(null);
        return;
      }

      // Load profile in background — do not block header / loading state.
      const p = await loadProfile(supabase, currentUser.id);
      setProfile(p ? { ...p, email: currentUser.email ?? undefined } : null);
    },
    [loadProfile]
  );

  const refresh = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();
    await applySessionUser(supabase, session?.user ?? null);
  }, [applySessionUser]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let mounted = true;

    const bootstrap = async () => {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();
        if (!mounted) return;
        setUser(session?.user ?? null);
        if (session?.user) {
          void loadProfile(supabase, session.user.id).then((p) => {
            if (!mounted) return;
            setProfile(p ? { ...p, email: session.user.email ?? undefined } : null);
          });
        }
      } catch (err) {
        console.warn("[Auth] bootstrap failed:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void bootstrap();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setLoading(false);

      if (!nextUser) {
        setProfile(null);
        return;
      }

      // Defer Supabase data calls — awaiting inside this callback can deadlock auth.
      setTimeout(() => {
        if (!mounted) return;
        void loadProfile(supabase, nextUser.id).then((p) => {
          if (!mounted) return;
          setProfile(p ? { ...p, email: nextUser.email ?? undefined } : null);
        });
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    await authSignOut();
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isAdmin: profile?.role === "admin",
      refresh,
      signOut
    }),
    [user, profile, loading, refresh, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
