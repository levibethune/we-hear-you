"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuthContext } from "./AuthProvider";

interface Job {
  id: string;
  type: string;
  status: string;
  progress: { current: number; total: number; imported: number; skipped: number; failed: number };
  result: Record<string, unknown> | null;
  error: string | null;
}

const typeLabels: Record<string, string> = {
  import_csv: "CSV Import",
  import_links: "Link Import",
  reanalyze: "Re-analysis",
  bulk_reanalyze: "Bulk Re-analysis",
};

export function JobBanner() {
  const { tenant } = useAuthContext();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const processingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!tenant) return;
    try {
      const res = await fetch(`/api/dashboard/jobs?tenant_id=${tenant.id}`);
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch {
      // silently fail
    }
  }, [tenant]);

  // Poll for job status every 3 seconds
  useEffect(() => {
    fetchJobs();
    intervalRef.current = setInterval(fetchJobs, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchJobs]);

  // Auto-process active jobs
  useEffect(() => {
    const activeJobs = jobs.filter((j) => j.status === "pending" || j.status === "processing");
    if (activeJobs.length === 0 || processingRef.current || !tenant) return;

    const processNext = async () => {
      processingRef.current = true;
      for (const job of activeJobs) {
        try {
          await fetch("/api/dashboard/jobs/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_id: job.id, tenant_id: tenant.id }),
          });
        } catch {
          // continue
        }
      }
      processingRef.current = false;
      fetchJobs();
    };

    processNext();
  }, [jobs, tenant, fetchJobs]);

  const visibleJobs = jobs.filter(
    (j) => !dismissed.has(j.id) && (j.status === "pending" || j.status === "processing" || j.status === "completed" || j.status === "failed")
  );

  if (visibleJobs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {visibleJobs.map((job) => {
        const p = job.progress;
        const pct = p.total > 0 ? Math.round((p.current / p.total) * 100) : 0;
        const label = typeLabels[job.type] ?? job.type;
        const isActive = job.status === "pending" || job.status === "processing";
        const isDone = job.status === "completed";
        const isFailed = job.status === "failed";

        return (
          <div
            key={job.id}
            className={`soft-card px-4 py-3 shadow-lg ${isFailed ? "border-l-[3px] border-l-negative" : isDone ? "border-l-[3px] border-l-seafoam" : ""}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{label}</span>
              {!isActive && (
                <button
                  onClick={() => setDismissed((prev) => new Set([...prev, job.id]))}
                  className="text-xs text-muted hover:text-foreground"
                >
                  &times;
                </button>
              )}
            </div>

            {isActive && (
              <>
                <div className="flex items-center justify-between text-xs text-muted mb-1.5">
                  <span>{p.current} of {p.total} processed</span>
                </div>
                <div className="h-1.5 rounded-full bg-input-bg overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {p.imported > 0 && (
                  <p className="text-[10px] text-muted mt-1">
                    {p.imported} imported, {p.skipped} skipped
                  </p>
                )}
              </>
            )}

            {isDone && (
              <div className="text-xs text-muted">
                <span className="text-seafoam font-medium">Complete</span>
                {" \u2014 "}
                {(job.result as Record<string, number>)?.imported ?? (job.result as Record<string, number>)?.processed ?? 0} processed
                {p.skipped > 0 && `, ${p.skipped} skipped`}
                {p.failed > 0 && `, ${p.failed} failed`}
              </div>
            )}

            {isFailed && (
              <p className="text-xs text-negative">{job.error ?? "Job failed"}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
