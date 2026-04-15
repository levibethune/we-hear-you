"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthContext } from "../../components/AuthProvider";
import { SentimentBadge } from "../../components/SentimentBadge";
import { LoadingIndicator } from "../../components/LoadingIndicator";
import { CampaignPicker } from "../../components/CampaignPicker";
import { EmptyState } from "../../components/EmptyState";
import type { Person, PersonaBucket } from "../../lib/types";

export default function PersonasPage() {
  const { tenant, activeCampaign } = useAuthContext();
  const [personas, setPersonas] = useState<PersonaBucket[]>([]);
  const [peopleByPersona, setPeopleByPersona] = useState<Record<string, Person[]>>({});
  const [unclassified, setUnclassified] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    const cp = activeCampaign ? `&campaign_id=${activeCampaign.id}` : "";

    Promise.all([
      fetch(`/api/dashboard/taxonomies?tenant_id=${tenant.id}${cp}`).then((r) => r.json()),
      fetch(`/api/dashboard/people?tenant_id=${tenant.id}${cp}&per_page=100`).then((r) => r.json()),
    ]).then(([taxonomyData, peopleData]) => {
      const buckets: PersonaBucket[] = taxonomyData.buckets ?? [];
      setPersonas(buckets);

      const people: Person[] = peopleData.people ?? [];
      const grouped: Record<string, Person[]> = {};
      const noPersona: Person[] = [];

      for (const p of people) {
        if (p.persona && buckets.some((b) => b.name === p.persona)) {
          if (!grouped[p.persona]) grouped[p.persona] = [];
          grouped[p.persona].push(p);
        } else {
          noPersona.push(p);
        }
      }

      setPeopleByPersona(grouped);
      setUnclassified(noPersona);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [tenant]);

  if (loading) return <LoadingIndicator />;

  if (personas.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-bold mb-1">Personas</h2>
        <EmptyState
          message="No personas defined yet."
          action={
            <Link href="/dashboard/settings/personas" className="text-sm text-accent hover:underline">
              Set up personas &rarr;
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-lg font-bold">Personas</h2>
        <CampaignPicker />
      </div>
      <p className="text-sm text-muted mb-6">
        Your audience organized by persona. Each section shows the people who
        best match that persona based on their responses.
      </p>

      <div className="flex flex-col gap-8">
        {personas.map((persona) => {
          const people = peopleByPersona[persona.name] ?? [];
          return (
            <div key={persona.name}>
              <div className="mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-base font-bold">{persona.name}</h3>
                  <span className="text-xs text-muted">{people.length} {people.length === 1 ? "person" : "people"}</span>
                </div>
                <p className="text-sm text-muted mt-0.5">{persona.description}</p>
              </div>

              {people.length === 0 ? (
                <p className="text-xs text-muted py-3">No one classified here yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {people.map((p) => (
                    <Link
                      key={p.id}
                      href={`/dashboard/people/${p.id}`}
                      className="soft-card p-4 hover:shadow-lg transition-all"
                    >
                      <p className="text-sm font-medium">{p.name ?? p.email}</p>
                      {p.name && <p className="text-xs text-muted">{p.email}</p>}
                      <div className="flex items-center gap-2 mt-2">
                        {p.latest_mood && (
                          <span className="text-xs text-muted">{p.latest_mood}</span>
                        )}
                        <SentimentBadge sentiment={p.latest_sentiment} />
                      </div>
                      <p className="text-xs text-muted mt-1">
                        {p.response_count} response{p.response_count !== 1 ? "s" : ""}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {unclassified.length > 0 && (
          <div>
            <div className="mb-3">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-muted">Unclassified</h3>
                <span className="text-xs text-muted">{unclassified.length} {unclassified.length === 1 ? "person" : "people"}</span>
              </div>
              <p className="text-sm text-muted mt-0.5">
                These people haven&apos;t been classified into a persona yet. Re-analyze
                their responses to assign them.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {unclassified.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/people/${p.id}`}
                  className="soft-card p-4 hover:shadow-lg transition-all opacity-60"
                >
                  <p className="text-sm font-medium">{p.name ?? p.email}</p>
                  {p.name && <p className="text-xs text-muted">{p.email}</p>}
                  <p className="text-xs text-muted mt-1">
                    {p.response_count} response{p.response_count !== 1 ? "s" : ""}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
