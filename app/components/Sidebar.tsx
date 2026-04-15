"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthContext } from "./AuthProvider";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";
import { InAppNotificationBell } from "./InAppNotificationBell";

const dataItems = [
  { href: "/dashboard", label: "Dashboard", countKey: null },
  { href: "/dashboard/people", label: "People", countKey: "people" as const },
  { href: "/dashboard/responses", label: "Responses", countKey: "responses" as const },
  { href: "/dashboard/personas", label: "Personas", countKey: "personas" as const },
  { href: "/dashboard/outputs", label: "Outputs", countKey: "flows" as const },
];

const settingsItems = [
  { href: "/dashboard/settings/campaigns", label: "Campaigns" },
  { href: "/dashboard/settings/personas", label: "Persona Config" },
  { href: "/dashboard/settings/analysis", label: "Analysis Config" },
  { href: "/dashboard/settings/connections", label: "Connections" },
  { href: "/dashboard/settings/import", label: "Import" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { tenant, tenants, isSuperAdmin, switchTenant, signOut, user, campaigns, activeCampaign, switchCampaign } =
    useAuthContext();
  const [counts, setCounts] = useState<{ people: number; responses: number; personas: number; flows: number }>({ people: 0, responses: 0, personas: 0, flows: 0 });

  useEffect(() => {
    if (!tenant) return;
    const cp = activeCampaign ? `&campaign_id=${activeCampaign.id}` : "";
    Promise.all([
      fetch(`/api/dashboard/stats?tenant_id=${tenant.id}${cp}`).then((r) => r.json()),
      fetch(`/api/dashboard/taxonomies?tenant_id=${tenant.id}${cp}`).then((r) => r.json()),
      fetch(`/api/dashboard/flows?tenant_id=${tenant.id}${cp}`).then((r) => r.json()),
      fetch(`/api/dashboard/video-feeds?tenant_id=${tenant.id}${cp}`).then((r) => r.json()),
    ]).then(([statsData, taxonomyData, flowsData, feedsData]) => {
      const buckets = taxonomyData.buckets ?? [];
      const flowsCount = Array.isArray(flowsData) ? flowsData.length : 0;
      const feedsCount = Array.isArray(feedsData) ? feedsData.length : 0;
      setCounts({
        people: statsData.totalPeople ?? 0,
        responses: statsData.totalResponses ?? 0,
        personas: buckets.length,
        flows: flowsCount + feedsCount,
      });
    }).catch(() => {});
  }, [tenant, activeCampaign]);

  function isActive(href: string) {
    return href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);
  }

  const linkClass = (href: string) =>
    `px-4 py-2.5 rounded-xl text-sm transition-all ${
      isActive(href)
        ? "neu-raised text-accent font-medium"
        : "text-muted hover:text-foreground hover:neu-raised"
    }`;

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <aside className="w-60 shrink-0 bg-sidebar-bg h-screen sticky top-0 flex flex-col">
      <div className="px-7 py-5">
        <Logo size="sm" linked={false} />
      </div>

      {tenants.length > 1 ? (
        <div className="px-3 pb-2">
          <select
            value={tenant?.id ?? ""}
            onChange={(e) => { switchTenant(e.target.value); window.location.href = "/dashboard"; }}
            className="w-full text-sm px-4 py-2.5 rounded-xl font-medium"
            style={{ minHeight: "unset", height: "auto" }}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      ) : tenant ? (
        <p className="px-5 pb-3 text-xs text-muted truncate">{tenant.name}</p>
      ) : null}

      {/* Campaign picker */}
      {campaigns.length >= 1 && (
        <div className="px-3 pb-2">
          <select
            value={activeCampaign?.id ?? ""}
            onChange={(e) => switchCampaign(e.target.value || null)}
            className="w-full text-xs px-3 py-2 rounded-lg"
            style={{ minHeight: "unset", height: "auto" }}
          >
            <option value="">All Campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <nav className="flex-1 px-3 py-1 flex flex-col gap-1 overflow-y-auto">
        {dataItems.map(({ href, label, countKey }) => (
          <Link key={href} href={href} className={`${linkClass(href)} flex items-center justify-between`}>
            <span>{label}</span>
            {countKey && counts[countKey] > 0 && (
              <span className={`text-xs font-normal ${isActive(href) ? "text-accent/70" : "text-muted/40"}`}>
                {counts[countKey]}
              </span>
            )}
          </Link>
        ))}

        {/* Divider */}
        <div className="my-3 mx-2 h-px bg-muted/15" />
        <p className="px-4 mb-1 text-[10px] text-muted/50 uppercase tracking-widest">
          Settings
        </p>

        {settingsItems.map(({ href, label }) => (
          <Link key={href} href={href} className={linkClass(href)}>
            {label}
          </Link>
        ))}

        {isSuperAdmin && (
          <>
            <div className="my-3 mx-2 h-px bg-muted/15" />
            <Link href="/dashboard/admin" className={linkClass("/dashboard/admin")}>
              Admin
            </Link>
          </>
        )}
      </nav>

      <div className="px-3 pb-2 flex flex-col gap-1">
        <ThemeToggle />
        <div className="flex items-center gap-3 px-3 py-1.5">
          <Link href="/privacy" className="text-[11px] text-muted hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="text-[11px] text-muted hover:text-foreground transition-colors">
            Terms
          </Link>
          <Link href="/releases" className="text-[11px] text-muted hover:text-foreground transition-colors">
            Releases
          </Link>
          <Link href="/support" className="text-[11px] text-muted hover:text-foreground transition-colors">
            Support
          </Link>
        </div>
        <p className="px-3 py-1 text-[10px] text-muted/50">
          Powered by Claude
        </p>
      </div>

      <div className="px-4 py-3.5 border-t border-muted/10 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted truncate mb-1.5">{user?.email}</p>
          <button
            onClick={handleSignOut}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </div>
        <InAppNotificationBell />
      </div>
    </aside>
  );
}
