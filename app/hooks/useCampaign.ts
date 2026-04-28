"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { Campaign, Tenant } from "../lib/types";

const STORAGE_KEY = "why-active-campaign";

export function useCampaign(tenant: Tenant | null) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchKey, setFetchKey] = useState(0);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // On mount: read from URL param first, then sessionStorage
  useEffect(() => {
    const urlParam = searchParams.get("campaign");
    if (urlParam) {
      setActiveCampaignId(urlParam);
      try { sessionStorage.setItem(STORAGE_KEY, urlParam); } catch {}
    } else {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) setActiveCampaignId(stored);
      } catch {}
    }
  }, []);

  // Sync URL param changes
  useEffect(() => {
    const urlParam = searchParams.get("campaign");
    if (urlParam && urlParam !== activeCampaignId) {
      setActiveCampaignId(urlParam);
      try { sessionStorage.setItem(STORAGE_KEY, urlParam); } catch {}
    }
  }, [searchParams]);

  useEffect(() => {
    if (!tenant) {
      setCampaigns([]);
      setLoading(false);
      return;
    }

    fetch(`/api/dashboard/campaigns?tenant_id=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => {
        setCampaigns(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tenant, fetchKey]);

  const activeCampaign = activeCampaignId
    ? campaigns.find((c) => c.id === activeCampaignId) ?? null
    : null;

  const switchCampaign = useCallback(
    (id: string | null) => {
      setActiveCampaignId(id);
      if (id) {
        try { sessionStorage.setItem(STORAGE_KEY, id); } catch {}
      } else {
        try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      }
      // Update URL param
      const params = new URLSearchParams(searchParams.toString());
      if (id) {
        params.set("campaign", id);
      } else {
        params.delete("campaign");
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
    },
    [searchParams, router, pathname]
  );

  const refreshCampaigns = useCallback(() => {
    setFetchKey((k) => k + 1);
  }, []);

  return {
    campaigns,
    activeCampaign,
    activeCampaignId,
    switchCampaign,
    refreshCampaigns,
    loading,
  };
}
