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
import { useCustomAnalysisFields } from "../../hooks/useCustomAnalysisFields";
import type { Response } from "../../lib/types";

export default function ResponsesPage() {
  const { tenant, activeCampaign, campaigns } = useAuthContext();
  const [responses, setResponses] = useState<Response[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [sort, setSort] = useState("newest");
  const [form, setForm] = useState("");
  const [formOptions, setFormOptions] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  // Analysis field filters — all from schema
  const analysisFields = useCustomAnalysisFields(tenant, activeCampaign?.id ?? null, campaigns);
  const customFields = analysisFields.filter((f) => f.options && f.options.length > 0);
  const [customFilters, setCustomFilters] = useState<Record<string, string>>({});

  // Fetch available form names
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
  }, [tenant, activeCampaign]);

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
    if (source) params.set("source", source);
    if (form) params.set("form", form);
    for (const [key, val] of Object.entries(customFilters)) {
      if (val) params.set(`custom_${key}`, val);
    }
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
  }, [tenant, page, debouncedSearch, source, form, sort, showHidden, customFilters]);

  useEffect(() => { fetchResponses(); }, [fetchResponses]);

  useEffect(() => {
    setSelected(new Set());
    setAllMatching(false);
  }, [debouncedSearch, source, form, sort, customFilters, showHidden, activeCampaign]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setAllMatching(false);
    if (selected.size === responses.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(responses.map((r) => r.id)));
    }
  }

  async function selectAllMatching() {
    if (!tenant) return;
    const params = new URLSearchParams({ tenant_id: tenant.id, sort, ids_only: "true" });
    if (activeCampaign) params.set("campaign_id", activeCampaign.id);
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (source) params.set("source", source);
    if (form) params.set("form", form);
    for (const [key, val] of Object.entries(customFilters)) {
      if (val) params.set(`custom_${key}`, val);
    }
    if (showHidden) params.set("show_hidden", "true");

    const res = await fetch(`/api/dashboard/responses?${params}`);
    const data = await res.json();
    setSelected(new Set(data.ids ?? []));
    setAllMatching(true);
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

      {/* Row 2: Analysis field filters (all from schema) + Sort */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* All analysis field filters — dynamically from schema */}
        {customFields.map((cf) => (
          <select
            key={cf.key}
            value={customFilters[cf.key] || ""}
            onChange={(e) => { setCustomFilters({ ...customFilters, [cf.key]: e.target.value }); setPage(1); }}
            className="text-sm"
          >
            <option value="">{cf.label}</option>
            {(cf.options ?? []).map((o) => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
          </select>
        ))}
        <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="text-sm">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>
      {!loading && responses.length > 0 && tenant && (
        <BulkActionBar
          selectedCount={selected.size}
          totalCount={responses.length}
          matchingTotal={total}
          allMatching={allMatching}
          onSelectAllMatching={selectAllMatching}
          target="responses"
          tenantId={tenant.id}
          selectedIds={Array.from(selected)}
          allSelected={selected.size === responses.length}
          onToggleSelectAll={toggleSelectAll}
          showHidden={showHidden}
          onAction={() => { setSelected(new Set()); setAllMatching(false); fetchResponses(); }}
          onClear={() => { setSelected(new Set()); setAllMatching(false); }}
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
