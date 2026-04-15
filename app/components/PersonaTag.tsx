export function PersonaTag({ persona }: { persona: string | null }) {
  if (!persona) return null;
  return (
    <span className="inline-block text-xs font-medium bg-peach/12 text-peach px-2.5 py-0.5 rounded-full">
      {persona}
    </span>
  );
}
