"use client";

import { useEffect, useState } from "react";
import type { Tenant, Campaign } from "../lib/types";
import type { CustomField } from "../components/ConditionRow";

/**
 * Fetch custom analysis fields for conditions/mappings.
 *
 * - If a specific campaignId is given, uses that campaign's config.
 * - If null (org-wide), aggregates fields across all active campaigns.
 * - Excludes built-in fields (themes, mood, sentiment, persona, safety).
 *
 * The returned `key` matches the raw_analysis field name (used in conditions),
 * and also serves as the base for `analysis_<key>` in webhook payloads / field mappings.
 */
export function useCustomAnalysisFields(tenant: Tenant | null, campaignId: string | null, campaigns: Campaign[]) {
  const [fields, setFields] = useState<CustomField[]>([]);

  useEffect(() => {
    if (!tenant) {
      setFields([]);
      return;
    }

    async function load() {
      if (!tenant) return;
      const targetCampaignIds = campaignId
        ? [campaignId]
        : campaigns.filter((c) => !c.is_archived).map((c) => c.id);

      const seen = new Set<string>();
      const out: CustomField[] = [];

      for (const cid of targetCampaignIds) {
        try {
          const res = await fetch(`/api/dashboard/analysis-config?tenant_id=${tenant.id}&campaign_id=${cid}`);
          const data = await res.json();
          const props = data?.output_schema?.properties;
          if (!props) continue;
          for (const [name, prop] of Object.entries(props) as [string, Record<string, unknown>][]) {
            if (name === "safety") continue; // internal field, never user-facing
            if (seen.has(name)) continue;
            seen.add(name);
            const enumVals = Array.isArray(prop.enum) ? (prop.enum as string[]) : undefined;
            out.push({
              key: name,
              label: name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
              options: enumVals,
              type: prop.type as string,
            });
          }
        } catch {}
      }
      setFields(out);
    }
    load();
  }, [tenant, campaignId, campaigns]);

  return fields;
}
