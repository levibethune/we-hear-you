"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuthContext } from "../../components/AuthProvider";
import { FilterBar } from "../../components/FilterBar";
import { SentimentBadge } from "../../components/SentimentBadge";
import { PersonaTag } from "../../components/PersonaTag";
import { Pagination } from "../../components/Pagination";
import { EmptyState } from "../../components/EmptyState";
import { BulkActionBar } from "../../components/BulkActionBar";
import { useDebounce } from "../../hooks/useDebounce";
import { LoadingIndicator } from "../../components/LoadingIndicator";
import { CampaignPicker } from "../../components/CampaignPicker";
import { usePersonaOptions } from "../../hooks/usePersonaOptions";
import type { Person } from "../../lib/types";

export default function PeoplePage() {
  const { tenant, activeCampaign } = useAuthContext();
  const [people, setPeople] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [mood, setMood] = useState("");
  const [persona, setPersona] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const debouncedSearch = useDebounce(search, 300);
  const personaOptions = usePersonaOptions(tenant);

  const fetchPeople = useCallback(() => {
    if (!tenant) return;
    setLoading(true);
    const params = new URLSearchParams({
      tenant_id: tenant.id,
      page: String(page),
      sort_by: sortBy,
      sort_dir: sortDir,
    });
    if (activeCampaign) params.set("campaign_id", activeCampaign.id);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (sentiment) params.set("sentiment", sentiment);
    if (mood) params.set("mood", mood);
    if (persona) params.set("persona", persona);
    if (showHidden) params.set("show_hidden", "true");

    fetch(`/api/dashboard/people?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setPeople(data.people ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tenant, page, debouncedSearch, sentiment, mood, persona, showHidden, sortBy, sortDir]);

  useEffect(() => { fetchPeople(); }, [fetchPeople]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === people.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(people.map((p) => p.id)));
    }
  }

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
    setPage(1);
  }

  function SortArrow({ col }: { col: string }) {
    if (sortBy !== col) return <span className="text-muted/30 ml-1 inline-block">{"\u2195"}</span>;
    return <span className="text-accent ml-1 inline-block">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>;
  }

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold">{total} {total === 1 ? "Person" : "People"}</h2>
          <CampaignPicker />
        </div>
        <p className="text-sm text-muted mt-0.5">
          Everyone who has submitted a response. Click on a person to see their
          full history and how they&apos;ve been classified.
        </p>
      </div>

      <FilterBar
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Search by name or email..."
        filters={[
          {
            label: "Sentiment",
            value: sentiment,
            onChange: (v) => { setSentiment(v); setPage(1); },
            options: [
              { label: "Positive", value: "positive" },
              { label: "Negative", value: "negative" },
              { label: "Mixed", value: "mixed" },
              { label: "Neutral", value: "neutral" },
            ],
          },
          {
            label: "Mood",
            value: mood,
            onChange: (v) => { setMood(v); setPage(1); },
            options: [
              { label: "Hopeful", value: "hopeful" },
              { label: "Frustrated", value: "frustrated" },
              { label: "Enthusiastic", value: "enthusiastic" },
              { label: "Uncertain", value: "uncertain" },
              { label: "Restless", value: "restless" },
              { label: "Curious", value: "curious" },
              { label: "Inspired", value: "inspired" },
              { label: "Casual", value: "casual" },
            ],
          },
          {
            label: "Persona",
            value: persona,
            onChange: (v) => { setPersona(v); setPage(1); },
            options: personaOptions,
          },
        ]}
      />
      {!loading && people.length > 0 && tenant && (
        <BulkActionBar
          selectedCount={selected.size}
          totalCount={people.length}
          matchingTotal={people.length}
          allMatching={false}
          onSelectAllMatching={() => {}}
          target="people"
          tenantId={tenant.id}
          selectedIds={Array.from(selected)}
          allSelected={selected.size === people.length}
          onToggleSelectAll={toggleSelectAll}
          showHidden={showHidden}
          onAction={() => { setSelected(new Set()); fetchPeople(); }}
          onClear={() => setSelected(new Set())}
        />
      )}

      {loading ? (
        <LoadingIndicator />
      ) : people.length === 0 ? (
        <EmptyState message={showHidden ? "No hidden people." : "No people found."} />
      ) : (
        <div className="neu-inset rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-left text-xs text-muted uppercase tracking-wide">
                <th className="px-4 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === people.length && people.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-2.5 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("name")}>
                  Name <SortArrow col="name" />
                </th>
                <th className="px-4 py-2.5 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("persona")}>
                  Persona <SortArrow col="persona" />
                </th>
                <th className="px-4 py-2.5 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("latest_mood")}>
                  Mood <SortArrow col="latest_mood" />
                </th>
                <th className="px-4 py-2.5 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("latest_sentiment")}>
                  Sentiment <SortArrow col="latest_sentiment" />
                </th>
                <th className="px-4 py-2.5 cursor-pointer select-none text-right" onClick={() => handleSort("response_count")}>
                  Responses <SortArrow col="response_count" />
                </th>
                <th className="px-4 py-2.5 cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("last_responded_at")}>
                  Responded <SortArrow col="last_responded_at" />
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr
                  key={p.id}
                  className={`border-t border-muted/10 hover:bg-background/50 transition-colors ${
                    (p as Person & { is_hidden?: boolean }).is_hidden ? "opacity-40" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/people/${p.id}`}
                      className="hover:text-accent transition-colors"
                    >
                      <p className="font-medium">{p.name ?? "—"}</p>
                      <p className="text-xs text-muted">{p.email}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <PersonaTag persona={p.persona} />
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {p.latest_mood ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <SentimentBadge sentiment={p.latest_sentiment} />
                  </td>
                  <td className="px-4 py-3 text-right text-muted">
                    {p.response_count}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {new Date((p as Person & { last_responded_at?: string }).last_responded_at ?? p.updated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <div className="flex justify-center mt-6">
        <button
          onClick={() => { setShowHidden(!showHidden); setPage(1); setSelected(new Set()); }}
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          {showHidden ? "Show active people" : "Show hidden people"}
        </button>
      </div>
    </div>
  );
}
