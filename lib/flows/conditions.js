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

const EMPTY_LABELS = {
  campaign: "no campaign assigned",
};

function emptyLabel(field) {
  return EMPTY_LABELS[field] || "unset";
}

function formatValue(val, field, lookups = {}) {
  if (val == null || val === "") return emptyLabel(field);
  if (Array.isArray(val)) return val.length === 0 ? emptyLabel(field) : val.map((v) => formatValue(v, field, lookups)).join(", ");
  if (field === "campaign" && lookups.campaigns?.[val]) return `"${lookups.campaigns[val]}"`;
  return `"${val}"`;
}

function describeCondition(condition, response, person, lookups = {}) {
  const fieldName = FIELD_NAMES[condition.field] || condition.field;
  const actual = formatValue(resolveField(condition.field, response, person), condition.field, lookups);
  const expected = formatValue(condition.value, condition.field, lookups);
  switch (condition.operator) {
    case "equals":
      return `${fieldName} should be ${expected} — actual: ${actual}`;
    case "not_equals":
      return `${fieldName} should not be ${expected} — actual: ${actual}`;
    case "contains":
      return `${fieldName} should contain ${expected} — actual: ${actual}`;
    case "not_contains":
      return `${fieldName} should not contain ${expected} — actual: ${actual}`;
    case "in":
      return `${fieldName} should be one of ${expected} — actual: ${actual}`;
    case "not_in":
      return `${fieldName} should not be one of ${expected} — actual: ${actual}`;
    default:
      return `${fieldName} ${condition.operator} ${expected} — actual: ${actual}`;
  }
}

/**
 * Build a human-readable reason a condition set failed to match.
 * Returns null if it actually matched.
 *
 * lookups (optional): { campaigns: { [id]: name } } — used to substitute
 * names for IDs in the message so it reads naturally.
 */
export function describeFirstFailure(conditions, logic, response, person, lookups = {}) {
  if (!conditions || conditions.length === 0) return null;
  const evaluated = conditions.map((c) => ({
    condition: c,
    matched: evaluateCondition(c, response, person),
  }));

  if (logic === "any") {
    if (evaluated.some((e) => e.matched)) return null;

    // Common case: every condition is on the same field with the same operator
    // (e.g. Campaign=A OR Campaign=B). Collapse into a single readable phrase.
    const firstField = evaluated[0].condition.field;
    const firstOp = evaluated[0].condition.operator;
    const allSameShape = evaluated.every((e) => e.condition.field === firstField && e.condition.operator === firstOp);
    if (allSameShape && (firstOp === "equals" || firstOp === "in")) {
      const fieldName = FIELD_NAMES[firstField] || firstField;
      const wanted = evaluated.map((e) => formatValue(e.condition.value, firstField, lookups)).join(" or ");
      const actual = formatValue(resolveField(firstField, response, person), firstField, lookups);
      return `${fieldName} should be ${wanted} — actual: ${actual}`;
    }

    const phrases = evaluated.map((e) => describeCondition(e.condition, response, person, lookups));
    return `None of the filters matched. Tried: ${phrases.join("; ")}`;
  }

  const firstFail = evaluated.find((e) => !e.matched);
  if (!firstFail) return null;
  return describeCondition(firstFail.condition, response, person, lookups);
}
