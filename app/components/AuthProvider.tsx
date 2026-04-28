"use client";

import { createContext, useContext, Suspense } from "react";
import { User } from "@supabase/supabase-js";
import { useAuth } from "../hooks/useAuth";
import { useTenant } from "../hooks/useTenant";
import { useCampaign } from "../hooks/useCampaign";
import type { Tenant, Campaign } from "../lib/types";

interface AuthContextValue {
  user: User | null;
  tenant: Tenant | null;
  tenants: Tenant[];
  role: string | null;
  isSuperAdmin: boolean;
  loading: boolean;
  switchTenant: (id: string) => void;
  signOut: () => Promise<void>;
  campaigns: Campaign[];
  activeCampaign: Campaign | null;
  activeCampaignId: string | null;
  switchCampaign: (id: string | null) => void;
  refreshCampaigns: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function AuthProviderInner({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const tenantState = useTenant(auth.user);
  const campaignState = useCampaign(tenantState.tenant);

  const loading = auth.loading || tenantState.loading || campaignState.loading;

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        tenant: tenantState.tenant,
        tenants: tenantState.tenants,
        role: tenantState.role,
        isSuperAdmin: tenantState.isSuperAdmin,
        loading,
        switchTenant: tenantState.switchTenant,
        signOut: auth.signOut,
        campaigns: campaignState.campaigns,
        activeCampaign: campaignState.activeCampaign,
        activeCampaignId: campaignState.activeCampaignId,
        switchCampaign: campaignState.switchCampaign,
        refreshCampaigns: campaignState.refreshCampaigns,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AuthProviderInner>{children}</AuthProviderInner>
    </Suspense>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
