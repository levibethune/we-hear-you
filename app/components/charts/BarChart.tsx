"use client";

import { useState } from "react";

const COLORS = ["bg-accent", "bg-seafoam", "bg-sunshine", "bg-positive", "bg-mixed", "bg-negative", "bg-neutral"];

export function BarChart({ data, title }: { data: Record<string, number>; title: string }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((sum, [, c]) => sum + c, 0);
  const [expanded, setExpanded] = useState(false);

  if (total === 0) return null;

  const initialLimit = 12;
  const needsTruncation = entries.length > initialLimit;
  const visible = expanded || !needsTruncation ? entries : entries.slice(0, initialLimit);
  const hiddenCount = entries.length - initialLimit;

  return (
    <div className="soft-card p-5">
      <h3 className="text-base font-semibold mb-3">{title}</h3>
      <div className="flex flex-col gap-2">
        {visible.map(([label, count], i) => {
          const pct = Math.round((count / total) * 100);
          return (
            <div key={label} className="flex items-center gap-3">
              <span className="text-xs shrink-0 capitalize" style={{ minWidth: "30%", maxWidth: "45%" }}>{label}</span>
              <div className="flex-1 h-2 rounded-full bg-card-border overflow-hidden">
                <div className={`h-full rounded-full ${COLORS[i % COLORS.length]}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-muted shrink-0 text-right">{count}</span>
            </div>
          );
        })}
      </div>
      {needsTruncation && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-accent hover:underline mt-3"
        >
          {expanded ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}
