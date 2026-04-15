"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthContext } from "../components/AuthProvider";
import { StatCard } from "../components/StatCard";
import { SentimentBadge } from "../components/SentimentBadge";
import { ResponseCard } from "../components/ResponseCard";
import { EmptyState } from "../components/EmptyState";
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
    return (
      <LoadingIndicator />
    );
  }

  if (!stats) {
    return <EmptyState message="Could not load dashboard data." />;
  }

  const totalSentiment = Object.values(stats.sentimentBreakdown).reduce(
    (a, b) => a + b,
    0
  );

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

      {/* Stat cards — People/Responses smaller, others wider */}
      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "1fr 1fr 2fr 2fr 2fr" }}>
        <Link href="/dashboard/people" className="block">
          <StatCard label="People" value={stats.totalPeople} color="seafoam" />
        </Link>
        <Link href="/dashboard/responses" className="block">
          <StatCard label="Responses" value={stats.totalResponses} color="peach" />
        </Link>
        <Link href="/dashboard/personas" className="block">
          <StatCard
            color="sunshine"
            label="Top Persona"
            value={topPersona?.name ?? "—"}
          />
        </Link>
        <StatCard
          label="Top Mood"
          value={stats.recentResponses[0]?.mood ? stats.recentResponses[0].mood.charAt(0).toUpperCase() + stats.recentResponses[0].mood.slice(1) : "—"}
        />
        <StatCard
          label="Avg Sentiment"
          value={
            totalSentiment > 0
              ? (() => { const s = Object.entries(stats.sentimentBreakdown).sort(([, a], [, b]) => b - a)[0][0]; return s.charAt(0).toUpperCase() + s.slice(1); })()
              : "—"
          }
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left column: Audience Insights + Sentiment */}
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

          {/* Sentiment breakdown */}
        <div className="soft-card p-5">
          <h3 className="text-base font-semibold mb-3">
            Sentiment Breakdown
          </h3>
          {totalSentiment === 0 ? (
            <p className="text-sm text-muted">No responses yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(
                ["positive", "negative", "mixed", "neutral"] as const
              ).map((s) => {
                const count = stats.sentimentBreakdown[s] ?? 0;
                const pct =
                  totalSentiment > 0
                    ? Math.round((count / totalSentiment) * 100)
                    : 0;
                return (
                  <div key={s} className="flex items-center gap-3">
                    <SentimentBadge sentiment={s} />
                    <div className="flex-1 h-2 rounded-full bg-card-border overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          s === "positive"
                            ? "bg-positive"
                            : s === "negative"
                            ? "bg-negative"
                            : s === "mixed"
                            ? "bg-mixed"
                            : "bg-neutral"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted w-8 text-right">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Top themes */}
          <h3 className="text-sm font-medium text-muted mt-6 mb-3">
            Top Themes
          </h3>
          {stats.topThemes.length === 0 ? (
            <p className="text-sm text-muted">No themes yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {stats.topThemes.map(({ theme, count }) => (
                <div
                  key={theme}
                  className="flex items-center justify-between text-sm py-1"
                >
                  <span>{theme}</span>
                  <span className="text-muted text-xs">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
