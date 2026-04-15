export function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: "peach" | "seafoam" | "sunshine" | "default";
}) {
  const accents = {
    peach: "border-l-peach",
    seafoam: "border-l-seafoam",
    sunshine: "border-l-sunshine",
    default: "border-l-card-border",
  };

  return (
    <div className={`soft-card px-4 py-3.5 border-l-[3px] ${accents[color ?? "default"]}`}>
      <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
