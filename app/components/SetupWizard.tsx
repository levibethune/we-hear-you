"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "./AuthProvider";
import { TemplateSelector } from "./TemplateSelector";
import { SchemaBuilder, fieldsToSchema, schemaToFields } from "./SchemaBuilder";
import { PersonaEditor } from "./PersonaEditor";
import type { SchemaField } from "./SchemaFieldRow";
import type { AnalysisTemplate } from "../../lib/templates";
import type { PersonaBucket } from "../lib/types";

interface WizardProps {
  mode: "org" | "campaign";
  onComplete?: () => void;
  existingFormNames?: string[];
}

export function SetupWizard({ mode, onComplete, existingFormNames = [] }: WizardProps) {
  const { tenant, refreshCampaigns } = useAuthContext();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Campaign basics
  const [campaignName, setCampaignName] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [formNames, setFormNames] = useState<string[]>([]);

  // Step 2: Template
  const [selectedTemplate, setSelectedTemplate] = useState<AnalysisTemplate | null>(null);

  // Step 3: Fields
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("");

  // Step 4: Personas
  const [personas, setPersonas] = useState<PersonaBucket[]>([]);

  function handleTemplateSelect(template: AnalysisTemplate) {
    setSelectedTemplate(template);
    setFields([...template.fields]);
    setSystemPrompt(template.systemPrompt);
    if (template.suggestedPersonas) {
      setPersonas([...template.suggestedPersonas]);
    }
  }

  const steps = mode === "org"
    ? ["Campaign", "Template", "Fields", "Personas", "Connect", "Done"]
    : ["Campaign", "Template", "Fields", "Personas"];

  const handleSave = useCallback(async () => {
    if (!tenant || !campaignName.trim()) return;
    setSaving(true);
    setError(null);

    try {
      // 1. Create campaign
      const campRes = await fetch("/api/dashboard/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: tenant.id,
          name: campaignName.trim(),
          description: campaignDescription.trim() || null,
          form_names: formNames,
        }),
      });
      const campaign = await campRes.json();
      if (campaign.error) throw new Error(campaign.error);

      // 2. Save analysis config
      if (fields.length > 0) {
        await fetch("/api/dashboard/analysis-config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: tenant.id,
            campaign_id: campaign.id,
            system_prompt: systemPrompt,
            output_schema: fieldsToSchema(fields),
          }),
        });
      }

      // 3. Save personas
      if (personas.length > 0) {
        await fetch("/api/dashboard/taxonomies", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: tenant.id,
            campaign_id: campaign.id,
            buckets: personas,
          }),
        });
      }

      refreshCampaigns();
      setSaving(false);

      if (onComplete) {
        onComplete();
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Setup failed");
    }
  }, [tenant, campaignName, campaignDescription, formNames, fields, systemPrompt, personas, refreshCampaigns, onComplete, router]);

  function canAdvance(): boolean {
    switch (step) {
      case 0: return !!campaignName.trim();
      case 1: return !!selectedTemplate;
      default: return true;
    }
  }

  function handleNext() {
    if (step === steps.length - 1) {
      // Last step — save
      if (mode === "org" && step === steps.length - 1) {
        handleSave();
      } else {
        handleSave();
      }
    } else {
      setStep(step + 1);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <button
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                i === step
                  ? "bg-accent text-white font-medium"
                  : i < step
                  ? "bg-accent/15 text-accent cursor-pointer hover:bg-accent/25"
                  : "bg-card-border/30 text-muted"
              }`}
            >
              {label}
            </button>
            {i < steps.length - 1 && <span className="text-card-border">→</span>}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === 0 && (
        <div>
          <h2 className="text-xl font-bold mb-2">
            {mode === "org" ? "Welcome to We Hear You" : "New Campaign"}
          </h2>
          <p className="text-sm text-muted mb-6">
            {mode === "org"
              ? "Let's set up your first campaign. A campaign is a data collection effort — like an onboarding survey, NPS study, or content series."
              : "Give your campaign a name and optionally link it to specific form sources."}
          </p>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Campaign name</label>
              <input
                type="text"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., Q2 NPS Survey, Onboarding Interviews"
                className="text-sm w-full"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Description (optional)</label>
              <input
                type="text"
                value={campaignDescription}
                onChange={(e) => setCampaignDescription(e.target.value)}
                placeholder="What is this campaign for?"
                className="text-sm w-full"
              />
            </div>
            {existingFormNames.length > 0 && (
              <div>
                <label className="text-xs text-muted uppercase tracking-wider block mb-1.5">Link to form sources</label>
                <div className="flex flex-col gap-1.5 soft-card p-3 max-h-40 overflow-y-auto">
                  {existingFormNames.map((fn) => (
                    <label key={fn} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formNames.includes(fn)}
                        onChange={() => {
                          setFormNames(formNames.includes(fn)
                            ? formNames.filter((f) => f !== fn)
                            : [...formNames, fn]);
                        }}
                      />
                      {fn}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <h2 className="text-xl font-bold mb-2">Choose a starting template</h2>
          <p className="text-sm text-muted mb-6">
            Pick a template that matches your use case. You can customize everything in the next step.
          </p>
          <TemplateSelector
            selected={selectedTemplate?.id ?? null}
            onSelect={handleTemplateSelect}
          />
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="text-xl font-bold mb-2">Customize your analysis fields</h2>
          <p className="text-sm text-muted mb-6">
            These are the insights WHY will extract from every response. Add, remove, or modify fields to match exactly what you need.
          </p>
          <SchemaBuilder fields={fields} onChange={setFields} />
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="text-xl font-bold mb-2">Set up personas</h2>
          <p className="text-sm text-muted mb-6">
            Personas help you categorize the people submitting responses. You can skip this and set them up later.
          </p>
          <PersonaEditor personas={personas} onChange={setPersonas} />
        </div>
      )}

      {step === 4 && mode === "org" && (
        <div>
          <h2 className="text-xl font-bold mb-2">Connect a source</h2>
          <p className="text-sm text-muted mb-6">
            Connect VideoAsk or another webhook source to start collecting responses. You can also do this later from Settings → Connections.
          </p>
          <div className="soft-card p-5 text-center">
            <p className="text-sm text-muted mb-3">
              You&apos;ll be able to connect sources from the Connections page after setup is complete.
            </p>
            <p className="text-xs text-muted/60">
              This step is optional — click &ldquo;Finish Setup&rdquo; to continue.
            </p>
          </div>
        </div>
      )}

      {step === (mode === "org" ? 5 : 4) && (
        <div className="text-center py-8">
          <h2 className="text-xl font-bold mb-2">You&apos;re all set</h2>
          <p className="text-sm text-muted mb-4">
            Your campaign <strong>{campaignName}</strong> is ready.
            {selectedTemplate && selectedTemplate.id !== "blank" && (
              <> Using the <strong>{selectedTemplate.name}</strong> template with {fields.length} analysis fields.</>
            )}
            {personas.length > 0 && (
              <> {personas.length} personas configured.</>
            )}
          </p>
        </div>
      )}

      {/* Navigation */}
      {error && <p className="text-xs text-negative mt-4">{error}</p>}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-card-border">
        <button
          onClick={() => step > 0 && setStep(step - 1)}
          disabled={step === 0}
          className="text-sm text-muted hover:text-foreground disabled:opacity-30"
        >
          Back
        </button>
        <div className="flex items-center gap-3">
          {(step === 3 || (step === 4 && mode === "org")) && (
            <button
              onClick={() => setStep(step + 1)}
              className="text-sm text-muted hover:text-foreground"
            >
              Skip
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canAdvance() || saving}
            className="bg-accent text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:bg-accent-hover disabled:opacity-50"
          >
            {saving
              ? "Creating..."
              : step === steps.length - 1
              ? "Finish Setup"
              : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
