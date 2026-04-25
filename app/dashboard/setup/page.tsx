"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "../../components/AuthProvider";
import { SetupWizard } from "../../components/SetupWizard";
import { LoadingIndicator } from "../../components/LoadingIndicator";

export default function SetupPage() {
  const { tenant, campaigns } = useAuthContext();
  const router = useRouter();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [formNames, setFormNames] = useState<string[]>([]);

  useEffect(() => {
    if (!tenant) return;

    // Check if org needs setup: has no campaigns with responses
    fetch(`/api/dashboard/stats?tenant_id=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.totalResponses === 0 && campaigns.length <= 1) {
          setNeedsSetup(true);
          // Fetch form names if any exist
          fetch(`/api/dashboard/responses?tenant_id=${tenant.id}&per_page=100`)
            .then((r) => r.json())
            .then((d) => {
              const names = new Set<string>();
              for (const r of d.responses ?? []) {
                if (r.source_form_name) names.add(r.source_form_name);
              }
              setFormNames(Array.from(names));
            })
            .catch(() => {});
        } else {
          // Already set up — redirect to dashboard
          setNeedsSetup(false);
          router.replace("/dashboard");
        }
      })
      .catch(() => setNeedsSetup(false));
  }, [tenant, campaigns]);

  if (needsSetup === null) return <LoadingIndicator />;
  if (!needsSetup) return null;

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12">
      <SetupWizard
        mode="org"
        existingFormNames={formNames}
        onComplete={() => router.push("/dashboard")}
      />
    </div>
  );
}
