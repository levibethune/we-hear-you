"use client";

import { useAuthContext } from "./AuthProvider";

export function OrgBanner() {
  const { tenant } = useAuthContext();

  if (!tenant) return null;

  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-muted mb-4">
      <span>Managing</span>
      <span className="font-medium text-foreground bg-accent/10 px-2 py-0.5 rounded-full">
        {tenant.name}
      </span>
    </div>
  );
}
