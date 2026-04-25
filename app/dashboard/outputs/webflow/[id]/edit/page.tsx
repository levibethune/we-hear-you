"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthContext } from "../../../../../components/AuthProvider";
import { WebflowForm } from "../../../../../components/WebflowForm";
import { LoadingIndicator } from "../../../../../components/LoadingIndicator";
import type { Flow } from "../../../../../lib/types";

export default function EditWebflowPage() {
  const { tenant } = useAuthContext();
  const { id } = useParams();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant || !id) return;
    fetch(`/api/dashboard/flows?tenant_id=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => {
        const found = (data as Flow[]).find((f) => f.id === id);
        setFlow(found || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tenant, id]);

  if (loading) return <LoadingIndicator />;
  if (!flow) return <p className="text-sm text-muted">Webflow output not found.</p>;

  return <WebflowForm existingFlow={flow} />;
}
