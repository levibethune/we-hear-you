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
// Simple stemmer: strip common English suffixes for fuzzy matching
function stem(word) {
  return word
    .replace(/(ies)$/, "y")    // stories → story, puppies → puppy
    .replace(/(es|s)$/, "")    // dogs → dog, lives → liv (close enough)
    .replace(/(ing|tion|ment|ness|ful|less|ous|ive|able|ible)$/, ""); // living → liv
}

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
    const feedTopicLower = topic.toLowerCase();
    const feedTopicWords = feedTopicLower.split(/[\s,]+/).filter((w) => w.length > 2);

    // Stem all words for fuzzy matching (stories↔story, dogs↔dog, etc.)
    const feedTopicStems = feedTopicWords.map(stem);
    const feedTopicStemStr = feedTopicStems.join(" ");

    const matched = responseTopics.some((rt) => {
      // Direct: response topic found in feed description
      if (feedTopicLower.includes(rt)) return true;
      // Stemmed word-level matching
      const rtWords = rt.split(/[\s,]+/).filter((w) => w.length > 2);
      const rtStems = rtWords.map(stem);
      // Any stemmed response topic word matches any stemmed feed topic word
      if (rtStems.some((rs) => feedTopicStems.some((fs) => rs === fs || rs.includes(fs) || fs.includes(rs)))) return true;
      // Any stemmed response word found in stemmed feed description
      if (rtStems.some((rs) => feedTopicStemStr.includes(rs))) return true;
      return false;
    });

    if (!matched) {
      return { passes: false, reason: "off-topic" };
    }
  }

  return { passes: true, reason: null };
}
