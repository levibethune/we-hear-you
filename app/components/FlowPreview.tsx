import type { FlowCondition } from "../lib/types";

const FIELD_LABELS: Record<string, string> = {
  campaign: "campaign",
  sentiment: "sentiment",
  mood: "mood",
  persona: "persona",
  themes: "themes",
  source_type: "source",
  source_form_name: "form",
  transcription: "transcription",
};

const OPERATOR_LABELS: Record<string, string> = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  not_contains: "does not contain",
  in: "is one of",
  not_in: "is not one of",
};

const TRIGGER_LABELS: Record<string, string> = {
  response_created: "a new response comes in",
  person_updated: "a person profile updates",
  both: "a new response comes in or a person updates",
};

function resolveValue(field: string, value: string | string[], campaignNames?: Record<string, string>): string {
  if (field === "campaign" && campaignNames) {
    if (Array.isArray(value)) return value.map((v) => campaignNames[v] || v).join(", ");
    return campaignNames[value as string] || (value as string);
  }
  return Array.isArray(value) ? value.join(", ") : value || "...";
}

export function FlowPreview({
  triggerOn,
  conditions,
  conditionLogic,
  webhookUrl,
  campaignNames,
}: {
  triggerOn: string;
  conditions: FlowCondition[];
  conditionLogic: "all" | "any";
  webhookUrl: string;
  campaignNames?: Record<string, string>;
}) {
  if (conditions.length === 0 && !webhookUrl) {
    return <p className="text-sm text-muted italic">Configure your flow to see a preview.</p>;
  }

  const joiner = conditionLogic === "any" ? " or " : " and ";

  return (
    <p className="text-sm leading-relaxed">
      When <strong>{TRIGGER_LABELS[triggerOn] || triggerOn}</strong>
      {conditions.length > 0 && (
        <>
          {" "}where{" "}
          {conditions.map((c, i) => (
            <span key={i}>
              {i > 0 && <span className="text-muted">{joiner}</span>}
              <strong>{FIELD_LABELS[c.field] || c.field}</strong>{" "}
              {OPERATOR_LABELS[c.operator] || c.operator}{" "}
              <strong>{resolveValue(c.field, c.value, campaignNames)}</strong>
            </span>
          ))}
        </>
      )}
      {webhookUrl ? (
        <>
          , send data to{" "}
          <strong className="text-accent">
            {webhookUrl.includes("zapier") ? "Zapier" : webhookUrl.includes("make.com") || webhookUrl.includes("integromat") ? "Make" : "webhook"}
          </strong>
          .
        </>
      ) : (
        <span className="text-muted">.</span>
      )}
    </p>
  );
}
