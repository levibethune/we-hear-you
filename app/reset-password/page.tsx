"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase-browser";
import { updatePassword } from "../lib/auth";
import { Logo } from "../components/Logo";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);

  // Wait for Supabase to pick up the recovery token from the URL
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // Also check if there's already a session (e.g., token was already processed)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords don\u2019t match.");
      return;
    }

    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => router.replace("/dashboard"), 2000);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="soft-card px-8 py-10 w-full max-w-sm">
        <div className="mb-6 text-center flex flex-col items-center gap-2">
          <Logo size="md" linked={false} />
          <h1 className="text-lg font-bold">Reset Password</h1>
          <p className="text-muted text-sm mt-1">Choose a new password for your account.</p>
        </div>

        {success ? (
          <div className="text-center">
            <p className="text-sm text-seafoam font-medium">Password updated</p>
            <p className="text-sm text-muted mt-1">Redirecting to your dashboard...</p>
          </div>
        ) : !ready ? (
          <div className="text-center">
            <p className="text-sm text-muted">Verifying your reset link...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
                minLength={6}
                autoFocus
                className="text-base"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm text-muted">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Type it again"
                required
                minLength={6}
                className="text-base"
              />
            </div>
            {error && <p className="text-sm text-negative">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="bg-accent text-white rounded-xl px-4 py-3 font-medium hover:bg-accent-hover transition-all shadow-[0_2px_8px_rgba(244,160,122,0.25)] hover:shadow-[0_4px_12px_rgba(244,160,122,0.35)] disabled:opacity-50"
            >
              {submitting ? "Updating..." : "Update password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
