"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuthContext } from "./AuthProvider";
import type { VideoFeed } from "../lib/types";

export function VideoFeedCard({
  feed,
  onToggle,
  onDelete,
}: {
  feed: VideoFeed;
  onToggle: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/feeds/${feed.slug}` : `/feeds/${feed.slug}`;

  function handleCopy() {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="soft-card p-4 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <Link href={`/dashboard/outputs/feeds/${feed.id}/edit`} className="text-sm font-medium hover:text-accent transition-colors">
          {feed.name}
        </Link>
        {feed.description && (
          <p className="text-xs text-muted mt-0.5 truncate">{feed.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <code className="text-[10px] text-muted/60 font-mono bg-card-border/30 px-2 py-0.5 rounded truncate max-w-xs">
            /feeds/{feed.slug}
          </code>
          <button onClick={handleCopy} className="text-[10px] text-accent hover:underline">
            {copied ? "Copied!" : "Copy URL"}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Link
          href={`/dashboard/outputs/feeds/${feed.id}/edit`}
          className="text-muted hover:text-accent transition-colors p-1"
          title="Edit"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </Link>
        <button
          onClick={() => onToggle(feed.id, !feed.is_active)}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            feed.is_active ? "bg-seafoam/40" : "bg-card-border"
          }`}
          title={feed.is_active ? "Pause" : "Resume"}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
              feed.is_active ? "left-[18px] bg-seafoam" : "left-0.5 bg-muted/40"
            }`}
          />
        </button>
        <button
          onClick={() => {
            if (confirm(`Delete "${feed.name}"? Anyone with the public URL will lose access.`)) {
              onDelete(feed.id);
            }
          }}
          className="text-muted hover:text-negative transition-colors p-1"
          title="Delete"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
