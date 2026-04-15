"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase-browser";
import type { Tenant, TenantMember } from "../lib/types";

// Client-side only — used for UI display (showing Admin link).
// Actual authorization is enforced server-side in dashboard-auth.ts.
const SUPER_ADMIN_EMAILS = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || "levibethune@gmail.com")
  .split(",")
  .map((e) => e.trim().toLowerCase());

export function useTenant(user: User | null) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Track which user ID we've already resolved tenants for
  const resolvedUserIdRef = useRef<string | null>(null);

  const userId = user?.id ?? null;
  const userEmail = user?.email ?? "";

  useEffect(() => {
    if (!userId) {
      resolvedUserIdRef.current = null;
      setTenant(null);
      setTenants([]);
      setRole(null);
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    // Skip if we've already resolved for this user
    if (resolvedUserIdRef.current === userId) return;

    setLoading(true);
    setTenant(null);

    const isSuper = SUPER_ADMIN_EMAILS.includes(userEmail);
    setIsSuperAdmin(isSuper);

    (async () => {
      let { data: members } = await supabase
        .from("tenant_members")
        .select("*, tenant:tenants(*)")
        .eq("user_id", userId);

      // Only try auto-provisioning if user has no memberships yet
      if (!isSuper && (!members || members.length === 0)) {
        const res = await fetch("/api/dashboard/auto-provision", {
          method: "POST",
        });
        const result = await res.json();

        if (result.provisioned) {
          const refetch = await supabase
            .from("tenant_members")
            .select("*, tenant:tenants(*)")
            .eq("user_id", userId);
          members = refetch.data;
        }
      }

      const memberTenants = (members ?? [])
        .filter((m: TenantMember) => m.tenant)
        .map((m: TenantMember) => ({
          ...m.tenant!,
          _role: m.role,
        }));

      // Restore last selected tenant from localStorage
      const savedTenantId = typeof window !== "undefined"
        ? localStorage.getItem("why-active-tenant")
        : null;

      if (isSuper && memberTenants.length === 0) {
        const { data: allTenants } = await supabase
          .from("tenants")
          .select("*")
          .order("created_at");
        setTenants(allTenants ?? []);
        if (allTenants && allTenants.length > 0) {
          const saved = savedTenantId ? allTenants.find((t) => t.id === savedTenantId) : null;
          setTenant(saved ?? allTenants[0]);
          setRole("owner");
        }
      } else {
        setTenants(memberTenants);
        if (memberTenants.length > 0) {
          const saved = savedTenantId ? memberTenants.find((t) => t.id === savedTenantId) : null;
          const selected = saved ?? memberTenants[0];
          setTenant(selected);
          setRole((selected as { _role: string })._role);
        }
      }

      resolvedUserIdRef.current = userId;
      setLoading(false);
    })();
  }, [userId, userEmail]);

  const switchTenant = useCallback(
    (tenantId: string) => {
      const found = tenants.find((t) => t.id === tenantId);
      if (found) {
        setTenant(found);
        setRole((found as { _role?: string })?._role ?? (isSuperAdmin ? "owner" : "viewer"));
        if (typeof window !== "undefined") {
          localStorage.setItem("why-active-tenant", tenantId);
        }
      }
    },
    [tenants, isSuperAdmin]
  );

  return { tenant, tenants, role, isSuperAdmin, loading, switchTenant };
}
