"use client";

import { useEffect, useState } from "react";
import { useAuthContext } from "../../../components/AuthProvider";
import { EmptyState } from "../../../components/EmptyState";
import type { Source } from "../../../lib/types";
import { LoadingIndicator } from "../../../components/LoadingIndicator";

export default function SourcesPage() {
  const { tenant } = useAuthContext();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    fetch(`/api/dashboard/sources?tenant_id=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => {
        setSources(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tenant]);

  if (loading) {
    return (
      <LoadingIndicator />
    );
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-bold mb-1">Sources</h2>
      <p className="text-sm text-muted mb-6">
        A source is any tool that collects responses from people and sends them
        to We Hear You for analysis. This could be a video feedback tool like
        VideoAsk, a survey tool like Typeform, or even a custom form on your
        website. Each source sends data to a specific URL (called a webhook),
        and we take care of the rest.
      </p>

      {/* VideoAsk step-by-step */}
      <div className="soft-card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">Connect VideoAsk</h4>
          <span className="text-xs text-seafoam bg-seafoam/10 px-2 py-0.5 rounded-full">Step-by-step</span>
        </div>
        <p className="text-xs text-muted mb-4">
          Follow these steps to connect a VideoAsk form so that every new video
          response is automatically analyzed and added to your dashboard.
        </p>

        <ol className="text-sm text-muted flex flex-col gap-4 list-none">
          <li className="soft-card p-3">
            <p className="font-medium text-foreground mb-1">Step 1: Get your API key</p>
            <p className="text-xs">
              Go to the{" "}
              <a href="/dashboard/settings/api-keys" className="text-accent hover:underline">API Keys</a>{" "}
              page and generate a new key. Give it a name like &ldquo;VideoAsk&rdquo; and
              select the <span className="font-mono bg-seafoam/10 text-seafoam px-1 rounded">ingest</span>{" "}
              scope. Copy the key — you&apos;ll need it in Step 4.
            </p>
          </li>

          <li className="soft-card p-3">
            <p className="font-medium text-foreground mb-1">Step 2: Open VideoAsk webhook settings</p>
            <p className="text-xs">
              In VideoAsk, open the form you want to connect. Go to{" "}
              <strong>Settings &rarr; Notifications &rarr; Webhooks</strong>{" "}
              and click <strong>&ldquo;Add a Webhook&rdquo;</strong>.
            </p>
          </li>

          <li className="soft-card p-3">
            <p className="font-medium text-foreground mb-1">Step 3: Set the webhook URL</p>
            <p className="text-xs mb-2">
              In the URL field at the top, paste this:
            </p>
            <code className="text-xs font-mono bg-background border border-card-border rounded-lg px-3 py-2 block select-all">
              https://app.wehearyou.io/api/ingest/videoask
            </code>
          </li>

          <li className="soft-card p-3">
            <p className="font-medium text-foreground mb-1">Step 4: Turn on the right events</p>
            <p className="text-xs">
              You&apos;ll see a list of event toggles. Turn on these two:
            </p>
            <div className="flex flex-col gap-1 mt-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-seafoam"></span>
                <span className="font-mono">form_response</span>
                <span className="text-muted">— fires when someone submits a response</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-seafoam"></span>
                <span className="font-mono">form_response_transcribed</span>
                <span className="text-muted">— fires when the transcription is ready</span>
              </div>
            </div>
            <p className="text-xs mt-2 text-muted">
              Leave the other events (form_author_message, form_contact_message, etc.) turned off.
            </p>
          </li>

          <li className="soft-card p-3">
            <p className="font-medium text-foreground mb-1">Step 5: Add your API key as the secret</p>
            <p className="text-xs mb-2">
              Scroll down to <strong>&ldquo;Add a secret&rdquo;</strong> and fill in
              these two fields exactly:
            </p>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-muted w-24 shrink-0">Header name:</span>
                <code className="font-mono bg-background border border-card-border rounded px-2 py-1 select-all">Authorization</code>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted w-24 shrink-0">Value:</span>
                <code className="font-mono bg-background border border-card-border rounded px-2 py-1 select-all">Bearer why_your_api_key_here</code>
              </div>
            </div>
            <p className="text-xs text-muted mt-2">
              Replace <span className="font-mono">why_your_api_key_here</span>{" "}
              with the actual key you copied in Step 1. Make sure to include the
              word <span className="font-mono">Bearer</span> followed by a space
              before the key.
            </p>
          </li>

          <li className="soft-card p-3">
            <p className="font-medium text-foreground mb-1">Step 6: Save</p>
            <p className="text-xs">
              Click <strong>&ldquo;Save&rdquo;</strong> in VideoAsk. You&apos;re connected!
              From now on, every new video response will automatically appear in your
              We Hear You dashboard, fully analyzed with themes, sentiment, and
              persona classifications.
            </p>
          </li>
        </ol>
      </div>

      {/* Import historical responses */}
      <div className="soft-card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">Import past responses</h4>
          <span className="text-xs text-sunshine bg-sunshine/10 px-2 py-0.5 rounded-full">VideoAsk</span>
        </div>
        <p className="text-xs text-muted mb-3">
          Already have responses in VideoAsk from before you connected the webhook?
          You can import them all at once. Go to the{" "}
          <a href="/dashboard/settings/import" className="text-accent hover:underline">Import</a>{" "}
          page to pull in your historical data.
        </p>
      </div>

      {/* Custom / Other */}
      <div className="soft-card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">Connect a custom source</h4>
          <span className="text-xs text-sunshine bg-sunshine/10 px-2 py-0.5 rounded-full">Any tool</span>
        </div>
        <p className="text-xs text-muted mb-3">
          If your tool isn&apos;t VideoAsk, you can still connect it. Any service
          that supports webhooks can send data to We Hear You using the custom
          endpoint. Just send a JSON body with an email and transcription.
        </p>
        <code className="text-xs font-mono bg-background border border-card-border rounded-lg px-3 py-2 block select-all mb-3">
          https://app.wehearyou.io/api/ingest/custom
        </code>
        <p className="text-xs text-muted mb-2">
          The JSON body needs at minimum:
        </p>
        <div className="flex flex-col gap-1 text-xs mb-3">
          <div className="flex gap-2">
            <code className="font-mono text-foreground">email</code>
            <span className="text-muted">— the respondent&apos;s email (required)</span>
          </div>
          <div className="flex gap-2">
            <code className="font-mono text-foreground">transcription</code>
            <span className="text-muted">— the text to analyze (required)</span>
          </div>
          <div className="flex gap-2">
            <code className="font-mono text-muted">name</code>
            <span className="text-muted">— the respondent&apos;s name (optional)</span>
          </div>
          <div className="flex gap-2">
            <code className="font-mono text-muted">media_url</code>
            <span className="text-muted">— link to the video or audio file (optional)</span>
          </div>
        </div>
        <p className="text-xs text-muted">
          Include your API key in the <span className="font-mono">Authorization</span>{" "}
          header as <span className="font-mono">Bearer why_your_key</span>.
        </p>

        <details className="mt-4">
          <summary className="text-xs text-accent cursor-pointer hover:underline">
            Show example request
          </summary>
          <pre className="mt-2 bg-background border border-card-border rounded-lg p-3 text-xs font-mono overflow-x-auto">
{`curl -X POST https://app.wehearyou.io/api/ingest/custom \\
  -H "Authorization: Bearer why_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "jane@example.com",
    "name": "Jane Doe",
    "transcription": "I think the onboarding could be smoother...",
    "media_url": "https://example.com/video/feedback-001.mp4"
  }'`}
          </pre>
        </details>
      </div>

      <h3 className="text-sm font-medium text-muted mb-3">Connected Sources</h3>
      {sources.length === 0 ? (
        <EmptyState message="No sources connected yet. Once you send your first webhook, it will appear here." />
      ) : (
        <div className="flex flex-col gap-2">
          {sources.map((s) => (
            <div
              key={s.id}
              className="soft-card px-4 py-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted">{s.type}</p>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  s.is_active
                    ? "bg-positive/15 text-positive"
                    : "bg-neutral/15 text-neutral"
                }`}
              >
                {s.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
