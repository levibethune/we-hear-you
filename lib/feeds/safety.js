/**
 * Video feed safety filter.
 * Pure function: given a response and the feed's safety requirements,
 * return whether the response is safe to publish.
 */

/**
 * @param {object} response - Response with raw_analysis containing safety object
 * @param {object} requirements - Feed safety_required: { no_pii, no_profanity, no_hate_speech, on_topic }
 * @param {string|null} topic - Feed's topic description (e.g., "cooking and recipes") for on-topic check
 * @returns {{ passes: boolean, reason: string|null }}
 */
export function passesSafety(response, requirements, topic) {
  const safety = response?.raw_analysis?.safety || {};

  if (requirements.no_pii && safety.contains_pii === true) {
    return { passes: false, reason: "contains PII" };
  }

  if (requirements.no_profanity && safety.contains_profanity === true) {
    return { passes: false, reason: "contains profanity" };
  }

  if (requirements.no_hate_speech && safety.contains_hate_speech === true) {
    return { passes: false, reason: "contains hate speech" };
  }

  if (requirements.on_topic && topic) {
    const responseTopics = (safety.topics || []).map((t) => String(t).toLowerCase());
    const feedTopicWords = topic.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 2);

    // Match if any of the response topics overlaps with any feed topic word
    const matched = responseTopics.some((rt) =>
      feedTopicWords.some((fw) => rt.includes(fw) || fw.includes(rt))
    );

    if (!matched) {
      return { passes: false, reason: "off-topic" };
    }
  }

  return { passes: true, reason: null };
}
