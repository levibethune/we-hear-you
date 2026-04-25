"use client";

import { useState } from "react";

export function RankedList({ items, title }: { items: { value: string; count: number }[]; title: string }) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  const initialLimit = 12;
  const needsTruncation = items.length > initialLimit;
  const visible = expanded || !needsTruncation ? items : items.slice(0, initialLimit);
  const hiddenCount = items.length - initialLimit;

  return (
    <div className="soft-card p-5">
      <h3 className="text-base font-semibold mb-3">{title}</h3>
      <div className="flex flex-col gap-1">
        {visible.map(({ value, count }) => (
          <div key={value} className="flex items-center justify-between text-sm py-1">
            <span>{value}</span>
            <span className="text-muted text-xs">{count}</span>
          </div>
        ))}
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
