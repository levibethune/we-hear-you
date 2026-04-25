"use client";

import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { resetPassword } from "../lib/auth";

export function LoginForm() {
  const { error, signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [submitting, setSubmitting] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError || error;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSignupSuccess(false);
    setResetSent(false);
    setLocalError(null);

    if (mode === "forgot") {
      const result = await resetPassword(email.trim());
      if (result.error) {
        setLocalError(result.error);
      } else {
        setResetSent(true);
      }
    } else if (mode === "signup") {
      const result = await signUp(email.trim(), password);
      if (!result.error) {
        setSignupSuccess(true);
      }
    } else {
      await signIn(email.trim(), password);
    }

    setSubmitting(false);
  }

  if (signupSuccess) {
    return (
      <div className="flex flex-col gap-3 text-center w-full">
        <p className="text-sm text-seafoam font-medium">Account created</p>
        <p className="text-sm text-muted">
          Check your email to confirm your account, then sign in.
        </p>
        <button
          onClick={() => { setMode("signin"); setSignupSuccess(false); }}
          className="text-sm text-accent hover:underline mt-2"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  if (resetSent) {
    return (
      <div className="flex flex-col gap-3 text-center w-full">
        <p className="text-sm text-seafoam font-medium">Reset link sent</p>
        <p className="text-sm text-muted">
          Check your email for a link to reset your password.
        </p>
        <button
          onClick={() => { setMode("signin"); setResetSent(false); }}
          className="text-sm text-accent hover:underline mt-2"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
      {mode === "signup" && (
        <div className="text-center mb-2">
          <h2 className="text-base font-semibold mb-1">Create your account</h2>
          <p className="text-xs text-muted">
            Your email domain must match an existing organization. Ask your admin to invite you if you&apos;re not sure.
          </p>
        </div>
      )}
      {mode === "forgot" && (
        <div className="text-center mb-2">
          <h2 className="text-base font-semibold mb-1">Reset your password</h2>
          <p className="text-xs text-muted">
            Enter the email address on your account and we&apos;ll send you a reset link.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-sm text-muted">Email address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          required
          autoFocus
          className="text-base"
        />
      </div>

      {mode !== "forgot" && (
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Create a password" : "Enter your password"}
            required
            minLength={6}
            className="text-base"
          />
        </div>
      )}

      {displayError && <p className="text-sm text-negative">{displayError}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-accent text-white rounded-xl px-4 py-3 font-medium hover:bg-accent-hover transition-all shadow-[0_2px_8px_rgba(244,160,122,0.25)] hover:shadow-[0_4px_12px_rgba(244,160,122,0.35)] disabled:opacity-50"
      >
        {submitting
          ? (mode === "forgot" ? "Sending..." : mode === "signup" ? "Creating account..." : "Signing in...")
          : (mode === "forgot" ? "Send reset link" : mode === "signup" ? "Create account" : "Sign in")}
      </button>

      <div className="flex flex-col items-center gap-2">
        {mode === "signin" && (
          <button
            type="button"
            onClick={() => { setMode("forgot"); setLocalError(null); }}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Forgot your password?
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : mode === "forgot" ? "signin" : "signup");
            setLocalError(null);
          }}
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          {mode === "signin"
            ? "Don\u2019t have an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </form>
  );
}
