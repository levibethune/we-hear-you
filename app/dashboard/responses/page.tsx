"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthContext } from "../../components/AuthProvider";
import { FilterBar } from "../../components/FilterBar";
import { ResponseCard } from "../../components/ResponseCard";
import { Pagination } from "../../components/Pagination";
import { EmptyState } from "../../components/EmptyState";
import { BulkActionBar } from "../../components/BulkActionBar";
import { useDebounce } from "../../hooks/useDebounce";
import { CampaignPicker } from "../../components/CampaignPicker";
import { LoadingIndicator } from "../../components/LoadingIndicator";
import { usePersonaOptions } from "../../hooks/usePersonaOptions";
import type { Response } from "../../lib/types";

export default function ResponsesPage() {
  const { tenant, activeCampaign } = useAuthContext();
  const personaOptions = usePersonaOptions(tenant);
  const [responses, setResponses] = useState<Response[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [mood, setMood] = useState("");
  const [personaFilter, setPersonaFilter] = useState("");
  const [source, setSource] = useState("");
  const [sort, setSort] = useState("newest");
  const [form, setForm] = useState("");
  const [formOptions, setFormOptions] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const debouncedSearch = useDebounce(search, 300);

  // Fetch available form names for filter
  useEffect(() => {
    if (!tenant) return;
    const cp = activeCampaign ? `&campaign_id=${activeCampaign.id}` : "";
    fetch(`/api/dashboard/responses?tenant_id=${tenant.id}${cp}&per_page=100`)
      .then((r) => r.json())
      .then((data) => {
        const names = new Set<string>();
        for (const r of data.responses ?? []) {
          if (r.source_form_name) names.add(r.source_form_name);
        }
        setFormOptions(Array.from(names).sort());
      })
      .catch(() => {});
  }, [tenant]);

  const fetchResponses = useCallback(() => {
    if (!tenant) return;
    setLoading(true);
    const params = new URLSearchParams({
      tenant_id: tenant.id,
      page: String(page),
      sort,
    });
    if (activeCampaign) params.set("campaign_id", activeCampaign.id);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (sentiment) params.set("sentiment", sentiment);
    if (mood) params.set("mood", mood);
    if (personaFilter) params.set("persona", personaFilter);
    if (source) params.set("source", source);
    if (form) params.set("form", form);
    if (showHidden) params.set("show_hidden", "true");

    fetch(`/api/dashboard/responses?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setResponses(data.responses ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tenant, page, debouncedSearch, sentiment, mood, personaFilter, source, form, sort, showHidden]);

  useEffect(() => { fetchResponses(); }, [fetchResponses]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === responses.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(responses.map((r) => r.id)));
    }
  }

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold">{total} Response{total !== 1 ? "s" : ""}</h2>
          <CampaignPicker />
        </div>
        <p className="text-sm text-muted mt-0.5">
          Every response that&apos;s been submitted. Use the filters and
          search to find specific feedback or patterns.
        </p>
      </div>

      {/* Row 1: Search, Source, Form */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search transcriptions..."
          className="text-sm w-64"
        />
        <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} className="text-sm">
          <option value="">Source</option>
          <option value="videoask">VideoAsk</option>
          <option value="custom">Custom</option>
          <option value="videoask-import">Import</option>
        </select>
        {formOptions.length > 0 && (
          <select value={form} onChange={(e) => { setForm(e.target.value); setPage(1); }} className="text-sm">
            <option value="">Form</option>
            {formOptions.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        )}
      </div>

      {/* Row 2: Sentiment, Mood, Persona, Sort */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select value={sentiment} onChange={(e) => { setSentiment(e.target.value); setPage(1); }} className="text-sm">
          <option value="">Sentiment</option>
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
          <option value="mixed">Mixed</option>
          <option value="neutral">Neutral</option>
        </select>
        <select value={mood} onChange={(e) => { setMood(e.target.value); setPage(1); }} className="text-sm">
          <option value="">Mood</option>
          <option value="hopeful">Hopeful</option>
          <option value="frustrated">Frustrated</option>
          <option value="enthusiastic">Enthusiastic</option>
          <option value="uncertain">Uncertain</option>
          <option value="restless">Restless</option>
          <option value="curious">Curious</option>
        </select>
        <select value={personaFilter} onChange={(e) => { setPersonaFilter(e.target.value); setPage(1); }} className="text-sm">
          <option value="">Persona</option>
          {personaOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="text-sm">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>
      {!loading && responses.length > 0 && tenant && (
        <BulkActionBar
          selectedCount={selected.size}
          totalCount={responses.length}
          target="responses"
          tenantId={tenant.id}
          selectedIds={Array.from(selected)}
          allSelected={selected.size === responses.length}
          onToggleSelectAll={toggleSelectAll}
          showHidden={showHidden}
          onAction={() => { setSelected(new Set()); fetchResponses(); }}
          onClear={() => setSelected(new Set())}
        />
      )}

      {loading ? (
        <LoadingIndicator />
      ) : responses.length === 0 ? (
        <EmptyState message={showHidden ? "No hidden responses." : "No responses found."} />
      ) : (
        <div className="flex flex-col gap-6">
          {responses.map((r) => (
            <div key={r.id} className="flex gap-3 items-start">
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggleSelect(r.id)}
                className="mt-6 shrink-0"
              />
              <div className={`flex-1 ${(r as Response & { is_hidden?: boolean }).is_hidden ? "opacity-40" : ""}`}>
                <ResponseCard response={r} showPerson onUpdate={fetchResponses} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <div className="flex justify-center mt-6">
        <button
          onClick={() => { setShowHidden(!showHidden); setPage(1); setSelected(new Set()); }}
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          {showHidden ? "Show active responses" : "Show hidden responses"}
        </button>
      </div>
    </div>
  );
}
