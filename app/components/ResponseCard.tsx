"use client";

import { useState } from "react";
import Link from "next/link";
import { SentimentBadge } from "./SentimentBadge";
import { ThemeTag } from "./ThemeTag";
import { PersonaTag } from "./PersonaTag";
import type { Response } from "../lib/types";
import { useAuthContext } from "./AuthProvider";
import { track } from "../lib/analytics";

const sourceLabels: Record<string, string> = {
  "videoask": "VideoAsk",
  "videoask-link": "VideoAsk Import",
  "videoask-import": "VideoAsk Import",
  "custom": "Custom",
};

export function ResponseCard({
  response,
  showPerson,
  onUpdate,
  compact,
}: {
  response: Response & { person?: { name: string | null; email: string } };
  showPerson?: boolean;
  onUpdate?: () => void;
  compact?: boolean;
}) {
  const { tenant, campaigns } = useAuthContext();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [reprocessing, setReprocessing] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [movingCampaign, setMovingCampaign] = useState(false);
  const persona = (response.raw_analysis as Record<string, string>)?.persona ?? null;
  const transcription = response.transcription ?? "";
  const isLong = transcription.length > 300;
  const sourceLabel = sourceLabels[response.source_type ?? ""] ?? response.source_type;
  const hasVideo = !!response.video_url;

  async function handleReprocess() {
    if (!tenant) return;
    setReprocessing(true);
    try {
      await fetch("/api/dashboard/responses/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenant.id,
          response_id: response.id,
          transcription: editText,
        }),
      });
      setEditing(false);
      track("transcript_edited", { response_id: response.id });
      onUpdate?.();
    } catch {
      // silently fail
    }
    setReprocessing(false);
  }

  async function handleReanalyze() {
    if (!tenant || !transcription.trim()) return;
    if (!confirm("Re-analyze this response? This re-runs AI analysis on the current transcript and fires any matching output flows (which may publish a new item).")) return;
    setReprocessing(true);
    try {
      await fetch("/api/dashboard/responses/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenant.id,
          response_id: response.id,
        }),
      });
      track("response_reanalyzed", { response_id: response.id });
      onUpdate?.();
    } catch {
      // silently fail
    }
    setReprocessing(false);
  }

  async function handleMoveCampaign(newCampaignId: string | null) {
    if (!tenant) return;
    setMovingCampaign(false);
    if (newCampaignId === (response.campaign_id ?? null)) return;
    const newName = newCampaignId
      ? campaigns.find((c) => c.id === newCampaignId)?.name ?? "the selected campaign"
      : "no campaign";
    if (!confirm(`Move this response to ${newName}? It will be re-analyzed with that campaign's analysis schema and any matching output flows will fire.`)) return;
    setReprocessing(true);
    try {
      await fetch("/api/dashboard/responses/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenant.id,
          response_id: response.id,
          campaign_id: newCampaignId,
        }),
      });
      track("response_moved_campaign", { response_id: response.id, campaign_id: newCampaignId });
      onUpdate?.();
    } catch {
      // silently fail
    }
    setReprocessing(false);
  }

  return (
    <div className="soft-card p-5 max-w-4xl">
      <div className="flex gap-6">
        {/* Left: metadata */}
        <div className="w-64 shrink-0">
          {showPerson && response.person && (
            <Link
              href={`/dashboard/people/${response.person_id}`}
              className="text-base font-bold hover:text-accent transition-colors block mb-1"
            >
              {response.person.name ?? response.person.email}
            </Link>
          )}
          <p className="text-xs text-muted mb-3">
            {new Date(response.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {(sourceLabel || response.source_form_name) && (
              <span className="block mt-0.5 text-muted/60">
                {response.source_form_name ?? sourceLabel}
              </span>
            )}
          </p>

          <div className="flex flex-col gap-2.5 mt-2">
            {/* All analysis fields rendered uniformly from raw_analysis */}
            {response.raw_analysis && Object.entries(response.raw_analysis as Record<string, unknown>)
              .filter(([k, v]) => k !== "safety" && v != null)
              .map(([key, val]) => (
                <div key={key}>
                  <p className="text-[9px] text-muted/50 uppercase tracking-wider mb-0.5">{key.replace(/_/g, " ")}</p>
                  {key === "persona" ? (
                    <PersonaTag persona={String(val)} />
                  ) : key === "sentiment" ? (
                    <SentimentBadge sentiment={String(val)} />
                  ) : Array.isArray(val) ? (
                    <div className="flex flex-wrap gap-1.5">
                      {val.map((v, i) => (
                        <ThemeTag key={i} theme={String(v)} />
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs bg-muted/10 text-foreground px-2.5 py-1 rounded-full">{String(val)}</span>
                  )}
                </div>
              ))
            }
          </div>
        </div>

        {/* Right: transcription + video */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Inline video player */}
          {showVideo && hasVideo && (
            <div className="mb-3 rounded-xl overflow-hidden neu-inset">
              <video
                src={response.video_url!}
                controls
                autoPlay
                className="w-full max-h-64 object-contain bg-black"
              />
            </div>
          )}

          {editing ? (
            <div className="flex flex-col gap-3 flex-1">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={8}
                className="text-sm w-full flex-1 resize-y"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={handleReprocess}
                  disabled={reprocessing || !editText.trim()}
                  className="neu-button-primary text-xs"
                >
                  {reprocessing ? "Re-processing..." : "Save & Re-process"}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs text-muted hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[10px] text-muted/50 mt-2">
                Changes are only saved within We Hear You. The original source recording is not modified.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm leading-relaxed flex-1">
                {isLong && !expanded
                  ? transcription.slice(0, 300) + "..."
                  : transcription}
              </p>
              {isLong && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs text-accent mt-2 hover:underline self-start"
                >
                  {expanded ? "Show less" : "Show more"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer actions */}
      {!compact && (
        <div className="flex items-center justify-end gap-4 mt-4 pt-3 border-t border-muted/10">
          {!editing && (
            <button
              onClick={() => { setEditText(transcription); setEditing(true); }}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Edit transcript
            </button>
          )}
          {!editing && transcription.trim() && (
            <button
              onClick={handleReanalyze}
              disabled={reprocessing}
              className="text-xs text-muted hover:text-foreground transition-colors disabled:opacity-50"
            >
              {reprocessing ? "Re-analyzing…" : "Re-analyze"}
            </button>
          )}
          {!editing && campaigns.length > 0 && (() => {
            const currentCampaign = response.campaign_id
              ? campaigns.find((c) => c.id === response.campaign_id)
              : null;
            const buttonLabel = currentCampaign
              ? `In ${currentCampaign.name}`
              : "No campaign";
            return (
              <div className="relative">
                <button
                  onClick={() => setMovingCampaign((v) => !v)}
                  disabled={reprocessing}
                  className={`text-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1 ${currentCampaign ? "text-foreground hover:text-accent" : "text-muted hover:text-foreground"}`}
                  title="Change campaign"
                >
                  {buttonLabel}
                  <span className="text-[8px] text-muted">▾</span>
                </button>
                {movingCampaign && (
                  <div className="absolute right-0 bottom-full mb-1 z-10 soft-card p-1.5 min-w-[220px] flex flex-col gap-0.5 shadow-lg">
                    {campaigns.filter((c) => !c.is_archived).map((c) => {
                      const isCurrent = response.campaign_id === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleMoveCampaign(isCurrent ? null : c.id)}
                          className="text-xs text-left px-2 py-1.5 rounded hover:bg-card-border/30 flex items-center gap-2"
                        >
                          <span className={`shrink-0 ${isCurrent ? "text-accent" : "text-muted/30"}`}>
                            {isCurrent ? "✓" : "○"}
                          </span>
                          <span className="flex-1 truncate">{c.name}</span>
                        </button>
                      );
                    })}
                    {response.campaign_id != null && (
                      <>
                        <div className="border-t border-card-border my-1" />
                        <button
                          type="button"
                          onClick={() => handleMoveCampaign(null)}
                          className="text-xs text-left px-2 py-1.5 rounded hover:bg-card-border/30 text-muted"
                        >
                          Remove from campaign
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
          {hasVideo && (
            <button
              onClick={() => setShowVideo(!showVideo)}
              className="text-xs text-accent hover:underline inline-flex items-center gap-1"
            >
              <span className="text-[10px]">{"\u25B6"}</span>
              {showVideo ? "Hide video" : "Play video"}
            </button>
          )}
          {hasVideo && (
            <button
              onClick={() => {
                const code = `<iframe src="https://app.wehearyou.io/embed/response/${response.id}" width="100%" height="400" frameborder="0" allowfullscreen></iframe>`;
                navigator.clipboard.writeText(code);
              }}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              Copy embed
            </button>
          )}
          {response.share_url && (
            <a
              href={response.share_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              View on VideoAsk
            </a>
          )}
        </div>
      )}

      {/* Compact mode — just a link to the person */}
      {compact && (
        <div className="flex items-center justify-end mt-3 pt-3 border-t border-muted/10">
          <Link
            href={`/dashboard/people/${response.person_id}`}
            className="text-xs text-accent hover:underline"
          >
            View full response &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
