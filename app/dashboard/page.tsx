"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthContext } from "../components/AuthProvider";
import { StatCard } from "../components/StatCard";
import { ResponseCard } from "../components/ResponseCard";
import { EmptyState } from "../components/EmptyState";
import { DashboardWidget } from "../components/DashboardWidget";
import type { DashboardStats } from "../lib/types";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { CampaignPicker } from "../components/CampaignPicker";

export default function OverviewPage() {
  const { tenant, activeCampaign } = useAuthContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightGeneratedAt, setInsightGeneratedAt] = useState<string | null>(null);
  const [topPersona, setTopPersona] = useState<{ name: string; count: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const cp = activeCampaign ? `&campaign_id=${activeCampaign.id}` : "";

  useEffect(() => {
    if (!tenant) return;
    setLoading(true);
    // Clear stale data when campaign changes
    setInsight(null);
    setInsightGeneratedAt(null);
    setTopPersona(null);
    fetch(`/api/dashboard/stats?tenant_id=${tenant.id}${cp}`)
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tenant, cp]);

  // Fetch audience insight + top persona after stats load
  useEffect(() => {
    if (!tenant || !stats || stats.totalResponses === 0) return;

    setInsightLoading(true);
    fetch(`/api/dashboard/insights?tenant_id=${tenant.id}${cp}`)
      .then((r) => r.json())
      .then((data) => {
        setInsight(data.insight);
        setInsightGeneratedAt(data.generatedAt);
        setInsightLoading(false);
      })
      .catch(() => setInsightLoading(false));

    // Get top persona from people data
    fetch(`/api/dashboard/people?tenant_id=${tenant.id}${cp}&per_page=100`)
      .then((r) => r.json())
      .then((data) => {
        const counts: Record<string, number> = {};
        for (const p of data.people ?? []) {
          if (p.persona) counts[p.persona] = (counts[p.persona] || 0) + 1;
        }
        const top = Object.entries(counts).sort(([, a], [, b]) => b - a)[0];
        if (top) setTopPersona({ name: top[0], count: top[1] });
      })
      .catch(() => {});
  }, [tenant, stats]);

  if (loading) {
    return <LoadingIndicator />;
  }

  if (!stats) {
    return <EmptyState message="Could not load dashboard data." />;
  }

  // Build dynamic widget list from fieldStats
  const fieldStats = stats.fieldStats ?? {};
  const fieldDisplays = stats.fieldDisplays ?? {};

  // Fields that have a chart display (not hidden, not "none")
  const chartWidgets = Object.keys(fieldStats).filter((name) => {
    const display = fieldDisplays[name];
    return display && display !== "hidden" && display !== "none";
  });

  // Fields that show a "top" stat card
  const topWidgets = Object.keys(fieldStats).filter((name) => {
    if (fieldDisplays[name] === "hidden") return false;
    return fieldDisplays[name + "__show_top"] === "true";
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-lg font-bold">Dashboard</h2>
        <CampaignPicker />
      </div>
      <p className="text-sm text-muted mb-5">
        A snapshot of everything happening across your responses. See how people
        feel, what themes keep coming up, and what&apos;s been submitted recently.
      </p>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mb-6">
        <Link href="/dashboard/people" className="block">
          <StatCard label="People" value={stats.totalPeople} color="seafoam" />
        </Link>
        <Link href="/dashboard/responses" className="block">
          <StatCard label="Responses" value={stats.totalResponses} color="peach" />
        </Link>
        {topPersona && (
          <Link href="/dashboard/personas" className="block">
            <StatCard color="sunshine" label="Top Persona" value={topPersona.name} />
          </Link>
        )}
        {topWidgets.map((name) => {
          const stat = fieldStats[name];
          if (!stat?.top) return null;
          const fieldLabel = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const value = typeof stat.top === "string" ? stat.top.charAt(0).toUpperCase() + stat.top.slice(1) : stat.top;
          const isNumber = stat.type === "scalar";
          const showAvg = fieldDisplays[name + "__show_average"] === "true" && isNumber;
          return (
            <div key={name}>
              <StatCard label={`Top ${fieldLabel}`} value={value} />
            </div>
          );
        })}
        {/* Average cards for number fields */}
        {Object.keys(fieldStats).filter((name) =>
          fieldDisplays[name + "__show_average"] === "true" && fieldStats[name]?.type === "scalar"
        ).map((name) => {
          const stat = fieldStats[name];
          const fieldLabel = name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          return (
            <div key={`avg_${name}`}>
              <StatCard label={`Avg ${fieldLabel}`} value={stat?.top ?? "—"} />
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left column: Audience Insights + dynamic chart widgets */}
        <div className="flex flex-col gap-6">
          {/* Audience Insights */}
          {(insight || insightLoading) && (
            <div className="soft-card p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-base font-semibold">Audience Insights</h3>
                {!insightLoading && (
                  <div className="flex items-center gap-2">
                    {insightGeneratedAt && (
                      <span className="text-[10px] text-muted/50">
                        {new Date(insightGeneratedAt).toLocaleDateString()}
                      </span>
                    )}
                    <button
                      onClick={() => {
                        if (!tenant) return;
                        setInsightLoading(true);
                        fetch(`/api/dashboard/insights?tenant_id=${tenant.id}${cp}&force=true`)
                          .then((r) => r.json())
                          .then((data) => {
                            if (data.rateLimited) {
                              // Keep existing insight
                            } else {
                              setInsight(data.insight);
                              setInsightGeneratedAt(data.generatedAt);
                            }
                            setInsightLoading(false);
                          })
                          .catch(() => setInsightLoading(false));
                      }}
                      className="text-[10px] text-accent hover:underline"
                    >
                      Refresh
                    </button>
                  </div>
                )}
              </div>
              {insightLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-accent/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-seafoam/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="h-1.5 w-1.5 rounded-full bg-sunshine/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  <span className="text-xs text-muted ml-1">Analyzing your audience...</span>
                </div>
              ) : (
                <p className="text-sm leading-relaxed">{insight}</p>
              )}
            </div>
          )}

          {/* Dynamic chart widgets */}
          {chartWidgets.map((name) => {
            const stat = fieldStats[name];
            const display = fieldDisplays[name] as "bar" | "pie" | "list";
            if (!stat) return null;
            return <DashboardWidget key={name} fieldName={name} display={display} stat={stat} />;
          })}
        </div>

        {/* Right column: Recent responses */}
        <div className="soft-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold">
              {stats.totalResponses} {stats.totalResponses === 1 ? "Response" : "Responses"}
            </h3>
            <Link href="/dashboard/responses" className="text-xs text-accent hover:underline">
              See all &rarr;
            </Link>
          </div>
          {stats.recentResponses.length === 0 ? (
            <EmptyState message="No responses yet. Connect a source to start collecting data." />
          ) : (
            <div className="flex flex-col gap-6">
              {stats.recentResponses.map((r) => (
                <ResponseCard key={r.id} response={r} showPerson compact />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
