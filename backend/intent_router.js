/**
 * One routing decision for a chat turn.
 * Explicit subject outranks a vague continuation.
 * A specific intent outranks a broad chart reading.
 * Factual lookups outrank interpretation.
 */

const { isFactualQuestion } = require("./factual_questions");
const { isPredictionQuestion } = require("./prediction_guard");
const {
  detectLifeTopic,
  parseClickedAspect,
} = require("./chart_architecture");
const {
  hasExplicitAnalyticalTarget,
  isChartAnalysisQuestion,
  isBroadChartAnalysisPrompt,
  historyBeforeCurrentTurn,
  contextIsChartAnalysis,
} = require("./chart_analysis");

function isVagueFollowUp(message) {
  const t = String(message || "").toLowerCase().trim();
  return /^(why(\?$| is that| do i)|how come|say more|tell me more|say that again|repeat( that)?|explain that|go (on|deeper)|and\?$|what do you mean|can you (say|explain|go) more|can you (repeat|clarify)( that)?|keep going|what else( stands out| do you see)?|anything else)\b/.test(
    t,
  );
}

function isContextOnlyFollowUp(message) {
  if (hasExplicitAnalyticalTarget(message)) return false;
  if (isFactualQuestion(message)) return false;
  return isVagueFollowUp(message);
}

function userTexts(conversationHistory) {
  return (conversationHistory || [])
    .filter(function (entry) {
      return entry && entry.role === "user" && String(entry.content || "").trim();
    })
    .map(function (entry) {
      return String(entry.content || "").trim();
    });
}

function isAcknowledgement(message) {
  const text = String(message || "").toLowerCase().trim();
  return (
    /^(hi|hello|hey|hiya|howdy|greetings|sup|yo|what's up|whats up)$/i.test(text) ||
    /^(thanks|thank you|thx|ty|appreciate it)$/i.test(text) ||
    /^(ok|okay|k|sure|yep|yeah|yes|no|nope|alright|got it)$/i.test(text) ||
    /^(cool|nice|awesome|great|good|fine)$/i.test(text)
  );
}

/**
 * Walk recent user lines.
 * A chart subject is usable. A factual or unrelated line blocks stored context.
 * Vague follow-ups and bare acknowledgements are skipped.
 */
function historySubjectResolution(conversationHistory) {
  const users = userTexts(conversationHistory);
  for (let i = users.length - 1; i >= 0; i--) {
    const text = users[i];
    if (isContextOnlyFollowUp(text) || isAcknowledgement(text)) continue;
    if (isInheritableChartSubject(text)) return { subject: text, blocked: false };
    return { subject: "", blocked: true };
  }
  return { subject: "", blocked: false };
}

function isInheritableChartSubject(text) {
  if (!text || isFactualQuestion(text) || isContextOnlyFollowUp(text)) return false;
  if (parseClickedAspect(text)) return true;
  if (isChartSpecificQuestion(text)) return true;
  if (isChartAnalysisQuestion(text)) return true;
  return false;
}

function storedSubject(validatedState) {
  const subject =
    validatedState && typeof validatedState.subject === "string"
      ? validatedState.subject.trim()
      : "";
  if (!isInheritableChartSubject(subject)) return "";
  return subject;
}

function effectiveQuestion(message, conversationHistory, validatedState) {
  if (!isContextOnlyFollowUp(message)) return message;
  const found = historySubjectResolution(conversationHistory);
  if (found.subject) return found.subject;
  if (found.blocked) return message;
  return storedSubject(validatedState) || message;
}

/**
 * A short continuation of a planet, house, angle, aspect, or broad chart
 * question. History wins. Stored state is used only when history has no
 * subject and is not blocked by a recent factual or unrelated line.
 */
function continuesEstablishedChartSubject(message, history, validatedState) {
  if (!isContextOnlyFollowUp(message)) return false;
  const prior = historyBeforeCurrentTurn(message, history);
  const found = historySubjectResolution(prior);
  if (found.subject) return true;
  if (found.blocked) return false;
  return !!storedSubject(validatedState);
}

function isChartSpecificQuestion(message) {
  const t = String(message || "").toLowerCase().trim();
  if (!t) return false;
  if (parseClickedAspect(t)) return true;
  if (
    /\b(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|ceres|pallas|juno|vesta)\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\b(ascendant|midheaven|descendant|imum|rising|transit|stellium|t-square|grand trine|yod)\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (/\b(\d+(st|nd|rd|th)\s+house|house\s+\d+)\b/.test(t)) return true;
  if (/\binterpret(ing)? (my |the |this )?(birth )?chart\b/.test(t)) return true;
  if (
    /\b(tell me about|what('s| is) in|walk (me )?through) (my |the |this )?(birth )?chart\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (/\bwhat stands out\b/.test(t) && /\bchart\b/.test(t)) return true;
  if (
    /\b(conjunction|conjunct|square|trine|opposition|opposite|sextile|quincunx)\b/.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

function explicitSubjectOf(message) {
  if (!hasExplicitAnalyticalTarget(message)) return null;
  const t = String(message || "").toLowerCase();
  const planet = t.match(
    /\b(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|ceres|pallas|juno|vesta)\b/,
  );
  if (planet) return planet[1];
  const life = t.match(
    /\b(career|job|work|relationships?|love|money|finances?|family|home|friends?|health|purpose)\b/,
  );
  if (life) return life[1];
  return "specified";
}

function userRequestsOutsideResearch(message) {
  return /\b(search the web|look up|outside research|what do (?:other )?(?:astrologers|authors|sources|websites) say|according to (?:alan leo|astrologers|sources))\b/i.test(
    String(message || ""),
  );
}

/**
 * @param {{ message: string, history?: Array }} input
 */
function routeChatIntent(input) {
  const message = input && input.message;
  const history = (input && input.history) || [];
  const priorConversation = historyBeforeCurrentTurn(message, history);
  const explicit = hasExplicitAnalyticalTarget(message);
  const validatedState = input && input.validatedState;
  const questionForMode = explicit
    ? message
    : effectiveQuestion(message, priorConversation, validatedState);
  const inheritedIntent =
    !explicit &&
    isVagueFollowUp(message) &&
    questionForMode !== message;
  const factual = isFactualQuestion(message);
  const clickedAspect =
    parseClickedAspect(message) ||
    (isContextOnlyFollowUp(message) ? parseClickedAspect(questionForMode) : null);
  const aspectMode = !!clickedAspect;
  const chartAnalysisMode =
    !aspectMode &&
    !factual &&
    isChartAnalysisQuestion(questionForMode, priorConversation);
  const chartMode =
    !aspectMode &&
    !chartAnalysisMode &&
    isChartSpecificQuestion(questionForMode);
  const topic =
    !aspectMode && !chartAnalysisMode && !chartMode
      ? detectLifeTopic(questionForMode)
      : null;
  const topicMode = !!topic;
  const thesisMode = !aspectMode && !chartAnalysisMode && !chartMode && !topicMode;
  let primaryIntent = "PERSONAL_SYNTHESIS";
  if (factual) primaryIntent = "FACTUAL";
  else if (aspectMode) primaryIntent = "ASPECT";
  else if (chartAnalysisMode) primaryIntent = "CHART_ANALYSIS";
  else if (chartMode) primaryIntent = "PLACEMENT";
  else if (topicMode) primaryIntent = "TOPIC";
  const prediction = isPredictionQuestion(message);
  return {
    primaryIntent: primaryIntent,
    secondaryIntent: prediction ? "PREDICTION" : null,
    explicitSubject: explicitSubjectOf(message),
    inheritedIntent: inheritedIntent,
    progressionEligible: !!(
      chartAnalysisMode &&
      isBroadChartAnalysisPrompt(questionForMode, priorConversation)
    ),
    factual: factual,
    asked: String(message || ""),
    questionForMode: questionForMode,
    priorConversation: priorConversation,
    topic: topic,
    clickedAspect: clickedAspect,
    aspectMode: aspectMode,
    chartAnalysisMode: chartAnalysisMode,
    chartMode: chartMode,
    topicMode: topicMode,
    thesisMode: thesisMode,
    outsideResearch: userRequestsOutsideResearch(message),
  };
}

function isRepeatPrompt(currentMsg, history) {
  const text = String(currentMsg || "").toLowerCase().trim();
  if (!text) return false;
  if (
    isFactualQuestion(text) ||
    /what (sign|house|element|degree)|which (sign|house|planet)|how many|where is my|what is my (sun|moon|rising|ascendant)|what house is|what sign is/i.test(
      text,
    )
  ) {
    return false;
  }
  if (isBroadChartAnalysisPrompt(text, history)) {
    return contextIsChartAnalysis(history);
  }
  if (text.length < 40) return false;
  const stop = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "to",
    "of",
    "in",
    "on",
    "for",
    "with",
    "at",
    "from",
    "by",
    "about",
    "as",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "i",
    "me",
    "my",
    "you",
    "your",
    "we",
    "our",
    "it",
    "this",
    "that",
    "these",
    "those",
    "what",
    "why",
    "how",
    "when",
    "where",
    "tell",
    "explain",
    "please",
  ]);
  function tokens(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(function (word) {
        return word && word.length > 2 && !stop.has(word);
      });
  }
  function jaccard(a, b) {
    const left = new Set(a);
    const right = new Set(b);
    if (left.size === 0 || right.size === 0) return 0;
    let inter = 0;
    left.forEach(function (token) {
      if (right.has(token)) inter += 1;
    });
    const union = left.size + right.size - inter;
    return union ? inter / union : 0;
  }
  const curTok = tokens(text);
  const recentUser = (history || [])
    .filter(function (entry) {
      return entry && entry.role === "user" && entry.content;
    })
    .slice(-10);
  for (let i = 0; i < recentUser.length; i++) {
    const prev = String(recentUser[i].content || "").toLowerCase().trim();
    if (!prev) continue;
    if (prev === text) return true;
    if (
      prev.length > 40 &&
      (prev.includes(text) || text.includes(prev)) &&
      Math.min(prev.length, text.length) > 40
    ) {
      return true;
    }
    if (curTok.length < 4) continue;
    const prevTok = tokens(prev);
    if (prevTok.length < 4) continue;
    if (jaccard(curTok, prevTok) >= 0.72) return true;
  }
  return false;
}

module.exports = {
  routeChatIntent,
  isRepeatPrompt,
  isVagueFollowUp,
  isChartSpecificQuestion,
  continuesEstablishedChartSubject,
  userRequestsOutsideResearch,
};
