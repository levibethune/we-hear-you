/**
 * In-memory condition evaluation for flows.
 * Evaluates flow conditions against response + person data.
 */

/**
 * Check if a response/person pair matches all flow conditions.
 * @param {Array} conditions - Array of { field, operator, value }
 * @param {string} logic - 'all' (AND) or 'any' (OR)
 * @param {object} response - Response record with raw_analysis
 * @param {object} person - Person record
 * @returns {boolean}
 */
export function matchesConditions(conditions, logic, response, person) {
  if (!conditions || conditions.length === 0) return true;

  const results = conditions.map((c) => evaluateCondition(c, response, person));
  return logic === "any" ? results.some(Boolean) : results.every(Boolean);
}

function evaluateCondition(condition, response, person) {
  const value = resolveField(condition.field, response, person);

  switch (condition.operator) {
    case "equals":
      return normalize(value) === normalize(condition.value);

    case "not_equals":
      return normalize(value) !== normalize(condition.value);

    case "contains":
      if (Array.isArray(value)) {
        return value.some((v) => normalize(v) === normalize(condition.value));
      }
      return String(value || "").toLowerCase().includes(String(condition.value).toLowerCase());

    case "not_contains":
      if (Array.isArray(value)) {
        return !value.some((v) => normalize(v) === normalize(condition.value));
      }
      return !String(value || "").toLowerCase().includes(String(condition.value).toLowerCase());

    case "in":
      if (!Array.isArray(condition.value)) return false;
      return condition.value.some((cv) => normalize(cv) === normalize(value));

    case "not_in":
      if (!Array.isArray(condition.value)) return true;
      return !condition.value.some((cv) => normalize(cv) === normalize(value));

    default:
      return false;
  }
}

function resolveField(field, response, person) {
  switch (field) {
    case "campaign":
      return response.campaign_id;
    case "sentiment":
      return response.sentiment;
    case "mood":
      return response.mood;
    case "persona":
      return response.raw_analysis?.persona ?? person?.persona;
    case "themes":
      return response.themes;
    case "source_type":
      return response.source_type;
    case "source_form_name":
      return response.source_form_name;
    case "transcription":
      return response.transcription;
    default:
      // Custom analysis field — look up in raw_analysis by field name
      return response.raw_analysis?.[field];
  }
}

function normalize(val) {
  if (val == null) return "";
  return String(val).toLowerCase().trim();
}

const FIELD_NAMES = {
  campaign: "Campaign",
  sentiment: "Sentiment",
  mood: "Mood",
  persona: "Persona",
  themes: "Themes",
  source_type: "Source",
  source_form_name: "Form",
  transcription: "Transcription",
};

const OPERATOR_PHRASES = {
  equals: "should be",
  not_equals: "should not be",
  contains: "should contain",
  not_contains: "should not contain",
  in: "should be one of",
  not_in: "should not be one of",
};

function formatValue(val) {
  if (val == null || val === "") return "(empty)";
  if (Array.isArray(val)) return val.length === 0 ? "(empty)" : val.map(formatValue).join(", ");
  return `"${val}"`;
}

function describeCondition(condition, response, person) {
  const fieldName = FIELD_NAMES[condition.field] || condition.field;
  const actual = resolveField(condition.field, response, person);
  const phrase = OPERATOR_PHRASES[condition.operator] || condition.operator;
  return `${fieldName} ${phrase} ${formatValue(condition.value)} (was ${formatValue(actual)})`;
}

/**
 * Build a human-readable reason a condition set failed to match.
 * Returns null if it actually matched.
 */
export function describeFirstFailure(conditions, logic, response, person) {
  if (!conditions || conditions.length === 0) return null;
  const evaluated = conditions.map((c) => ({
    condition: c,
    matched: evaluateCondition(c, response, person),
  }));
  if (logic === "any") {
    if (evaluated.some((e) => e.matched)) return null;
    const phrases = evaluated.map((e) => describeCondition(e.condition, response, person));
    return `No condition matched (ANY mode). Tried: ${phrases.join("; ")}`;
  }
  const firstFail = evaluated.find((e) => !e.matched);
  if (!firstFail) return null;
  return describeCondition(firstFail.condition, response, person);
}
