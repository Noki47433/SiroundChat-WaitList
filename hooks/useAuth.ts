"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isAuthDisabledClient } from "@/lib/config/public";

interface AuthState {
  user: User | null;
  loading: boolean;
}

const DEMO_USER: User = {
  id: "demo-user",
  email: "demo@siroundchat.app",
  phone: "",
  app_metadata: { provider: "demo" },
  user_metadata: { full_name: "SiroundChat Demo" },
  aud: "authenticated",
  role: "authenticated",
  created_at: "2023-01-01T00:00:00.000Z",
  updated_at: "2023-01-01T00:00:00.000Z",
  last_sign_in_at: "2023-01-01T00:00:00.000Z",
  confirmed_at: "2023-01-01T00:00:00.000Z",
  email_confirmed_at: "2023-01-01T00:00:00.000Z",
  phone_confirmed_at: null,
  identities: [],
  factors: [],
  factor_ids: []
} as unknown as User;

const getDemoState = (): AuthState => ({ user: DEMO_USER, loading: false });

export function useAuth() {
  const authDisabled = isAuthDisabledClient();
  const [state, setState] = useState<AuthState>(() => (authDisabled ? getDemoState() : { user: null, loading: true }));

  useEffect(() => {
    if (authDisabled) {
      setState(getDemoState());
      return;
    }

    const supabase = getSupabaseBrowserClient();
    let active = true;

    supabase.auth
      .getUser()
      .then((result: { data: { user: User | null } }) => {
        if (!active) return;
        setState({ user: result.data.user ?? null, loading: false });
      })
      .catch(() => {
        if (!active) return;
        setState({ user: null, loading: false });
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      if (!active) return;
      setState({ user: session?.user ?? null, loading: false });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [authDisabled]);

  const login = useCallback(
    async (email: string, password: string) => {
      if (authDisabled) {
        setState(getDemoState());
        return;
      }
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) throw new Error("Login failed");
    },
    [authDisabled]
  );

  const register = useCallback(
    async (payload: { name: string; email: string; password: string; businessName: string; industry: string }) => {
      if (authDisabled) {
        setState(getDemoState());
        return;
      }
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Registration failed");
    },
    [authDisabled]
  );

  const logout = useCallback(async () => {
    if (authDisabled) {
      setState(getDemoState());
      return;
    }
    await fetch("/auth/logout", { method: "POST" });
    await getSupabaseBrowserClient().auth.signOut();
  }, [authDisabled]);

  return { ...state, login, register, logout };
}
