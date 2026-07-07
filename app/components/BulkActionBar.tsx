"use client";

import { useState } from "react";
import { useAuthContext } from "./AuthProvider";
import { Modal } from "./Modal";
import { track } from "../lib/analytics";

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
  const { tenants } = useAuthContext();
  const [acting, setActing] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [bulkError, setBulkError] = useState("");

  async function handleBulk(action: string, moveToTenantId?: string) {
    setActing(true);
    setBulkError("");
    const CHUNK = 100; // /api/dashboard/bulk caps non-reanalyze actions at 100 ids
    let ok = true;
    for (let i = 0; i < selectedIds.length; i += CHUNK) {
      const res = await fetch("/api/dashboard/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenantId,
          action,
          target,
          ids: selectedIds.slice(i, i + CHUNK),
          move_to_tenant_id: moveToTenantId,
        }),
      });
      if (!res.ok) { ok = false; break; }
    }
    setActing(false);
    setMoveOpen(false);
    setConfirmDelete(false);
    if (!ok) {
      setBulkError("Something went wrong — not all items were updated. Refresh and try again.");
      onAction(); // refresh to reflect any partial changes
      return;
    }
    track(`bulk_${action}`, { target, count: selectedIds.length });
    onAction();
  }

  async function handleReanalyze() {
    setReanalyzing(true);
    setBulkError("");

    // For responses, use the IDs directly. For people, we need their response IDs.
    let responseIds = selectedIds;
    if (target === "people") {
      // Fetch response IDs for selected people
      const res = await fetch(`/api/dashboard/responses?tenant_id=${tenantId}&per_page=100`);
      const data = await res.json();
      responseIds = (data.responses ?? [])
        .filter((r: { person_id: string }) => selectedIds.includes(r.person_id))
        .map((r: { id: string }) => r.id);
    }

    // Create a background job
    const res = await fetch("/api/dashboard/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenantId,
        type: "bulk_reanalyze",
        params: { response_ids: responseIds },
      }),
    });

    setReanalyzing(false);
    if (res.status === 409) {
      setBulkError("A re-analysis is already running — watch its progress above.");
      return;
    }
    if (!res.ok) {
      setBulkError("Couldn't start re-analysis. Try again.");
      return;
    }
    track("bulk_reanalyze", { target, count: responseIds.length });
    onAction();
  }

  const otherTenants = tenants.filter((t) => t.id !== tenantId);
  const label = target === "people" ? "person" : "response";
  const plural = selectedCount === 1 ? label : `${label}s`;

  return (
    <>
      <div style={{ minHeight: "2.5rem" }}>
        <div className="flex items-center gap-3 h-8">
          <input
            type="checkbox"
            checked={allSelected && totalCount > 0}
            onChange={onToggleSelectAll}
          />

          {selectedCount > 0 ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {selectedCount} {plural}
              </span>

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

              <div className="h-3.5 w-px bg-muted/20" />

              {showHidden ? (
                <button onClick={() => handleBulk("unhide")} disabled={acting} className="text-xs text-seafoam hover:underline disabled:opacity-50">Unhide</button>
              ) : (
                <button onClick={() => handleBulk("hide")} disabled={acting} className="text-xs text-sunshine hover:underline disabled:opacity-50">Hide</button>
              )}

              <button onClick={handleReanalyze} disabled={acting || reanalyzing} className="text-xs text-seafoam hover:underline disabled:opacity-50">
                {reanalyzing ? "Re-analyzing..." : "Re-analyze"}
              </button>

              <button onClick={() => setConfirmDelete(true)} disabled={acting} className="text-xs text-negative hover:underline disabled:opacity-50">Delete</button>

              {otherTenants.length > 0 && (
                <button onClick={() => setMoveOpen(true)} disabled={acting} className="text-xs text-accent hover:underline disabled:opacity-50">Move to...</button>
              )}

              <div className="h-3.5 w-px bg-muted/20" />

              <button onClick={onClear} className="text-xs text-muted hover:text-foreground">Clear</button>

              {bulkError && <span className="text-xs text-negative">{bulkError}</span>}
            </div>
          ) : (
            <span className="text-xs text-muted">Select all</span>
          )}
        </div>
      </div>

      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete permanently?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">This will permanently delete {selectedCount} {plural} and all associated data. This action cannot be undone.</p>
          <div className="flex items-center gap-3">
            <button onClick={() => handleBulk("delete")} disabled={acting} className="text-sm text-negative hover:underline disabled:opacity-50">{acting ? "Deleting..." : "Yes, delete permanently"}</button>
            <button onClick={() => setConfirmDelete(false)} className="text-sm text-muted hover:text-foreground">Cancel</button>
          </div>
        </div>
      </Modal>

      <Modal open={moveOpen} onClose={() => setMoveOpen(false)} title="Move to organization">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Move {selectedCount} {plural} to another organization you have access to.</p>
          {otherTenants.map((t) => (
            <button key={t.id} onClick={() => handleBulk("move", t.id)} disabled={acting} className="soft-card p-3 text-left hover:shadow-lg transition-all disabled:opacity-50">
              <p className="text-sm font-medium">{t.name}</p>
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
