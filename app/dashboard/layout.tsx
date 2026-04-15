"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthProvider, useAuthContext } from "../components/AuthProvider";
import { DashboardShell } from "../components/DashboardShell";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { Logo } from "../components/Logo";
import { JobBanner } from "../components/JobBanner";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { loading, tenant, signOut } = useAuthContext();
  const router = useRouter();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingIndicator message="Loading your dashboard..." />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center soft-card px-8 py-10 max-w-sm flex flex-col items-center">
          <Logo size="md" linked={false} />
          <h2 className="text-lg font-bold mt-4">No access yet</h2>
          <p className="text-muted text-sm mt-2 mb-4">
            Your account doesn&apos;t have access to any organization yet.
            If you were invited, ask the person who invited you to add your
            email domain in their Admin panel.
          </p>
          <Link
            href="/support"
            className="text-sm text-accent hover:underline block mb-6"
          >
            Need help? Visit our support page &rarr;
          </Link>
          <button
            onClick={async () => {
              await signOut();
              router.push("/login");
            }}
            className="neu-button-primary text-sm"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <DashboardShell>{children}</DashboardShell>
      <JobBanner />
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  );
}
