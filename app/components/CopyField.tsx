"use client";

import { useState } from "react";

export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      {label && <span className="text-muted block mb-1">{label}</span>}
      <div
        className="flex items-center gap-2 font-mono bg-background border border-muted/10 rounded-lg px-3 py-2 cursor-pointer select-all group"
        onClick={handleCopy}
      >
        <code className="text-xs text-foreground flex-1 truncate">{value}</code>
        <button
          className={`text-xs shrink-0 transition-colors ${copied ? "text-seafoam" : "text-muted group-hover:text-accent"}`}
          title="Copy to clipboard"
        >
          {copied ? "Copied" : "⎘"}
        </button>
      </div>
    </div>
  );
}
