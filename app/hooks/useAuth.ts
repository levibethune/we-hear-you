"use client";

import { useState, useEffect, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase-browser";
import { identifyUser, resetUser, track } from "../lib/analytics";
import { signIn, signUp, signOut } from "../lib/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) identifyUser(data.user.id, { email: data.user.email });
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignIn = useCallback(async (email: string, password: string) => {
    setError(null);
    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error);
      track("sign_in_failed", { email });
    } else {
      setUser(result.user);
      if (result.user) identifyUser(result.user.id, { email: result.user.email });
      track("sign_in", { email });
    }
    return result;
  }, []);

  const handleSignUp = useCallback(async (email: string, password: string) => {
    setError(null);
    const result = await signUp(email, password);
    if (result.error) {
      setError(result.error);
    } else {
      setUser(result.user);
      track("sign_up", { email });
    }
    return result;
  }, []);

  const handleSignOut = useCallback(async () => {
    track("sign_out");
    resetUser();
    await signOut();
    setUser(null);
  }, []);

  return {
    user,
    loading,
    error,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
  };
}
