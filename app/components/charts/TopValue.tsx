export function TopValue({ value, title }: { value: string | number | undefined; title: string }) {
  const display = value != null ? String(value) : "—";
  const capitalized = typeof value === "string" ? display.charAt(0).toUpperCase() + display.slice(1) : display;

  return (
    <div className="soft-card p-5">
      <p className="text-[10px] text-muted uppercase tracking-wider mb-1">{title}</p>
      <p className="text-xl font-bold truncate">{capitalized}</p>
    </div>
  );
}
