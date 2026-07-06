# Batch Re-analysis at Scale — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user (1) select every response matching the current filters — not just the current page — to batch re-analyze, and (2) re-analyze all responses in a campaign or the whole org after changing analysis criteria.

**Architecture:** Both features feed the existing `bulk_reanalyze` background job, whose worker (`processReanalyzeBatch`) re-fetches each response's own campaign analysis config and re-runs it. Feature 1 adds an IDs-only mode to the responses list route and a "select all matching" affordance on the Responses page. Feature 2 adds a scope descriptor (`campaign` / `tenant`) that the jobs POST route resolves to concrete `response_ids` at creation time, plus a button + scope-confirm modal on the Analysis Config page. The worker itself is unchanged.

**Tech Stack:** Next.js 16 (App Router, `"use client"` dashboard pages), Supabase JS (`getServerClient`), TypeScript.

## Global Constraints

- **No unit-test harness exists** in this repo (no vitest/jest, no `test` script). Per-task automated gate is `npx tsc --noEmit` (zero errors). Feature-level verification is a **Vercel preview deploy** (`vercel`, NOT `--prod`) and manual click-through — never localhost.
- **Do not modify the worker** `processReanalyzeBatch` in `app/api/dashboard/jobs/process/route.ts`. Scope→IDs resolution happens at job-creation time so `params.response_ids` stays stable across the batched, multi-invocation processing driven by `JobBanner`.
- **Active-only default:** batch selections and scope resolution target non-hidden responses (`is_hidden` null or false), matching the responses route's default.
- **One job per type:** creating a `bulk_reanalyze` while one is active returns HTTP 409 (`"A job of this type is already running"`). Both features must surface this, not swallow it.
- Follow existing code style: 2-space indent, double-quoted strings, Tailwind utility classes, `text-xs`/`text-sm` sizing, color tokens (`text-seafoam`, `text-accent`, `text-muted`, `text-negative`).

---

### Task 1: IDs-only mode on the responses list route

Adds `?ids_only=true` to the existing responses GET route, returning every matching response ID (no per-page cap) using the exact same filters as the normal list. Consumed by Task 3.

**Files:**
- Modify: `app/api/dashboard/responses/route.ts`

**Interfaces:**
- Produces: `GET /api/dashboard/responses?tenant_id=…&ids_only=true` (plus any of `campaign_id`, `search`, `source`, `form`, `custom_*`, `show_hidden`, `sort`) → `{ ids: string[], total: number }`. All other params behave exactly as the normal list call.

- [ ] **Step 1: Read `ids_only` and make the select projection + range conditional**

In `app/api/dashboard/responses/route.ts`, after the existing `const showHidden = params.get("show_hidden") === "true";` line, add:

```ts
const idsOnly = params.get("ids_only") === "true";
```

Change the `query` initializer from:

```ts
  let query = db
    .from("responses")
    .select("id, person_id, campaign_id, transcription, themes, mood, sentiment, video_url, source_type, source_form_name, share_url, raw_analysis, is_hidden, created_at, person:people(name, email)", { count: "exact" })
    .eq("tenant_id", tenantId);
```

to:

```ts
  let query = db
    .from("responses")
    .select(
      idsOnly
        ? "id"
        : "id, person_id, campaign_id, transcription, themes, mood, sentiment, video_url, source_type, source_form_name, share_url, raw_analysis, is_hidden, created_at, person:people(name, email)",
      { count: "exact" }
    )
    .eq("tenant_id", tenantId);
```

Change the order/range block from:

```ts
  query = query
    .order("created_at", { ascending: sort === "oldest" })
    .range((page - 1) * perPage, page * perPage - 1);
```

to:

```ts
  query = query.order("created_at", { ascending: sort === "oldest" });
  if (!idsOnly) {
    query = query.range((page - 1) * perPage, page * perPage - 1);
  }
```

- [ ] **Step 2: Branch the response shape for ids_only**

Change the final return block from:

```ts
  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load responses" }, { status: 500 });

  return NextResponse.json({
    responses: data ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / perPage),
  });
```

to:

```ts
  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load responses" }, { status: 500 });

  if (idsOnly) {
    return NextResponse.json({
      ids: (data ?? []).map((r) => (r as { id: string }).id),
      total: count ?? 0,
    });
  }

  return NextResponse.json({
    responses: data ?? [],
    total: count ?? 0,
    page,
    totalPages: Math.ceil((count ?? 0) / perPage),
  });
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/dashboard/responses/route.ts
git commit -m "Add ids_only mode to responses list route"
```

---

### Task 2: Scope→IDs resolution in the jobs POST route

Lets a `bulk_reanalyze` job be created from a scope descriptor. The route resolves the scope to a concrete `response_ids` array at creation time and stores it, so the worker path is unchanged. Consumed by Task 4.

**Files:**
- Modify: `app/api/dashboard/jobs/route.ts`

**Interfaces:**
- Produces: `POST /api/dashboard/jobs` with `{ type: "bulk_reanalyze", params: { scope: "campaign", campaign_id } }` or `{ ... params: { scope: "tenant" } }`. Route resolves to `params.response_ids` before insert. Existing `{ params: { response_ids } }` callers are unaffected. Still returns 409 if a `bulk_reanalyze` is already active.

- [ ] **Step 1: Resolve scope to response_ids before the insert**

In `app/api/dashboard/jobs/route.ts` POST handler, the code currently has `const db = getServerClient();`, then the "existing active job" check, then `db.from("jobs").insert({ ... type, params: params ?? {}, ... })`.

Immediately after `const db = getServerClient();`, insert:

```ts
  // For bulk_reanalyze, a scope descriptor is resolved to concrete response IDs
  // at creation time so the worker's params.response_ids stays stable across
  // the batched, multi-invocation processing.
  let resolvedParams: Record<string, unknown> = params ?? {};
  if (type === "bulk_reanalyze" && resolvedParams.scope) {
    let scopeQuery = db
      .from("responses")
      .select("id")
      .eq("tenant_id", tenant_id)
      .or("is_hidden.is.null,is_hidden.eq.false");
    if (resolvedParams.scope === "campaign" && resolvedParams.campaign_id) {
      scopeQuery = scopeQuery.eq("campaign_id", resolvedParams.campaign_id);
    }
    const { data: scopeRows } = await scopeQuery;
    resolvedParams = { response_ids: (scopeRows ?? []).map((r) => (r as { id: string }).id) };
  }
```

- [ ] **Step 2: Use resolvedParams in the insert**

In the `db.from("jobs").insert({ ... })` call, change:

```ts
      params: params ?? {},
```

to:

```ts
      params: resolvedParams,
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/dashboard/jobs/route.ts
git commit -m "Resolve bulk_reanalyze scope to response IDs at job creation"
```

---

### Task 3: "Select all matching" on the Responses page

Adds a Gmail-style affordance: once the current page is fully selected and more matching responses exist, offer "Select all N responses", which fetches all IDs via Task 1 and selects them. All bulk actions (including delete, behind its existing confirm modal) then operate at full scale.

**Files:**
- Modify: `app/dashboard/responses/page.tsx`
- Modify: `app/components/BulkActionBar.tsx`
- Modify: `app/dashboard/people/page.tsx` (pass inert values for the new required props)

**Interfaces:**
- Consumes: `GET /api/dashboard/responses?…&ids_only=true` (Task 1).
- Produces: `BulkActionBar` gains **required** props `matchingTotal: number`, `allMatching: boolean`, `onSelectAllMatching: () => void`. Both call sites (Responses and People) must pass them.

- [ ] **Step 1: Add allMatching state + selectAllMatching handler in the page**

In `app/dashboard/responses/page.tsx`, after `const [selected, setSelected] = useState<Set<string>>(new Set());` add:

```ts
  const [allMatching, setAllMatching] = useState(false);
```

After the `toggleSelectAll` function, add:

```ts
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
```

- [ ] **Step 2: Reset allMatching when the selection is reset or filters change**

In `toggleSelectAll`, set `setAllMatching(false);` at the top of the function body (a fresh page-select is not an all-matching select):

```ts
  function toggleSelectAll() {
    setAllMatching(false);
    if (selected.size === responses.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(responses.map((r) => r.id)));
    }
  }
```

Add an effect (below the existing `useEffect(() => { fetchResponses(); }, [fetchResponses]);`) that clears selection whenever the filter set changes — but NOT on page change, so an all-matching selection survives pagination:

```ts
  useEffect(() => {
    setSelected(new Set());
    setAllMatching(false);
  }, [debouncedSearch, source, form, sort, customFilters, showHidden, activeCampaign]);
```

- [ ] **Step 3: Pass the new props to BulkActionBar and clear allMatching on clear**

In the `<BulkActionBar … />` usage, add the three props and update `onClear`:

```tsx
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
```

- [ ] **Step 4: Add the props to BulkActionBar and render the affordance**

In `app/components/BulkActionBar.tsx`, extend the props interface:

```ts
interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  matchingTotal: number;
  allMatching: boolean;
  onSelectAllMatching: () => void;
  target: "people" | "responses";
  tenantId: string;
  selectedIds: string[];
  allSelected: boolean;
  onToggleSelectAll: () => void;
  onAction: () => void;
  onClear: () => void;
  showHidden?: boolean;
}
```

Add the new params to the destructured function signature:

```ts
export function BulkActionBar({
  selectedCount,
  totalCount,
  matchingTotal,
  allMatching,
  onSelectAllMatching,
  target,
  tenantId,
  selectedIds,
  allSelected,
  onToggleSelectAll,
  onAction,
  onClear,
  showHidden,
}: BulkActionBarProps) {
```

Inside the `selectedCount > 0` branch, immediately after the existing `<span className="text-sm font-medium">{selectedCount} {plural}</span>`, insert the affordance:

```tsx
              {allMatching ? (
                <span className="text-xs text-muted">All {matchingTotal} selected</span>
              ) : allSelected && matchingTotal > totalCount ? (
                <button
                  onClick={onSelectAllMatching}
                  className="text-xs text-accent hover:underline"
                >
                  Select all {matchingTotal} {target === "people" ? "people" : "responses"}
                </button>
              ) : null}
```

- [ ] **Step 5: Satisfy the People page call site**

`app/dashboard/people/page.tsx` also renders `BulkActionBar`. The three new props are required, so add inert values there (wiring a full People select-all is out of scope). Change its `<BulkActionBar>` usage from:

```tsx
        <BulkActionBar
          selectedCount={selected.size}
          totalCount={people.length}
          target="people"
```

to:

```tsx
        <BulkActionBar
          selectedCount={selected.size}
          totalCount={people.length}
          matchingTotal={people.length}
          allMatching={false}
          onSelectAllMatching={() => {}}
          target="people"
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (both `BulkActionBar` call sites now pass all required props).

- [ ] **Step 7: Verify on a preview deploy**

Run: `vercel` (preview, not `--prod`), open the preview URL.
Check: On a campaign/filter with more than one page of responses, tick the header checkbox → "Select all N responses" link appears → click it → count jumps to the full total and shows "All N selected" → paginate and confirm checkboxes stay checked → Re-analyze creates a job in the JobBanner. Clear returns to page-only. Change a filter → selection resets.

- [ ] **Step 8: Commit**

```bash
git add app/dashboard/responses/page.tsx app/components/BulkActionBar.tsx app/dashboard/people/page.tsx
git commit -m "Add select-all-matching across pages on Responses"
```

---

### Task 4: "Re-analyze all" button + scope confirm on the Analysis Config page

Adds an explicit button (page auto-saves, so re-analysis is never auto-fired) that opens a modal offering "This campaign" or "Whole org", each showing its count, and creates a scoped `bulk_reanalyze` job. Surfaces the 409 already-running case.

**Files:**
- Modify: `app/dashboard/settings/analysis/page.tsx`

**Interfaces:**
- Consumes: `POST /api/dashboard/jobs` with scope params (Task 2); `GET /api/dashboard/responses?…&ids_only=true` for counts (Task 1).

- [ ] **Step 1: Add modal + count + status state**

In `app/dashboard/settings/analysis/page.tsx`, after `const [saved, setSaved] = useState(false);`, add:

```ts
  const [reanalyzeOpen, setReanalyzeOpen] = useState(false);
  const [campaignCount, setCampaignCount] = useState<number | null>(null);
  const [orgCount, setOrgCount] = useState<number | null>(null);
  const [reanalyzeStatus, setReanalyzeStatus] = useState("");
```

- [ ] **Step 2: Add handlers to open the modal (fetching counts) and to launch the job**

After the existing `handleSave` function, add:

```ts
  async function openReanalyze() {
    if (!tenant) return;
    setReanalyzeStatus("");
    setCampaignCount(null);
    setOrgCount(null);
    setReanalyzeOpen(true);
    const base = `/api/dashboard/responses?tenant_id=${tenant.id}&ids_only=true`;
    const [campaignRes, orgRes] = await Promise.all([
      activeCampaign
        ? fetch(`${base}&campaign_id=${activeCampaign.id}`).then((r) => r.json())
        : Promise.resolve({ total: 0 }),
      fetch(base).then((r) => r.json()),
    ]);
    setCampaignCount(campaignRes.total ?? 0);
    setOrgCount(orgRes.total ?? 0);
  }

  async function launchReanalyze(scope: "campaign" | "tenant") {
    if (!tenant) return;
    setReanalyzeStatus("Starting...");
    const res = await fetch("/api/dashboard/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenant.id,
        ...(scope === "campaign" && activeCampaign ? { campaign_id: activeCampaign.id } : {}),
        type: "bulk_reanalyze",
        params: scope === "campaign"
          ? { scope: "campaign", campaign_id: activeCampaign?.id }
          : { scope: "tenant" },
      }),
    });
    if (res.status === 409) {
      setReanalyzeStatus("A re-analysis is already running — watch its progress above.");
      return;
    }
    if (!res.ok) {
      setReanalyzeStatus("Couldn't start re-analysis. Try again.");
      return;
    }
    track("bulk_reanalyze", { scope });
    setReanalyzeOpen(false);
  }
```

- [ ] **Step 3: Add the button to the header actions**

In the header actions `<div className="flex items-center gap-3">` that holds the "Preview with sample" button, add before that button:

```tsx
          <button
            onClick={openReanalyze}
            className="text-xs text-seafoam hover:underline"
          >
            Re-analyze all
          </button>
```

- [ ] **Step 4: Render the scope confirm modal**

Immediately before the existing Preview `<Modal open={previewOpen} …>`, add:

```tsx
      <Modal
        open={reanalyzeOpen}
        onClose={() => setReanalyzeOpen(false)}
        title="Re-analyze responses"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Re-run AI analysis with the current criteria. This re-analyzes every
            response in the chosen scope and may take a few minutes.
          </p>
          <button
            onClick={() => launchReanalyze("campaign")}
            disabled={campaignCount === null || campaignCount === 0}
            className="soft-card p-3 text-left hover:shadow-lg transition-all disabled:opacity-50"
          >
            <p className="text-sm font-medium">This campaign</p>
            <p className="text-xs text-muted">
              Apply the criteria you just changed to all{" "}
              {campaignCount === null ? "…" : campaignCount} responses in this campaign.
            </p>
          </button>
          <button
            onClick={() => launchReanalyze("tenant")}
            disabled={orgCount === null || orgCount === 0}
            className="soft-card p-3 text-left hover:shadow-lg transition-all disabled:opacity-50"
          >
            <p className="text-sm font-medium">Whole org</p>
            <p className="text-xs text-muted">
              Refresh all {orgCount === null ? "…" : orgCount} responses across your
              organization. Each is re-run under its own campaign&apos;s criteria, not
              just this campaign&apos;s.
            </p>
          </button>
          {reanalyzeStatus && <p className="text-xs text-muted">{reanalyzeStatus}</p>}
        </div>
      </Modal>
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Verify on a preview deploy**

Run: `vercel` (preview), open the preview URL, go to Settings → Analysis with a campaign selected.
Check: "Re-analyze all" opens the modal with correct counts for This campaign and Whole org → clicking a scope creates a `bulk_reanalyze` job visible in the JobBanner and the modal closes → clicking again while it runs shows the "already running" message.

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/settings/analysis/page.tsx
git commit -m "Add Re-analyze all with scope choice on Analysis Config"
```

---

## Self-Review notes

- **Spec coverage:** Feature 1 → Tasks 1+3. Feature 2 → Tasks 2+4. Worker "accepts scope" requirement is satisfied by resolving scope→`response_ids` at creation (Task 2) rather than in the worker — a documented refinement made because `JobBanner` re-invokes the worker per batch and offsets into a fixed `response_ids`, so per-batch re-resolution would risk unstable ordering. 409 handling → Task 4 Step 2. Delete-all-across-pages stays armed via existing modal (no code needed — the existing bulk bar acts on `selectedIds`).
- **Scale note:** For very large orgs, Task 2 stores all IDs in the job's `params` JSON. Fine at current scale (hundreds). If orgs reach tens of thousands, revisit with worker-side cursor resolution.
- **People page:** `app/dashboard/people/page.tsx` also uses `BulkActionBar`; Task 3 Step 5 passes inert values for the new required props there. A full People select-all is out of scope.
