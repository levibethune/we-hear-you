"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthContext } from "../../../components/AuthProvider";
import { PersonaEditor } from "../../../components/PersonaEditor";
import type { PersonaBucket } from "../../../lib/types";
import { LoadingIndicator } from "../../../components/LoadingIndicator";
import { OrgBanner } from "../../../components/OrgBanner";
import { CampaignPicker } from "../../../components/CampaignPicker";
import { track } from "../../../lib/analytics";

interface SuggestedPersona {
  name: string;
  description: string;
  criteria: string;
  confidence: "strong" | "moderate" | "emerging";
  example_quotes?: string[];
}

interface SuggestionResult {
  personas: SuggestedPersona[];
  gaps?: string[];
  summary: string;
}

export default function PersonasPage() {
  const { tenant, activeCampaign } = useAuthContext();
  const [personas, setPersonas] = useState<PersonaBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [reanalyzeResult, setReanalyzeResult] = useState<string | null>(null);

  // Suggestion state
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionResult | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant) return;
    fetch(`/api/dashboard/taxonomies?tenant_id=${tenant.id}${activeCampaign ? `&campaign_id=${activeCampaign.id}` : ""}`)
      .then((r) => r.json())
      .then((data) => {
        setPersonas(data.buckets ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tenant]);

  async function handleSave() {
    if (!tenant) return;
    setSaving(true);
    setSaved(false);
    await fetch("/api/dashboard/taxonomies", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenant_id: tenant.id, ...(activeCampaign ? { campaign_id: activeCampaign.id } : {}), buckets: personas }),
    });
    setSaving(false);
    setSaved(true);
    track("personas_saved", { count: personas.length, names: personas.map(p => p.name) });
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleReanalyze() {
    if (!tenant) return;
    setReanalyzing(true);
    setReanalyzeResult(null);

    // Get all response IDs for this tenant
    const respRes = await fetch(`/api/dashboard/responses?tenant_id=${tenant.id}${activeCampaign ? `&campaign_id=${activeCampaign.id}` : ""}&per_page=100`);
    const respData = await respRes.json();
    const responseIds = (respData.responses ?? []).map((r: { id: string }) => r.id);

    if (responseIds.length === 0) {
      setReanalyzing(false);
      setReanalyzeResult("No responses to re-analyze.");
      return;
    }

    // Create a background job
    const res = await fetch("/api/dashboard/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenant.id, ...(activeCampaign ? { campaign_id: activeCampaign.id } : {}),
        type: "reanalyze",
        params: { response_ids: responseIds },
      }),
    });
    const data = await res.json();
    setReanalyzing(false);

    if (data.error) {
      setReanalyzeResult(data.error);
    } else {
      setReanalyzeResult(`Re-analysis started for ${responseIds.length} responses. Progress will appear in the bottom-right corner.`);
    }
  }

  async function handleSuggest() {
    if (!tenant) return;
    setSuggesting(true);
    setSuggestions(null);
    setSuggestError(null);

    const res = await fetch("/api/dashboard/taxonomies/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: tenant.id, ...(activeCampaign ? { campaign_id: activeCampaign.id } : {}),
        existing_personas: personas.length > 0 ? personas : undefined,
      }),
    });

    const data = await res.json();
    setSuggesting(false);

    if (data.error) {
      setSuggestError(data.error);
    } else {
      setSuggestions(data);
    }
  }

  function acceptSuggestion(suggestion: SuggestedPersona) {
    // Check if a persona with this name already exists
    const exists = personas.some(
      (p) => p.name.toLowerCase() === suggestion.name.toLowerCase()
    );
    if (exists) {
      // Update existing
      setPersonas(
        personas.map((p) =>
          p.name.toLowerCase() === suggestion.name.toLowerCase()
            ? { name: suggestion.name, description: suggestion.description, criteria: suggestion.criteria }
            : p
        )
      );
    } else {
      // Add new
      setPersonas([
        ...personas,
        { name: suggestion.name, description: suggestion.description, criteria: suggestion.criteria },
      ]);
    }
  }

  function acceptAll() {
    if (!suggestions) return;
    const merged = [...personas];
    for (const s of suggestions.personas) {
      const existingIdx = merged.findIndex(
        (p) => p.name.toLowerCase() === s.name.toLowerCase()
      );
      if (existingIdx >= 0) {
        merged[existingIdx] = { name: s.name, description: s.description, criteria: s.criteria };
      } else {
        merged.push({ name: s.name, description: s.description, criteria: s.criteria });
      }
    }
    setPersonas(merged);
    setSuggestions(null);
  }

  const starterTemplates: Record<string, { label: string; description: string; personas: PersonaBucket[] }> = {
    buyer: {
      label: "Buyer Personas",
      description: "For understanding purchase decisions, objections, and motivations",
      personas: [
        { name: "Ready Buyer", description: "Actively looking for a solution and prepared to commit", criteria: "Mentions specific needs, asks about pricing or timelines, compares options, expresses urgency" },
        { name: "Researcher", description: "Gathering information but not ready to decide yet", criteria: "Asks many questions, wants to understand features in detail, mentions exploring alternatives, non-committal language" },
        { name: "Skeptic", description: "Interested but has reservations or trust concerns", criteria: "Raises objections, questions value for money, mentions past bad experiences, wants proof or guarantees" },
        { name: "Advocate", description: "Already a fan and likely to refer others", criteria: "Enthusiastic language, mentions recommending to others, shares positive experiences, uses superlatives" },
        { name: "Price-Sensitive", description: "Interested primarily driven by cost considerations", criteria: "Frequently mentions budget, compares prices, asks about discounts or free tiers, weighs cost vs. value" },
      ],
    },
    user: {
      label: "User Personas",
      description: "For understanding product usage, satisfaction, and pain points",
      personas: [
        { name: "Power User", description: "Deeply engaged, uses advanced features, and pushes boundaries", criteria: "Mentions specific features by name, describes complex workflows, suggests improvements, high product knowledge" },
        { name: "Casual User", description: "Uses the basics and is generally satisfied without going deep", criteria: "Simple use cases, doesn't mention advanced features, generally positive but not detailed, low frequency language" },
        { name: "Frustrated User", description: "Experiencing friction or unmet expectations", criteria: "Describes specific problems, expresses disappointment, mentions workarounds, negative sentiment, 'I wish' language" },
        { name: "New User", description: "Recently started and still finding their way", criteria: "Confusion about features, asks basic questions, mentions onboarding, references first impressions, learning curve" },
        { name: "At-Risk User", description: "Showing signs of disengagement or considering alternatives", criteria: "Mentions competitors, declining usage, unresolved issues, passive language, 'thinking about switching'" },
      ],
    },
    brand: {
      label: "Brand Archetypes",
      description: "For understanding how people relate to your brand emotionally",
      personas: [
        { name: "Champion", description: "Emotionally invested in the brand and its mission", criteria: "Identifies with brand values, shares brand content, emotional language, mentions community, 'I believe in what you're doing'" },
        { name: "Pragmatist", description: "Values the brand for practical utility, not emotional connection", criteria: "Focuses on features and function, matter-of-fact tone, compares objectively, 'it gets the job done'" },
        { name: "Storyteller", description: "Connects through narrative and personal experience", criteria: "Shares personal stories, relates brand to life events, uses vivid descriptions, testimonial-style responses" },
        { name: "Critic", description: "Engaged but holds the brand to high standards", criteria: "Detailed feedback, constructive criticism, high expectations, 'you could do better', cares enough to push back" },
        { name: "Observer", description: "Aware of the brand but emotionally neutral", criteria: "Short responses, surface-level engagement, neutral sentiment, factual without emotion, passive voice" },
      ],
    },
  };

  function applyStarter(key: string) {
    const template = starterTemplates[key];
    if (!template) return;
    setPersonas(template.personas);
  }

  const confidenceColors = {
    strong: "bg-seafoam/10 text-seafoam",
    moderate: "bg-sunshine/10 text-sunshine",
    emerging: "bg-peach/10 text-peach",
  };

  if (loading) {
    return (
      <LoadingIndicator />
    );
  }

  if (!activeCampaign) {
    return (
      <div className="max-w-2xl">
        <OrgBanner />
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-lg font-bold">Personas</h2>
          <CampaignPicker />
        </div>
        <div className="soft-card p-6 text-center mt-4">
          <p className="text-sm text-muted mb-2">Personas are configured per campaign.</p>
          <p className="text-sm text-muted">Select a campaign to configure its personas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <OrgBanner />
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-lg font-bold">Personas</h2>
        <CampaignPicker />
      </div>
      <p className="text-sm text-muted mb-6">
        Personas are the categories you want to sort people into based on what they
        say. For example, you might create &ldquo;Champion,&rdquo; &ldquo;Skeptic,&rdquo;
        and &ldquo;New User.&rdquo; Give each persona a name, a short description, and
        the criteria the AI should use to decide who fits. When you save, every future
        response will automatically be classified.
      </p>

      {/* Starter Templates */}
      {personas.length === 0 ? (
        <div className="soft-card p-5 mb-6">
          <h4 className="text-sm font-medium mb-1">Start with a template</h4>
          <p className="text-xs text-muted mb-4">
            Choose a starting point based on what kind of insights you&apos;re
            collecting. You can always customize these later.
          </p>
          <div className="flex flex-col gap-2">
            {Object.entries(starterTemplates).map(([key, t]) => (
              <button
                key={key}
                onClick={() => applyStarter(key)}
                className="soft-card p-3 text-left hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium group-hover:text-accent transition-colors">{t.label}</p>
                    <p className="text-xs text-muted mt-0.5">{t.description}</p>
                    <p className="text-xs text-muted mt-1">
                      {t.personas.map(p => p.name).join(" · ")}
                    </p>
                  </div>
                  <span className="text-xs text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-3">
                    Use this &rarr;
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <details className="mb-6">
          <summary className="text-xs text-accent cursor-pointer hover:underline">
            Replace with a starter template
          </summary>
          <div className="soft-card p-4 mt-2">
            <p className="text-xs text-muted mb-3">
              This will replace your current personas with a fresh template.
              Make sure to save afterward.
            </p>
            <div className="flex flex-col gap-2">
              {Object.entries(starterTemplates).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => applyStarter(key)}
                  className="soft-card p-3 text-left hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all"
                >
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-muted mt-0.5">{t.description}</p>
                </button>
              ))}
            </div>
          </div>
        </details>
      )}

      {/* AI Suggestions */}
      <div className="soft-card p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <h4 className="text-sm font-medium">AI-Suggested Personas</h4>
            <p className="text-xs text-muted mt-1">
              {personas.length > 0
                ? "Analyze your responses to see if your current personas still fit, or if new patterns have emerged."
                : "Don\u2019t know where to start? Let the AI analyze your responses and suggest personas based on what people are actually saying."}
            </p>
          </div>
          <button
            onClick={handleSuggest}
            disabled={suggesting}
            className="bg-accent text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-accent-hover transition-all shadow-[0_2px_8px_rgba(244,160,122,0.25)] shrink-0 disabled:opacity-50"
          >
            {suggesting ? "Analyzing..." : personas.length > 0 ? "Check for Gaps" : "Suggest Personas"}
          </button>
        </div>

        {suggesting && (
          <div className="flex items-center gap-2 mt-3">
            <div className="h-2 w-2 rounded-full bg-accent/40 animate-bounce" />
            <p className="text-xs text-muted">
              Reading through your responses and identifying patterns...
            </p>
          </div>
        )}

        {suggestError && (
          <div className="soft-card p-3 border-l-[3px] border-l-negative mt-3">
            <p className="text-sm text-negative">{suggestError}</p>
          </div>
        )}

        {suggestions && (
          <div className="mt-4">
            {/* Summary */}
            <div className="soft-card p-3 mb-4">
              <p className="text-sm text-muted">{suggestions.summary}</p>
            </div>

            {/* Suggested personas */}
            <div className="flex items-center justify-between mb-3">
              <h5 className="text-xs font-medium text-muted uppercase tracking-wide">
                Suggested Personas ({suggestions.personas.length})
              </h5>
              <button
                onClick={acceptAll}
                className="text-xs text-accent hover:underline"
              >
                Accept all
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {suggestions.personas.map((s, i) => {
                const alreadyAdded = personas.some(
                  (p) => p.name.toLowerCase() === s.name.toLowerCase()
                );
                return (
                  <div key={i} className="soft-card p-3">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{s.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${confidenceColors[s.confidence]}`}>
                          {s.confidence}
                        </span>
                      </div>
                      <button
                        onClick={() => acceptSuggestion(s)}
                        className={`text-xs shrink-0 ${
                          alreadyAdded
                            ? "text-seafoam"
                            : "text-accent hover:underline"
                        }`}
                      >
                        {alreadyAdded ? "Added" : "Accept"}
                      </button>
                    </div>
                    <p className="text-xs text-muted">{s.description}</p>
                    <p className="text-xs text-muted mt-1">
                      <span className="text-foreground">Criteria:</span>{" "}{s.criteria}
                    </p>
                    {s.example_quotes && s.example_quotes.length > 0 && (
                      <div className="mt-2 flex flex-col gap-1">
                        {s.example_quotes.map((q, qi) => (
                          <p key={qi} className="text-xs text-muted italic pl-3 border-l-2 border-card-border">
                            &ldquo;{q}&rdquo;
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Gaps */}
            {suggestions.gaps && suggestions.gaps.length > 0 && (
              <div className="mt-4">
                <h5 className="text-xs font-medium text-muted uppercase tracking-wide mb-2">
                  Patterns to Watch
                </h5>
                <div className="soft-card p-3">
                  <p className="text-xs text-muted mb-2">
                    These patterns showed up in some responses but don&apos;t clearly
                    fit any persona yet. As more responses come in, they may become
                    their own category.
                  </p>
                  <ul className="flex flex-col gap-1">
                    {suggestions.gaps.map((gap, i) => (
                      <li key={i} className="text-xs text-muted pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[7px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-sunshine/40">
                        {gap}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <button
              onClick={() => setSuggestions(null)}
              className="text-xs text-muted hover:text-foreground mt-3 transition-colors"
            >
              Dismiss suggestions
            </button>
          </div>
        )}
      </div>

      {/* Manual editor */}
      <PersonaEditor personas={personas} onChange={setPersonas} />

      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-accent text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-accent-hover transition-all shadow-[0_2px_8px_rgba(244,160,122,0.25)] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Personas"}
        </button>
        {saved && <span className="text-sm text-seafoam">Saved</span>}
      </div>

      <div className="mt-8 pt-6 border-t border-card-border">
        <h4 className="text-sm font-medium mb-2">Re-analyze Existing Responses</h4>
        <p className="text-sm text-muted mb-3">
          Run all existing responses through the updated analysis configuration.
          This will update sentiment, themes, and persona classifications.
        </p>
        <button
          onClick={handleReanalyze}
          disabled={reanalyzing}
          className="text-sm text-accent hover:underline disabled:opacity-50"
        >
          {reanalyzing ? "Re-analyzing..." : "Re-analyze all responses"}
        </button>
        {reanalyzeResult && (
          <div className="mt-2 flex items-center gap-3">
            <p className="text-sm text-seafoam">{reanalyzeResult}</p>
            <Link href="/dashboard/responses" className="text-xs text-accent hover:underline">
              View responses &rarr;
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
