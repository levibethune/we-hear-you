"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthContext } from "../../../../../components/AuthProvider";
import { VideoFeedForm } from "../../../../../components/VideoFeedForm";
import { LoadingIndicator } from "../../../../../components/LoadingIndicator";
import type { VideoFeed } from "../../../../../lib/types";

export default function EditFeedPage() {
  const { tenant } = useAuthContext();
  const { id } = useParams();
  const [feed, setFeed] = useState<VideoFeed | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant || !id) return;
    fetch(`/api/dashboard/video-feeds?tenant_id=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => {
        const found = (data as VideoFeed[]).find((f) => f.id === id);
        setFeed(found || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tenant, id]);

  if (loading) return <LoadingIndicator />;
  if (!feed) return <p className="text-sm text-muted">Feed not found.</p>;

  return <VideoFeedForm existingFeed={feed} />;
}
