import type { FieldStat } from "../lib/types";
import { BarChart } from "./charts/BarChart";
import { PieChart } from "./charts/PieChart";
import { RankedList } from "./charts/RankedList";
import { TopValue } from "./charts/TopValue";

function toTitleCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getCounts(stat: FieldStat): Record<string, number> {
  // Use counts if available, otherwise convert items to counts
  if (stat.counts && Object.keys(stat.counts).length > 0) return stat.counts;
  if (stat.items && stat.items.length > 0) {
    return Object.fromEntries(stat.items.map((i) => [i.value, i.count]));
  }
  return {};
}

export function DashboardWidget({
  fieldName,
  display,
  stat,
}: {
  fieldName: string;
  display: "bar" | "pie" | "list";
  stat: FieldStat;
}) {
  const title = toTitleCase(fieldName);
  const counts = getCounts(stat);
  const hasData = Object.keys(counts).length > 0 || (stat.items && stat.items.length > 0);

  if (!hasData) return null;

  switch (display) {
    case "bar":
      return <BarChart data={counts} title={title} />;
    case "pie":
      return <PieChart data={counts} title={title} />;
    case "list":
      return <RankedList items={stat.items ?? Object.entries(counts).map(([value, count]) => ({ value, count }))} title={title} />;
    default:
      return null;
  }
}
