"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FlowsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/outputs");
  }, [router]);
  return null;
}
