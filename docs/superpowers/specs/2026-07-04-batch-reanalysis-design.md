# Batch Re-analysis at Scale — Design

**Date:** 2026-07-04
**Status:** Approved, ready for implementation plan

## Problem

Two related gaps make it impossible to re-analyze a large set of responses in one go:

1. **Responses page** — "Select all" only selects the ~25 responses on the current
   pagination page. There is no way to select all matching responses (e.g. all 248)
   to run a single batch re-analysis.
2. **Analysis Config page** — after changing the analysis criteria for a campaign,
   there is no way to re-run analysis across existing responses so they reflect the
   new criteria.

## Shared engine (already exists)

Both features feed the existing `bulk_reanalyze` background job:

- Created via `POST /api/dashboard/jobs` with `type: "bulk_reanalyze"`.
- Processed by `processReanalyzeBatch` in `app/api/dashboard/jobs/process/route.ts`,
  which loops response IDs and, **for each response, re-fetches that response's
  campaign-specific analysis config** and re-runs analysis (updating themes, mood,
  sentiment, raw_analysis, persona, and re-evaluating flows).
- Runs in the background, so it does **not** hit the Vercel 300s function ceiling.
- Guardrail: only one active `bulk_reanalyze` per tenant at a time — a second
  request returns HTTP 409. Progress surfaces through the existing `JobBanner`.

Key consequence: **no new analysis logic is required.** Both features are just new
ways to hand the job a set of response IDs.

## Feature 1 — "Select all N" on the Responses page

### Behavior

- Header checkbox continues to select the responses on the current page (unchanged).
- When the entire current page is selected **and** there are more matching responses
  than are on the page, show a Gmail-style affordance in/near the `BulkActionBar`:

  > All 25 on this page are selected. **Select all 248 responses.**

- Clicking "Select all 248 responses" fetches every matching response ID (respecting
  all active filters) and adds them to the existing `selected` Set.
- When more than one page is selected this way, show a **Clear selection** action that
  returns to page-only selection (empties the Set).
- Because all IDs live in the existing `selected` Set, selection persists across
  pagination navigation, and every existing bulk action works at full scale:
  re-analyze, hide/unhide, delete, move.
- **Delete-all-across-pages stays armed**, routed through the existing delete
  confirmation modal, which already shows the count ("permanently delete 248 …").

### Server change

Add an IDs-only mode to the existing responses list route:

- `GET /api/dashboard/responses?...&ids_only=true`
- Returns `{ ids: string[], total: number }` — just the IDs of every response
  matching the **current filter set** (tenant, campaign, search, source, form,
  custom analysis-field filters, show_hidden), with **no per-page cap**.
- Reuses the exact same query-building logic as the normal list path; only the
  `select(...)` projection and pagination differ (select `id` only, no `.range()`).

### Client change (`app/dashboard/responses/page.tsx`)

- Track whether an "all matching" selection is active (derive from
  `selected.size > responses.length`, or an explicit `allMatching` boolean).
- Add a `selectAllMatching()` handler that calls the `ids_only` endpoint with the
  current params and sets `selected` to the returned IDs.
- Pass the affordance state/handlers into `BulkActionBar` (or render the
  "Select all N / Clear selection" line adjacent to it).

## Feature 2 — "Re-analyze all" on the Analysis Config page

### Behavior

- The Analysis Config page **auto-saves** as the user edits (≈1.5s debounce), so
  re-analysis must **not** be tied to save. Instead, add an **explicit button**:

  > Re-analyze all responses with current criteria

- Clicking it opens a confirmation with a **scope choice**:
  - **This campaign** — re-analyze every response in the active campaign. This is
    the "apply the criteria I just changed" path.
  - **Whole org** — re-analyze every response across the org. Because the worker
    re-fetches each response's own campaign config, this re-runs each response under
    **its own** campaign's criteria — i.e. "refresh everything with current settings,"
    not "apply the criteria I just edited to every campaign."
- The confirm shows the affected count and states that this re-runs AI analysis on
  N responses (a real cost/time action).
- On confirm, create one `bulk_reanalyze` job scoped accordingly.
- If a `bulk_reanalyze` is already running, surface the 409 as a friendly message
  ("A re-analysis is already running — watch its progress above") rather than a
  silent failure.

### Confirm copy (scope-aware)

- This campaign:
  > Re-analyze all {N} responses in this campaign with the current criteria?
  > This re-runs AI analysis on every response and may take a few minutes.
- Whole org:
  > Re-analyze all {N} responses across your whole organization? Each response is
  > re-run under its own campaign's criteria (not just this campaign's). This
  > re-runs AI analysis on every response and may take a few minutes.

## Worker change (`processReanalyzeBatch`)

Extend the job to accept **either** shape of `params`:

- `{ response_ids: string[] }` — explicit IDs. Used by Feature 1's select-all and the
  existing per-page bulk bar. **Unchanged path.**
- `{ scope: "campaign", campaign_id }` or `{ scope: "tenant" }` — a scope descriptor.
  The worker resolves the ID list server-side (query `responses` by tenant, and by
  `campaign_id` when scoped to a campaign; active/non-hidden responses only) before
  running the same per-response re-analysis loop. Used by Feature 2 so a large org
  set never round-trips through the client.

The jobs POST route's `bulk_reanalyze` validation must accept params carrying a
`scope` in addition to `response_ids`.

## Scope decisions / non-goals

- Feature 1's cross-page select respects **all** active filters and hidden-mode.
- Feature 1 arms all bulk actions (including delete) at full scale; delete stays
  gated by the existing count-confirmation modal.
- Feature 2's "This campaign" and "Whole org" both target **active (non-hidden)**
  responses.
- Not building: an "only responses not yet analyzed under the new criteria" filter
  (re-analysis is a full re-run of the selected set — simpler and predictable).
- Not building: partial-progress resumption beyond what the existing job/JobBanner
  system already provides.

## Testing

- `ids_only` route returns exactly the IDs the normal list would return across all
  pages for a given filter combination (parity test across a couple of filter sets).
- Select-all-matching populates the Set with all IDs; Clear returns to page-only.
- `processReanalyzeBatch` resolves the correct ID set for `scope: campaign` and
  `scope: tenant`, and still honors `response_ids` when present.
- Jobs POST accepts `scope` params and rejects malformed ones.
- 409 (already-running) surfaces as a friendly message on the Analysis Config page.
