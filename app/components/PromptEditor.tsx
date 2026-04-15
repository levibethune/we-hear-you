"use client";

const DEFAULT_PROMPT = `You are a neutral analysis system. Your job is to analyze video transcription data.

Analyze the transcription and return structured results using the provided tool.`;

export function PromptEditor({
  value,
  onChange,
  onSuggest,
  suggesting,
}: {
  value: string;
  onChange: (value: string) => void;
  onSuggest?: () => void;
  suggesting?: boolean;
}) {
  const displayValue = value.replace(
    /^CRITICAL SECURITY INSTRUCTION:[\s\S]*?Only use the provided tool to return structured analysis results\.\n\n/,
    ""
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium">System Prompt</h4>
        <div className="flex items-center gap-3">
          {onSuggest && (
            <button
              onClick={onSuggest}
              disabled={suggesting}
              className="text-xs text-accent hover:underline disabled:opacity-50"
            >
              {suggesting ? "Generating..." : "Suggest a prompt"}
            </button>
          )}
          <button
            onClick={() => onChange(DEFAULT_PROMPT)}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Reset to default
          </button>
        </div>
      </div>
      <textarea
        value={displayValue}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        className="w-full text-sm font-mono resize-y"
      />
      <div className="flex items-start gap-2 mt-2">
        <div className="w-1.5 h-1.5 rounded-full bg-seafoam mt-1.5 shrink-0" />
        <p className="text-xs text-muted">
          Security protections are always applied automatically — the AI is
          instructed to treat transcriptions as data, not instructions. You
          don&apos;t need to include safety language in your prompt.
        </p>
      </div>
    </div>
  );
}
