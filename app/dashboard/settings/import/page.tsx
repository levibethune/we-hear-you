"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthContext } from "../../../components/AuthProvider";
import { OrgBanner } from "../../../components/OrgBanner";
import { track } from "../../../lib/analytics";

function parseCSVAllRows(text: string): { date: string; name: string; email: string; transcription: string; share_url: string }[] {
  const lines = text.split("\n");
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseRow(lines[0]);
  const dateIdx = headers.findIndex((h) => h.toLowerCase().includes("date"));
  const nameIdx = headers.findIndex((h) => h.toLowerCase() === "name");
  const emailIdx = headers.findIndex((h) => h.toLowerCase() === "email");

  const questionCols: number[] = [];
  const urlCols: number[] = [];
  for (let i = 0; i < headers.length; i++) {
    if (/^Q\d+\./.test(headers[i]) && !headers[i].includes("Video/Audio") && !headers[i].includes("Media Duration")) {
      questionCols.push(i);
    }
    if (headers[i].includes("Video/Audio URLs")) urlCols.push(i);
  }

  const rows: { date: string; name: string; email: string; transcription: string; share_url: string }[] = [];
  let currentRow = "";

  for (let i = 1; i < lines.length; i++) {
    currentRow += (currentRow ? "\n" : "") + lines[i];
    const quoteCount = (currentRow.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) continue;

    const fields = parseRow(currentRow);
    currentRow = "";

    if (fields.length < Math.max(emailIdx, nameIdx, dateIdx) + 1) continue;

    const transcriptionParts: string[] = [];
    for (const qi of questionCols) {
      const val = fields[qi];
      if (val) {
        const clean = val.replace(/^\[Transcribed\]\s*/i, "").trim();
        if (clean) transcriptionParts.push(clean);
      }
    }

    let shareUrl = "";
    for (const ui of urlCols) {
      if (fields[ui]) { shareUrl = fields[ui]; break; }
    }

    const email = fields[emailIdx] ?? "";

    rows.push({
      date: fields[dateIdx] ?? "",
      name: fields[nameIdx] ?? "",
      email,
      transcription: transcriptionParts.join("\n\n"),
      share_url: shareUrl,
    });
  }

  return rows;
}

export default function ImportPage() {
  const { tenant, activeCampaignId } = useAuthContext();
  const searchParams = useSearchParams();

  // Quick import state
  const [linkUrl, setLinkUrl] = useState("");
  const [linkImporting, setLinkImporting] = useState(false);
  const [linkResult, setLinkResult] = useState<{ imported: boolean; person?: { id: string; name: string; email: string }; analysis?: Record<string, unknown>; message?: string } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Multi-link import state
  const [multiMode, setMultiMode] = useState(false);
  const [multiLinks, setMultiLinks] = useState("");
  const [multiImporting, setMultiImporting] = useState(false);
  const [multiProgress, setMultiProgress] = useState<{ current: number; total: number; results: { url: string; name?: string; status: "imported" | "skipped" | "error"; message?: string }[] } | null>(null);

  // CSV import state
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvProgress, setCsvProgress] = useState<{ current: number; total: number; totalParsed: number; imported: number; skipped: number; failed: number; skippedNoEmail: number; skippedNoTranscription: number; skippedDuplicate: number } | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvFormName, setCsvFormName] = useState("");

  const [connected, setConnected] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const [formId, setFormId] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    failed: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check for OAuth callback results in URL
  useEffect(() => {
    const oauthError = searchParams.get("oauth_error");
    const oauthSuccess = searchParams.get("oauth_success");
    if (oauthError) setError(oauthError);
    if (oauthSuccess) setConnected(true);
  }, [searchParams]);

  // Check connection status on load
  useEffect(() => {
    if (!tenant) return;
    fetch(`/api/dashboard/oauth/videoask?tenant_id=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => {
        setConnected(data.connected && !data.expired);
        setCheckingConnection(false);
      })
      .catch(() => setCheckingConnection(false));
  }, [tenant]);

  async function handleConnect() {
    if (!tenant) return;
    setConnecting(true);
    setError(null);
    const res = await fetch("/api/dashboard/oauth/videoask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant.id }),
    });
    const data = await res.json();
    setConnecting(false);

    if (data.authorizeUrl) {
      window.location.href = data.authorizeUrl;
    } else {
      setError(data.error || "Failed to start connection");
    }
  }

  async function handleDisconnect() {
    if (!tenant) return;
    await fetch("/api/dashboard/oauth/videoask", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant.id }),
    });
    setConnected(false);
  }

  async function handleImport() {
    if (!tenant) return;
    setImporting(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/dashboard/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenant.id, ...(activeCampaignId ? { campaign_id: activeCampaignId } : {}),
          form_id: formId.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }

    setImporting(false);
  }

  return (
    <div className="max-w-2xl">
      <OrgBanner />
      <h2 className="text-lg font-bold mb-1">Import Responses</h2>
      <p className="text-sm text-muted mb-4">
        Pull in responses that were recorded before you connected the webhook.
        Connect your VideoAsk account, and we&apos;ll fetch your existing data,
        run it through your analysis configuration, and add everything to your
        dashboard. Responses that have already been imported are skipped
        automatically.
      </p>
      {/* Quick Import — paste link(s) */}
      <div className="soft-card p-5 mb-6">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-medium">Quick Import</h4>
          <button
            onClick={() => { setMultiMode(!multiMode); setMultiProgress(null); setLinkResult(null); setLinkError(null); }}
            className="text-xs text-accent hover:underline"
          >
            {multiMode ? "Single link" : "Paste multiple links"}
          </button>
        </div>
        <p className="text-xs text-muted mb-4">
          {multiMode
            ? "Paste multiple VideoAsk share links, one per line. Each will be imported and analyzed in sequence."
            : "Paste a VideoAsk share link to import a single response. In VideoAsk, open a response, click Share, enable \u201CShare individual answer,\u201D and copy the link."}
        </p>

        {!multiMode ? (
          <>
            {/* Single link mode */}
            <div className="flex gap-2 mb-3">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://www.videoask.com/abc123..."
                className="text-sm flex-1"
              />
              <button
                onClick={async () => {
                  if (!tenant || !linkUrl.trim()) return;
                  setLinkImporting(true);
                  setLinkResult(null);
                  setLinkError(null);
                  try {
                    const res = await fetch("/api/dashboard/import-link", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ tenant_id: tenant.id, ...(activeCampaignId ? { campaign_id: activeCampaignId } : {}), url: linkUrl.trim() }),
                    });
                    const data = await res.json();
                    if (data.error) {
                      setLinkError(data.error);
                    } else {
                      setLinkResult(data);
                      if (data.imported) {
                        setLinkUrl("");
                        track("import_link", { name: data.person?.name });
                      }
                    }
                  } catch {
                    setLinkError("Something went wrong.");
                  }
                  setLinkImporting(false);
                }}
                disabled={linkImporting || !linkUrl.trim()}
                className="neu-button-primary text-sm shrink-0"
              >
                {linkImporting ? "Importing..." : "Import"}
              </button>
            </div>

            {linkError && (
              <div className="soft-card p-3 border-l-[3px] border-l-negative">
                <p className="text-sm text-negative">{linkError}</p>
              </div>
            )}

            {linkResult && linkResult.imported && (
              <div className="soft-card p-3 border-l-[3px] border-l-seafoam">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-seafoam font-medium mb-1">Imported successfully</p>
                    <p className="text-xs text-muted">
                      {linkResult.person?.name ?? linkResult.person?.email} &mdash;{" "}
                      {(linkResult.analysis as Record<string, unknown>)?.sentiment as string},{" "}
                      {(linkResult.analysis as Record<string, unknown>)?.mood as string}
                    </p>
                  </div>
                  <a
                    href={`/dashboard/people/${linkResult.person?.id}`}
                    className="text-xs text-accent hover:underline shrink-0 mt-0.5"
                  >
                    Go to response &rarr;
                  </a>
                </div>
              </div>
            )}

            {linkResult && !linkResult.imported && (
              <div className="soft-card p-3 border-l-[3px] border-l-sunshine">
                <p className="text-sm text-sunshine">{linkResult.message}</p>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Multi-link mode */}
            <textarea
              value={multiLinks}
              onChange={(e) => setMultiLinks(e.target.value)}
              placeholder={"https://www.videoask.com/abc123...\nhttps://www.videoask.com/def456...\nhttps://www.videoask.com/ghi789..."}
              rows={5}
              className="text-sm w-full font-mono mb-3"
              disabled={multiImporting}
            />

            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted">
                {multiLinks.trim()
                  ? `${multiLinks.trim().split("\n").filter(l => l.trim()).length} link${multiLinks.trim().split("\n").filter(l => l.trim()).length !== 1 ? "s" : ""} detected`
                  : "Paste one link per line"}
              </p>
              <button
                onClick={async () => {
                  if (!tenant) return;
                  const urls = multiLinks.trim().split("\n").map(l => l.trim()).filter(Boolean);
                  if (urls.length === 0) return;

                  setMultiImporting(true);

                  const res = await fetch("/api/dashboard/jobs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      tenant_id: tenant.id, ...(activeCampaignId ? { campaign_id: activeCampaignId } : {}),
                      type: "import_links",
                      params: { urls },
                    }),
                  });
                  const data = await res.json();

                  setMultiImporting(false);

                  if (data.error) {
                    setMultiProgress({ current: 0, total: 0, results: [{ url: "", status: "error", message: data.error }] });
                  } else {
                    setMultiLinks("");
                    setMultiProgress({ current: 0, total: urls.length, results: [{ url: "", status: "imported", message: `Job started \u2014 ${urls.length} links queued. Progress appears in the bottom-right corner.` }] });
                    track("import_multi_link_started", { total: urls.length });
                  }
                }}
                disabled={multiImporting || !multiLinks.trim()}
                className="neu-button-primary text-sm"
              >
                {multiImporting
                  ? `Importing ${multiProgress?.current ?? 0} of ${multiProgress?.total ?? 0}...`
                  : "Import all"}
              </button>
            </div>

            {/* Progress */}
            {multiProgress && multiProgress.results.length > 0 && (
              <div className="flex flex-col gap-2">
                {multiProgress.results.map((r, i) => (
                  <div
                    key={i}
                    className={`soft-card p-3 border-l-[3px] ${
                      r.status === "imported"
                        ? "border-l-seafoam"
                        : r.status === "skipped"
                        ? "border-l-sunshine"
                        : "border-l-negative"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-xs font-medium ${
                          r.status === "imported"
                            ? "text-seafoam"
                            : r.status === "skipped"
                            ? "text-sunshine"
                            : "text-negative"
                        }`}>
                          {r.status === "imported" ? "Imported" : r.status === "skipped" ? "Skipped" : "Failed"}
                          {r.name && ` — ${r.name}`}
                        </p>
                        {r.message && (
                          <p className="text-xs text-muted">{r.message}</p>
                        )}
                        <p className="text-[10px] text-muted/50 font-mono truncate mt-0.5">{r.url}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {!multiImporting && (
                  <p className="text-xs text-muted text-center mt-2">
                    {multiProgress.results.filter(r => r.status === "imported").length} imported,{" "}
                    {multiProgress.results.filter(r => r.status === "skipped").length} skipped,{" "}
                    {multiProgress.results.filter(r => r.status === "error").length} failed
                    {" — "}
                    <a href="/dashboard/responses" className="text-accent hover:underline">
                      View responses &rarr;
                    </a>
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* CSV Import */}
      <div className="soft-card p-5 mb-6">
        <h4 className="text-base font-bold mb-1">CSV Import</h4>
        <p className="text-xs text-muted mb-4">
          Export a CSV from VideoAsk (Settings &rarr; Export data &rarr; CSV file) and
          upload it here. This is the easiest way to import all responses from a form
          you don&apos;t own — no OAuth or share links needed.
        </p>

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-muted mb-1.5 block">Form name (optional)</label>
            <input
              type="text"
              value={csvFormName}
              onChange={(e) => setCsvFormName(e.target.value)}
              placeholder="e.g., Onboarding Survey"
              className="text-sm w-full"
            />
          </div>

          <div>
            <label className="text-xs text-muted mb-1.5 block">CSV file</label>
            <label className="neu-button-primary text-sm inline-block cursor-pointer">
              {csvImporting ? `Importing ${csvProgress?.current ?? 0} of ${csvProgress?.total ?? 0}...` : "Choose CSV file"}
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !tenant) return;

                setCsvImporting(true);
                setCsvProgress(null);
                setCsvError(null);

                try {
                  const text = await file.text();
                  const rawName = file.name.split("/").pop()?.split("\\").pop() ?? file.name;
                  const formName = csvFormName.trim() || rawName.replace(/\.csv$/i, "").replace(/\+/g, " ").replace(/\|/g, " | ");

                  // Parse CSV client-side (includes all rows, even empty ones)
                  const allRows = parseCSVAllRows(text);
                  if (allRows.length === 0) {
                    setCsvError("No valid rows found in CSV.");
                    setCsvImporting(false);
                    return;
                  }

                  // Separate valid rows from filtered ones
                  const validRows = allRows.filter(r => r.email && r.email !== "N/A" && r.transcription);
                  const noEmail = allRows.filter(r => !r.email || r.email === "N/A").length;
                  const noTranscription = allRows.filter(r => r.email && r.email !== "N/A" && !r.transcription).length;

                  // Create a background job instead of processing inline
                  const res = await fetch("/api/dashboard/jobs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      tenant_id: tenant.id, ...(activeCampaignId ? { campaign_id: activeCampaignId } : {}),
                      type: "import_csv",
                      params: { rows: validRows, form_name: formName },
                    }),
                  });

                  const data = await res.json();
                  if (data.error) {
                    setCsvError(data.error);
                  } else {
                    setCsvProgress({
                      current: 0, total: validRows.length, totalParsed: allRows.length,
                      imported: 0, skipped: noEmail + noTranscription, failed: 0,
                      skippedNoEmail: noEmail, skippedNoTranscription: noTranscription, skippedDuplicate: 0,
                    });
                    track("import_csv_started", { total: validRows.length, skipped_pre: noEmail + noTranscription });
                  }
                } catch {
                  setCsvError("Failed to read CSV file.");
                  track("import_csv_failed");
                }
                setCsvImporting(false);
              }}
              disabled={csvImporting}
              />
            </label>
          </div>

          {csvImporting && csvProgress && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted">
                  Processing {csvProgress.current} of {csvProgress.total}...
                </p>
                <p className="text-xs text-muted">
                  {csvProgress.imported} imported, {csvProgress.skipped} skipped
                </p>
              </div>
              <div className="h-2 rounded-full bg-input-bg overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${(csvProgress.current / csvProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {csvError && (
            <div className="soft-card p-3 border-l-[3px] border-l-negative">
              <p className="text-sm text-negative">{csvError}</p>
            </div>
          )}

          {!csvImporting && csvProgress && csvProgress.current === csvProgress.total && (
            <div className="soft-card p-3 border-l-[3px] border-l-seafoam">
              <p className="text-sm text-seafoam font-medium mb-2">CSV import complete</p>
              <div className="flex flex-col gap-1 text-xs text-muted">
                <p><span className="text-foreground font-medium">{csvProgress.totalParsed}</span> rows found in CSV</p>
                <p><span className="text-seafoam font-medium">{csvProgress.imported}</span> responses imported and analyzed</p>
                {csvProgress.skippedDuplicate > 0 && (
                  <p><span className="text-foreground">{csvProgress.skippedDuplicate}</span> skipped — already imported</p>
                )}
                {csvProgress.skippedNoEmail > 0 && (
                  <p><span className="text-foreground">{csvProgress.skippedNoEmail}</span> skipped — no email address</p>
                )}
                {csvProgress.skippedNoTranscription > 0 && (
                  <p><span className="text-foreground">{csvProgress.skippedNoTranscription}</span> skipped — no transcription</p>
                )}
                {csvProgress.failed > 0 && (
                  <p><span className="text-negative">{csvProgress.failed}</span> failed to import</p>
                )}
              </div>
              <a href="/dashboard/responses" className="text-xs text-accent hover:underline mt-3 inline-block">
                View responses &rarr;
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Import — OAuth-based */}
      <div className="soft-card p-5">
        <h4 className="text-base font-bold mb-1">Bulk Import</h4>
        <p className="text-xs text-muted mb-4">
          Connect your VideoAsk account to import all responses from a form at once.
          This requires OAuth authorization and only imports forms created by the
          account you connect with. For forms created by others in your organization,
          use the Quick Import above with individual share links.
        </p>

        <div className="flex flex-col gap-6">
          {/* Step 1: Connect */}
          <div className="neu-inset p-4">
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-sm font-medium">Step 1: Connect VideoAsk</h5>
              {connected && (
                <span className="text-xs text-seafoam bg-seafoam/10 px-2 py-0.5 rounded-full">
                  Connected
                </span>
              )}
            </div>

            {checkingConnection ? (
              <p className="text-sm text-muted">Checking connection...</p>
            ) : connected ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">
                  Your VideoAsk account is connected and ready to import.
                </p>
                <button
                  onClick={handleDisconnect}
                  className="text-xs text-muted hover:text-negative transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted mb-3">
                  Authorize We Hear You to access your VideoAsk responses.
                  You&apos;ll be redirected to VideoAsk to approve, then sent
                  back here.
                </p>
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="neu-button-primary text-sm"
                >
                  {connecting ? "Connecting..." : "Connect VideoAsk"}
                </button>
              </div>
            )}
          </div>

          {/* Step 2: Import */}
          <div className={`neu-inset p-4 ${!connected ? "opacity-50 pointer-events-none" : ""}`}>
            <h5 className="text-sm font-medium mb-3">Step 2: Import responses</h5>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">
                  Form ID{" "}
                  <span className="text-muted font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  placeholder="Leave blank to import from all forms"
                  className="text-sm"
                  disabled={!connected}
                />
                <p className="text-xs text-muted mt-1">
                  To import from one specific form, paste the form ID from the
                  URL when you open it in VideoAsk.
                </p>
              </div>

              {error && (
                <div className="soft-card p-3 border-l-[3px] border-l-negative">
                  <p className="text-sm text-negative">{error}</p>
                </div>
              )}

              {result && (
                <div className="soft-card p-3 border-l-[3px] border-l-seafoam">
                  <p className="text-sm text-seafoam font-medium mb-1">Import complete</p>
                  <div className="flex flex-col gap-0.5 text-xs text-muted">
                    <p>
                      <span className="text-foreground font-medium">{result.imported}</span>{" "}
                      responses imported and analyzed
                    </p>
                    {result.skipped > 0 && (
                      <p>
                        <span className="text-foreground">{result.skipped}</span>{" "}
                        skipped (already imported or missing data)
                      </p>
                    )}
                    {result.failed > 0 && (
                      <p>
                        <span className="text-negative">{result.failed}</span>{" "}
                        failed to import
                      </p>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={importing || !connected}
                className="neu-button-primary text-sm"
              >
                {importing ? "Importing... this may take a few minutes" : "Start Import"}
              </button>

              {importing && (
                <p className="text-xs text-muted text-center">
                  Each response is analyzed by AI as it&apos;s imported.
                  Please keep this page open.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
