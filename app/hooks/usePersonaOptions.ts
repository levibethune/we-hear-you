"use client";

import { useState, useEffect } from "react";
import type { Tenant } from "../lib/types";

export function usePersonaOptions(tenant: Tenant | null) {
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    if (!tenant) return;
    fetch(`/api/dashboard/taxonomies?tenant_id=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => {
        const buckets = data.buckets ?? [];
        setOptions(buckets.map((b: { name: string }) => ({ label: b.name, value: b.name })));
      })
      .catch(() => {});
  }, [tenant]);

  return options;
}
