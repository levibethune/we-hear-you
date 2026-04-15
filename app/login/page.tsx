"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "../components/LoginForm";
import { useAuth } from "../hooks/useAuth";
import { Logo } from "../components/Logo";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="soft-card px-8 py-10 w-full max-w-sm">
        <div className="mb-8 text-center flex flex-col items-center gap-2">
          <Logo size="md" linked={false} />
          <p className="text-muted text-sm">Sign in to your dashboard</p>
        </div>
        {loading ? (
          <p className="text-sm text-muted text-center">Loading...</p>
        ) : (
          <LoginForm />
        )}
      </div>

      <div className="flex items-center gap-4 mt-6">
        <Link href="/privacy" className="text-xs text-muted hover:text-foreground transition-colors">
          Privacy
        </Link>
        <span className="text-xs text-card-border">|</span>
        <Link href="/terms" className="text-xs text-muted hover:text-foreground transition-colors">
          Terms
        </Link>
        <span className="text-xs text-card-border">|</span>
        <Link href="/releases" className="text-xs text-muted hover:text-foreground transition-colors">
          Releases
        </Link>
        <span className="text-xs text-card-border">|</span>
        <Link href="/support" className="text-xs text-muted hover:text-foreground transition-colors">
          Support
        </Link>
      </div>
    </main>
  );
}
