"use client";

import { useAuthContext } from "./AuthProvider";

export function CampaignPicker() {
  const { campaigns, activeCampaign, switchCampaign } = useAuthContext();

  if (campaigns.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <select
        value={activeCampaign?.id ?? ""}
        onChange={(e) => switchCampaign(e.target.value || null)}
        className="text-sm px-3 py-1.5 rounded-lg font-medium"
        style={{ minHeight: "unset", height: "auto" }}
      >
        <option value="">All Campaigns</option>
        {campaigns.filter((c) => !c.is_archived).map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      {activeCampaign && (
        <button
          onClick={() => switchCampaign(null)}
          className="text-[10px] text-muted hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  );
}
