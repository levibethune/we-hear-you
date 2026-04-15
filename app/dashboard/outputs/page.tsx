"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthContext } from "../../components/AuthProvider";
import { FlowCard } from "../../components/FlowCard";
import { NotificationCard } from "../../components/NotificationCard";
import { VideoFeedCard } from "../../components/VideoFeedCard";
import { EmptyState } from "../../components/EmptyState";
import { LoadingIndicator } from "../../components/LoadingIndicator";
import type { Flow, VideoFeed } from "../../lib/types";

export default function OutputsPage() {
  const { tenant, activeCampaign } = useAuthContext();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [feeds, setFeeds] = useState<VideoFeed[]>([]);
  const [loading, setLoading] = useState(true);

  function fetchAll() {
    if (!tenant) return;
    const cp = activeCampaign ? `&campaign_id=${activeCampaign.id}` : "";
    Promise.all([
      fetch(`/api/dashboard/flows?tenant_id=${tenant.id}${cp}`).then((r) => r.json()),
      fetch(`/api/dashboard/video-feeds?tenant_id=${tenant.id}${cp}`).then((r) => r.json()),
    ]).then(([flowsData, feedsData]) => {
      setFlows(Array.isArray(flowsData) ? flowsData : []);
      setFeeds(Array.isArray(feedsData) ? feedsData : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(() => { fetchAll(); }, [tenant]);

  async function handleFlowToggle(flowId: string, active: boolean) {
    if (!tenant) return;
    await fetch("/api/dashboard/flows", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flow_id: flowId, tenant_id: tenant.id, is_active: active }),
    });
    setFlows((prev) => prev.map((f) => f.id === flowId ? { ...f, is_active: active } : f));
  }

  async function handleFlowDelete(flowId: string) {
    if (!tenant) return;
    await fetch("/api/dashboard/flows", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flow_id: flowId, tenant_id: tenant.id }),
    });
    setFlows((prev) => prev.filter((f) => f.id !== flowId));
  }

  async function handleFeedToggle(feedId: string, active: boolean) {
    if (!tenant) return;
    await fetch("/api/dashboard/video-feeds", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feed_id: feedId, tenant_id: tenant.id, is_active: active }),
    });
    setFeeds((prev) => prev.map((f) => f.id === feedId ? { ...f, is_active: active } : f));
  }

  async function handleFeedDelete(feedId: string) {
    if (!tenant) return;
    await fetch("/api/dashboard/video-feeds", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feed_id: feedId, tenant_id: tenant.id }),
    });
    setFeeds((prev) => prev.filter((f) => f.id !== feedId));
  }

  if (loading) return <LoadingIndicator />;

  const notifications = flows.filter((f) => f.category === "notification");
  const customFlows = flows.filter((f) => f.category !== "notification");

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-lg font-bold">Outputs</h2>
        <p className="text-sm text-muted mt-0.5">
          Turn your insights into action. Send notifications, publish video feeds,
          or wire up custom integrations.
        </p>
      </div>

      {/* Notifications section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Notifications</h3>
          <Link
            href="/dashboard/outputs/notifications/create"
            className="text-xs text-accent hover:underline"
          >
            + Add Notification
          </Link>
        </div>
        {notifications.length === 0 ? (
          <div className="soft-card p-5 text-center">
            <p className="text-sm text-muted mb-2">
              Get pinged when responses match your criteria — via Slack, in-app, or weekly email digest.
            </p>
            <Link
              href="/dashboard/outputs/notifications/create"
              className="text-xs text-accent hover:underline"
            >
              Create your first notification
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notifications.map((flow) => (
              <NotificationCard key={flow.id} flow={flow} onToggle={handleFlowToggle} onDelete={handleFlowDelete} />
            ))}
          </div>
        )}
      </section>

      {/* Video Feeds section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Video Feeds</h3>
          <Link
            href="/dashboard/outputs/feeds/create"
            className="text-xs text-accent hover:underline"
          >
            + Add Video Feed
          </Link>
        </div>
        {feeds.length === 0 ? (
          <div className="soft-card p-5 text-center">
            <p className="text-sm text-muted mb-2">
              Publish a curated video feed to your website, blog, or anywhere with an iframe.
              Auto-filtered for safety and on-topic content.
            </p>
            <Link
              href="/dashboard/outputs/feeds/create"
              className="text-xs text-accent hover:underline"
            >
              Create your first video feed
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {feeds.map((feed) => (
              <VideoFeedCard key={feed.id} feed={feed} onToggle={handleFeedToggle} onDelete={handleFeedDelete} />
            ))}
          </div>
        )}
      </section>

      {/* Custom Flows section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Custom Flows</h3>
          <Link
            href="/dashboard/flows/create"
            className="text-xs text-accent hover:underline"
          >
            + Create Flow
          </Link>
        </div>
        {customFlows.length === 0 ? (
          <EmptyState message="No custom flows yet. Build your own webhook integration to anywhere." />
        ) : (
          <div className="flex flex-col gap-2">
            {customFlows.map((flow) => (
              <FlowCard key={flow.id} flow={flow} onToggle={handleFlowToggle} onDelete={handleFlowDelete} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
