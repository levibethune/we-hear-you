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
  const { tenant } = useAuthContext();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [reprocessing, setReprocessing] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
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

          <div className="flex flex-wrap items-center gap-1.5">
            {response.mood && (
              <span className="text-xs text-muted">{response.mood}</span>
            )}
            <SentimentBadge sentiment={response.sentiment} />
            <PersonaTag persona={persona} />
          </div>

          {response.themes && response.themes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {response.themes.map((t) => (
                <ThemeTag key={t} theme={t} />
              ))}
            </div>
          )}
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
          {hasVideo && (
            <button
              onClick={() => setShowVideo(!showVideo)}
              className="text-xs text-accent hover:underline inline-flex items-center gap-1"
            >
              <span className="text-[10px]">{"\u25B6"}</span>
              {showVideo ? "Hide video" : "Play video"}
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
