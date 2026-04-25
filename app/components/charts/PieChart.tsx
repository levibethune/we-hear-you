"use client";

import { useState } from "react";

const COLORS = ["#f4a07a", "#7fbb9c", "#e8c76a", "#6bb5e0", "#d4a0d4", "#e87d7d", "#a0a0a0"];

export function PieChart({ data, title }: { data: Record<string, number>; title: string }) {
  const entries = Object.entries(data).sort(([, a], [, b]) => b - a);
  const total = entries.reduce((sum, [, c]) => sum + c, 0);
  const [expanded, setExpanded] = useState(false);

  if (total === 0) return null;

  // Build SVG donut segments
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const initialLimit = 12;
  const needsTruncation = entries.length > initialLimit;
  const visibleLegend = expanded || !needsTruncation ? entries : entries.slice(0, initialLimit);
  const hiddenCount = entries.length - initialLimit;

  return (
    <div className="soft-card p-5">
      <h3 className="text-base font-semibold mb-3">{title}</h3>
      <div className="flex items-start gap-6">
        <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
          {entries.map(([label, count], i) => {
            const pct = count / total;
            const dash = pct * circumference;
            const segment = (
              <circle
                key={label}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={COLORS[i % COLORS.length]}
                strokeWidth="20"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
              />
            );
            offset += dash;
            return segment;
          })}
        </svg>
        <div className="flex flex-col gap-1.5">
          {visibleLegend.map(([label, count], i) => (
            <div key={label} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="capitalize">{label}</span>
              <span className="text-muted">{Math.round((count / total) * 100)}%</span>
            </div>
          ))}
          {needsTruncation && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-accent hover:underline mt-1"
            >
              {expanded ? "Show less" : `+${hiddenCount} more`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
