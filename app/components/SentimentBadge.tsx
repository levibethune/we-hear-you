const colors: Record<string, string> = {
  positive: "bg-seafoam/15 text-seafoam",
  negative: "bg-negative/15 text-negative",
  mixed: "bg-sunshine/15 text-sunshine",
  neutral: "bg-neutral/15 text-neutral",
};

export function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return null;
  const cls = colors[sentiment] ?? colors.neutral;
  return (
    <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full ${cls}`}>
      {sentiment}
    </span>
  );
}
