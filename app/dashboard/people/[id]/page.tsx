"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "../../../components/AuthProvider";
import { SentimentBadge } from "../../../components/SentimentBadge";
import { PersonaTag } from "../../../components/PersonaTag";
import { ResponseCard } from "../../../components/ResponseCard";
import { EmptyState } from "../../../components/EmptyState";
import type { Person, Response } from "../../../lib/types";
import { LoadingIndicator } from "../../../components/LoadingIndicator";

export default function PersonDetailPage() {
  const { tenant } = useAuthContext();
  const { id } = useParams<{ id: string }>();
  const [person, setPerson] = useState<Person | null>(null);
  const [responses, setResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!tenant || !id) return;
    fetch(`/api/dashboard/people/${id}?tenant_id=${tenant.id}`)
      .then((r) => r.json())
      .then((data) => {
        setPerson(data.person ?? null);
        setResponses(data.responses ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tenant, id, refreshKey]);

  if (loading) {
    return (
      <LoadingIndicator />
    );
  }

  if (!person) return <EmptyState message="Person not found." />;

  return (
    <div>
      <Link
        href="/dashboard/people"
        className="text-sm text-muted hover:text-foreground transition-colors"
      >
        &larr; Back to People
      </Link>

      <div className="mt-4 mb-6">
        <h2 className="text-lg font-bold">{person.name ?? person.email}</h2>
        {person.name && (
          <p className="text-sm text-muted">{person.email}</p>
        )}
        <div className="flex items-center gap-3 mt-2">
          <PersonaTag persona={person.persona} />
          <SentimentBadge sentiment={person.latest_sentiment} />
          {person.latest_mood && (
            <span className="text-sm text-muted">{person.latest_mood}</span>
          )}
          <span className="text-sm text-muted">
            {person.response_count} response{person.response_count !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <h3 className="text-sm font-medium text-muted mb-3">Response Timeline</h3>
      {responses.length === 0 ? (
        <EmptyState message="No responses yet." />
      ) : (
        <div className="flex flex-col gap-3">
          {responses.map((r) => (
            <ResponseCard key={r.id} response={r} onUpdate={() => setRefreshKey((k) => k + 1)} />
          ))}
        </div>
      )}
    </div>
  );
}
