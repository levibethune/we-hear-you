# Handoff — 2026-07-07

## Read this first
Newest handoff for We Hear You. Next session is **quality-of-life + housekeeping** (Levi's call on specifics). Candidates are listed at the bottom.

## What shipped this session
**Batch re-analysis at scale** — merged to `main`, live in prod at **app.wehearyou.io** (verified 200). Two features, one shared engine.

1. **Responses page — "Select all N" across pages.** Header checkbox still selects the current page; once the page is fully selected and more matches exist, a "Select all N responses" affordance selects every response matching the active filters. Powers batch re-analyze (and hide/delete/move) over the whole filtered set, not just the page.
2. **Analysis Config — "Re-analyze all" button.** Explicit button (never auto-fires; page auto-saves) → modal with **This campaign / Whole org** scope choice, each showing its count → creates a scoped `bulk_reanalyze` job.

Spec: `docs/superpowers/specs/2026-07-04-batch-reanalysis-design.md`
Plan: `docs/superpowers/plans/2026-07-06-batch-reanalysis.md`
Branch `batch-reanalysis` merged (`a704e14`) and deleted. 7 feature commits, each reviewed.

## How it works (for anyone touching re-analysis next)
- **One job engine.** Both features feed the existing `bulk_reanalyze` job. Worker `processReanalyzeBatch` in `app/api/dashboard/jobs/process/route.ts` loops `params.response_ids`, and **re-fetches each response's own campaign analysis config** before re-running — so changing criteria then re-analyzing "just works." The worker was intentionally NOT modified this session.
- **Batch processing is client-polled.** `JobBanner` polls `/api/dashboard/jobs` every 3s and calls `/api/dashboard/jobs/process` repeatedly; the worker processes one `BATCH_SIZE` slice per call. This is why `params.response_ids` must be a stable list — scope is resolved to concrete IDs at **job-creation time** in `app/api/dashboard/jobs/route.ts`, not per-batch.
- **`ids_only` mode.** `GET /api/dashboard/responses?...&ids_only=true` → `{ ids, total }` for the full filtered set. A shared `buildResponsesQuery` helper guarantees the ids_only and normal-list paths apply identical filters.
- **`max_rows = 1000` (supabase/config.toml) is the load-bearing constraint.** PostgREST caps every query at 1000 rows regardless of `.range()`. Both the `ids_only` route AND the jobs-route scope resolution page in 1000-row chunks to defeat it. If you write another "fetch all matching" path, chunk it too or it will silently truncate. `ID_PAGE_SIZE`/`SCOPE_PAGE_SIZE` must stay ≥ `max_rows`.
- **Scope contract:** `POST /api/dashboard/jobs` with `{ type: "bulk_reanalyze", params: { scope: "campaign", campaign_id } | { scope: "tenant" } }`. Campaign scope without `campaign_id` → 400. Active (non-hidden) responses only.
- **Concurrency guard:** one active `bulk_reanalyze` per tenant → 409 "already running." Surfaced on both entry points (Analysis Config modal + the Responses bulk bar).

## Landmine fixed this session (don't reintroduce)
The `/api/dashboard/bulk` endpoint caps non-reanalyze actions (hide/unhide/delete/move) at **100 ids** and 400s above that; `handleBulk` used to ignore `res.ok` → a "select all 248 → Delete" **silently deleted nothing and reported success**. Now `handleBulk` chunks to 100/request and surfaces failures. Re-analyze is safe because it routes through the uncapped `/jobs` path. Caught by the final whole-branch review, invisible to per-task reviews.

## Working conventions confirmed here
- **No test harness** in this repo. Gate = `npx tsc --noEmit` + a production `next build` (the preview/prod deploy is the real gate). Verify on a **preview deploy** (`vercel`), never localhost.
- **Deploy:** `vercel --prod --yes` under the `detectiveagency` scope auto-aliases to `app.wehearyou.io` (no manual alias step needed here, unlike Girl Weather). Preview via `vercel --yes`. Copy URLs to clipboard; commit + push `main` after deploy.
- SDD scratch (briefs/reports/ledger) lives in `.superpowers/sdd/` (gitignored).

## Next session — QoL + housekeeping candidates
- **Cosmetic (known, deferred):** during an all-matching selection, the header checkbox reads unchecked on pages 2+ because `allSelected = selected.size === responses.length` (25≠248). "All N selected" text still shows. Fix = derive the header checked-state from `allMatching` too.
- **vercel.json cleanup:** deploy logs warn the `memory` setting is ignored on Active CPU billing — safe to remove.
- **People page:** cross-page select-all is NOT wired there (inert props passed to satisfy types), and People→Re-analyze still fetches response IDs with a `per_page=100` cap (pre-existing). Candidate to unify with the Responses pattern if People needs scale.
- **Open product call (Levi):** cross-page select-all currently arms Delete/Hide/Move at full scale (behind the count-confirm modal), per approved spec. Option to restrict cross-page select to re-analyze-only if that feels too sharp.
- Whatever else Levi brings to the QoL/housekeeping list.
