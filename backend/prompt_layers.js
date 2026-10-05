/**
 * Prompt layers: separate system behavior from content behavior.
 * Makes debugging and maintenance easier.
 *
 * Layers:
 * 1. System rules – safety, tone, hard constraints (who the assistant is, what it must never do)
 * 2. Astrology interpreter rules – how to prioritize chart factors, use web sources, handle aspects
 * 3. Confidence wording – internal confidence scoring and how to phrase (high/medium/low) to build trust
 * 4. Response templates – how much to say on this turn; voice left to the model
 * 5. Relevant Alan Leo source modules, only when the turn maps to them
 * 6. Runtime context – chart data + profile memory + prioritized points + web block (built per request)
 */

const { getTraditionalChartRules } = require("./traditional_chart");
const { formatActiveBodies } = require("./reading_configuration");
const {
  getNoPredictionRules,
  getPredictionQuestionRules,
} = require("./prediction_guard");
const { getChartAnalysisRules } = require("./chart_analysis");
const { getPromptSection } = require("./prompt_loader");
const { isFactualQuestion } = require("./factual_questions");
const { buildAlanLeoKnowledgeBlock } = require("./knowledge/alan-leo/loader");

// ─── Layer 1: System rules (safety, tone, hard constraints) ─────────────────

function getSystemRules() {
  return (
    getPromptSection("core.md", "identity") +
    "\n\n" +
    getNoPredictionRules()
  );
}

// ─── Layer 2: Astrology interpreter rules (whole-chart first, then details; plus sources) ─

function getAstrologyInterpreterRules() {
  return (
    "THIS TURN IS A SPECIFIC CHART QUESTION, NOT A WHOLE-CHART ANALYSIS AND NOT A PERSONALITY PORTRAIT. Answer what they asked. Use the supplied architecture only where it bears on that question. Do not walk the rest of the chart.\n\n" +
    "THE ARCHITECTURE IS ALREADY COMPUTED. Chart ruler, dominance, dignity, reception, dispositors, house-rulership chains, stelliums, configurations, aspect links, element balance, modality balance, and hemisphere emphasis are evidence you may cite when the question needs them. Do not derive them again from positions, and do not rescore dominance. Do not treat that list as an outline.\n\n" +
    "Cite a supplied fact only when it changes the point they asked about. Dignity colors expression: domicile or exaltation is more direct; detriment or fall is the same function with more friction. Do not treat a retrograde planet as weaker. An angular placement, stellium, or configuration means what the architecture already marks. If testimony conflicts, name both sides. Do not invent a configuration, ruler, or body the architecture does not list.\n\n" +
    "ACTIVE BODIES ONLY. Interpret only planets and optional bodies present in CHART FACTS and ACTIVE BODIES. Enabled asteroids are supporting testimony. Do not treat them as equal to the planetary ranking, and do not rescore them.\n\n" +
    "MINOR ASPECTS in CHART FACTS are nuance. Do not make them the subject unless the user asked about them.\n\n" +
    "If they ask the same chart question again, go deeper on that question using the supplied structures. Do not choose a new focus."
  );
}

// ─── Layer 3: Confidence scoring and wording (build trust by matching language to certainty) ─

function getUnknownBirthTimeRules() {
  return (
    "BIRTH TIME UNKNOWN — THESE RULES OVERRIDE HOUSE, ANGLE, AND CHART-RULER INSTRUCTIONS:\n" +
    "This chart has no exact birth time. Do not treat the displayed 0° Aries Ascendant, house cusps, house placements, house rulers, chart ruler, sect, hemispheres, or ASC/MC aspects as real. They are display placeholders only.\n" +
    "Interpret from planetary signs, dignity, aspects, elements, modalities, sign stelliums, and configurations. The Moon's exact degree is approximate.\n" +
    "Answer as fully as you can from what is known. Only mention the missing birth time when the question actually needs houses, rising sign, house rulers, or hour-dependent timing. Then say briefly that without the birth time those parts cannot apply, and continue with sign and aspect language.\n" +
    "Do not invent a rising sign or house story. Do not use the house-topic map (10th for career, 7th for relationships, etc.)."
  );
}

function normalizeSensitivityFlags(flags) {
  if (!Array.isArray(flags)) return [];
  return flags
    .map(function (f) {
      return String(f || "").toLowerCase();
    })
    .filter(Boolean);
}

function getSensitivityRules(flags) {
  const list = normalizeSensitivityFlags(flags);
  if (!list.length) return "";
  const softer = list.some(function (f) {
    return /softer/.test(f);
  });
  const strengths = list.some(function (f) {
    return /strength/.test(f);
  });
  if (!softer && !strengths) return "";
  const lines = [
    "SENSITIVITY PREFERENCES (you MUST follow these for every reply, including traditional-chart readings):",
  ];
  if (softer) {
    lines.push(
      "Softer language: Keep a warm, gentle tone. Be honest about tension without harsh, clinical, or alarming wording. Name hard patterns kindly.",
    );
  }
  if (strengths) {
    lines.push(
      "Focus on strengths: Lead with what works and what they can rely on. Treat challenges as secondary, workable friction—not defects. Do not skip problems; do not center them.",
    );
  }
  return lines.join("\n");
}

function getConfidenceWordingRules() {
  return getPromptSection("core.md", "confidence");
}

// ─── Layer 4: Response templates (output structure, forbidden vs good) ────────

function isAdvancedPreferred(mode) {
  return String(mode || "").toLowerCase() === "advanced";
}

function getAdvancedVoiceRules() {
  return getPromptSection("advanced.md", "voice");
}

function getFactualTurnRules() {
  return (
    "THIS TURN IS A FACTUAL LOOKUP. Answer only the chart fact the user asked for, using DETERMINISTIC CONTEXT. " +
    "Do not write a natal interpretation, do not add personality, and do not search the web. " +
    "Beginner: plain words. Advanced: technical terms are fine; do not define them and do not expand into a reading."
  );
}

function getThesisTurnRules(preferredMode) {
  if (isAdvancedPreferred(preferredMode)) {
    return (
      "THIS TURN IS A SYNTHESIS OF THE PERSON FOR AN EXPERT READER.\n" +
      "They asked who they are or what they are like. One coherent analysis of how the architecture’s factors interact—not a placement list and not a beginner paraphrase. " +
      "Use the supplied architecture ranking; do not rescore it. Cite the chart ruler, angularity, tight aspects, luminaries, dispositors, and listed configurations. Cite geometry when it changes the weight. " +
      "INTERNAL CLAIMS are constraints only—do not paste them. Show the interpretive chain from those structures.\n\n" +
      "Do not write one paragraph per planet. Do not define standard terms. Do not flatten mechanics into “you want safety / you want to act.”\n" +
      "Do not call search_astrology_info, search_web_astrology, or save_chart_summary this turn."
    );
  }
  return (
    "THIS TURN IS A GENERAL CONVERSATION ABOUT THE PERSON, NOT A CHART TOUR.\n" +
    "They asked something like who they are, what they're like, or a broad follow-up. " +
    "Answer in kind: natural, conversational, second person. " +
    "Save planets, houses, signs, aspects, and other chart language for later, when they ask about the chart itself or tap a technical chip.\n\n" +
    "INTERNAL CLAIMS are for you only. Do not paste them, quote them, or open with a summary of them. " +
    "Write the whole reply yourself: two or three short paragraphs of ordinary speech. " +
    "Cover the claims by saying how this person actually lives—work, closeness, timing, privacy, stress. " +
    "Every sentence should be something a friend could understand with no astrology. " +
    "Name the tension in plain terms (for example: you want safety and you also want to move before you feel ready). " +
    "Do not use riddles or leftover jargon: no 'live in the pull', 'engines', 'night chart', 'first quarter', 'steered by', or 'the real story'.\n\n" +
    "If they asked this kind of question before, go deeper on lived habits and feelings—not by naming new placements.\n" +
    "Do not write a Sun paragraph, a Moon paragraph, and an aspects paragraph. " +
    "Do not name planets, houses, signs, aspects, or technical condition unless a word is already in the user's question. " +
    "Do not use the house-topic map (career / relationships / identity). " +
    "Do not call search_astrology_info, search_web_astrology, or save_chart_summary this turn."
  );
}

function getTopicTurnRules(topic, preferredMode) {
  const area = topic && topic.label ? topic.label : "this part of life";
  if (isAdvancedPreferred(preferredMode)) {
    return (
      "THIS TURN IS A LIFE-AREA QUESTION FOR AN EXPERT READER.\n" +
      "The user asked about " +
      area +
      ". Stay on that area. Use TOPIC LENS as working data: house, house ruler, essential/accidental dignity, reception, and the aspects that condition them. " +
      "Show how those factors reinforce or contradict each other. Prioritize the strongest links. Cite orb and applying/separating when it matters. " +
      "Do not define houses or rulers. Do not reprint a beginner portrait. Do not walk the whole chart.\n\n" +
      "Web is color only. At most one search if you need a phrase. Do not build the answer from blogs. " +
      "Do not call save_chart_summary this turn."
    );
  }
  return (
    "THIS TURN IS A LIFE-AREA QUESTION, NOT A TOUR AND NOT A NEW PORTRAIT.\n" +
    "The user asked about " +
    area +
    ". Answer that question.\n\n" +
    "Open by tying the answer to the same through-line in INTERNAL CLAIMS (one or two sentences). Then stay in this life area. " +
    "Use TOPIC LENS internally. Do not name planets, houses, signs, or aspects unless the user already used those words. " +
    "Do not reprint the self-portrait. Do not walk the whole chart. Do not invent a second personality.\n\n" +
    "Same voice as a conversation: concrete, second person, something a friend could understand. " +
    "No riddles or leftover jargon: no 'live in the pull', 'engines', 'night chart', 'first quarter', or 'steered by'. " +
    "Do not lead with house numbers unless the user asked for them.\n\n" +
    "Web is color only. At most one search if you need a phrase. Do not build the answer from blogs. " +
    "Do not call save_chart_summary this turn."
  );
}

function getAspectTurnRules(preferredMode) {
  if (isAdvancedPreferred(preferredMode)) {
    return (
      "THIS TURN IS A CLICKED ASPECT FOR AN EXPERT READER.\n" +
      "Stay with that pair. Use ASPECT LENS as geometry: aspect type, orb, applying/separating, dignity of each end, houses, rulerships, and any larger configuration. " +
      "Show why this contact ranks as it does, and how each planet’s house and rulerships channel the dynamic. " +
      "Do not define “square” or “orb.” Do not convert the contact into an introductory tension metaphor. Do not walk the rest of the chart.\n\n" +
      "Web is color only. At most one search if you need a phrase. Do not build the answer from blogs. " +
      "Do not call save_chart_summary this turn."
    );
  }
  return (
    "THIS TURN IS A CLICKED ASPECT, NOT A TOUR AND NOT A NEW PORTRAIT.\n" +
    "The user pointed at one connection on the wheel. Answer that connection.\n\n" +
    "Open by tying it to the same through-line in INTERNAL CLAIMS (one or two sentences). Then stay with what these two needs do together in lived life. " +
    "Use ASPECT LENS. You may name the two planets and the aspect once, then talk in ordinary speech. " +
    "Do not reprint the self-portrait. Do not walk the rest of the chart. Do not invent a second personality.\n\n" +
    "If this pair sits in a larger stress pattern, say the lived tension—do not lecture the geometry. " +
    "Same voice as the portrait: concrete, second person, something a friend could understand. " +
    "No riddles or leftover jargon: no 'live in the pull', 'engines', 'night chart', 'first quarter', or 'steered by'.\n\n" +
    "Web is color only. At most one search if you need a phrase. Do not build the answer from blogs. " +
    "Do not call save_chart_summary this turn."
  );
}

function getResponseTemplates() {
  return getPromptSection("core.md", "output");
}

// ─── Layer 5: Runtime context (chart data + question context; built per request) ─

/**
 * Build the runtime context block: profile memory (if any), prioritized chart points (if any), chart facts, web interpretations, and closing reminder.
 * @param {object} options
 * @param {string} options.profileMemoryBlock - Pre-rendered profile memory section (or "")
 * @param {string} [options.architectureBlock] - Computed chart architecture (or "")
 * @param {string} options.prioritizedBlock - Pre-rendered prioritized chart points (or "")
 * @param {string} options.chartFactsOnly - Formatted chart facts string
 * @param {string} options.webSection - Web interpretations section (with markers)
 * @param {boolean} options.hasPrioritized - Whether prioritized points are present
 * @param {string} [options.preferredMode] - "beginner" | "advanced" for language-level reminder
 * @param {object} [options.chartSummary] - Stored reusable summary (personality, emotional, relationship, work, strengths, blindSpots, recurringLifeThemes, timingTendencies)
 */
function buildRuntimeContext(options) {
  const {
    profileMemoryBlock = "",
    architectureBlock = "",
    prioritizedBlock = "",
    chartFactsOnly = "",
    webSection = "",
    hasPrioritized = false,
    preferredMode = null,
    chartSummary = null,
    thesisMode = false,
    thesisText = "",
    topicMode = false,
    chartAnalysisMode = false,
    topicLens = "",
    aspectMode = false,
    aspectLens = "",
  } = options;

  let out = "";

  if (profileMemoryBlock) {
    out += profileMemoryBlock;
  }

  if (thesisText && String(thesisText).trim() && !chartAnalysisMode) {
    out += String(thesisText).trim() + "\n\n";
  }

  if (topicLens && String(topicLens).trim()) {
    out += String(topicLens).trim() + "\n\n";
  }

  if (aspectLens && String(aspectLens).trim()) {
    out += String(aspectLens).trim() + "\n\n";
  }

  if (
    architectureBlock &&
    String(architectureBlock).trim() &&
    !thesisMode &&
    !topicMode &&
    !aspectMode
  ) {
    out +=
      "--- CHART ARCHITECTURE (computed structural evidence; not a reply outline) ---\n" +
      String(architectureBlock).trim() +
      "\n--- END CHART ARCHITECTURE ---\n\n";
  }

  const hasSummary =
    chartSummary &&
    typeof chartSummary === "object" &&
    Object.keys(chartSummary).length > 0;

  if (thesisMode || chartAnalysisMode) {
    out +=
      "Do not call save_chart_summary this turn. Do not search the web this turn.\n\n";
  } else if (hasSummary) {
    out +=
      "--- STORED CHART SUMMARY (notes already stored for this person; use them only when this question needs them) ---\n";
    const fields = [
      { key: "personalitySummary", label: "Personality summary" },
      { key: "emotionalStyle", label: "Emotional style" },
      { key: "relationshipStyle", label: "Relationship style" },
      { key: "workStyle", label: "Work style" },
      { key: "strengths", label: "Strengths" },
      { key: "blindSpots", label: "Blind spots" },
      { key: "recurringLifeThemes", label: "Recurring life themes" },
      { key: "timingTendencies", label: "Timing tendencies" },
    ];
    fields.forEach(function (f) {
      const val = chartSummary[f.key];
      if (val != null && String(val).trim())
        out += f.label + ": " + String(val).trim() + "\n";
    });
    out += "--- END STORED CHART SUMMARY ---\n\n";
  } else if (!topicMode && !aspectMode && !chartAnalysisMode) {
    out +=
      "No stored chart summary yet. This is a storage slot, not a reply outline. If you learn something reusable about this person, you may call save_chart_summary with: personalitySummary, emotionalStyle, relationshipStyle, workStyle, strengths, blindSpots, recurringLifeThemes, timingTendencies (1-3 sentences each). Do not lengthen the reply in order to fill those fields.\n\n";
  }

  if (hasPrioritized && prioritizedBlock && !thesisMode && !chartAnalysisMode) {
    out +=
      "--- PRIORITIZED CHART POINTS (preselected evidence for this question; not a reply outline) ---\n" +
      prioritizedBlock +
      "\n--- END PRIORITIZED CHART POINTS ---\n\n";
  }

  if (!thesisMode) {
    out += chartAnalysisMode
      ? "--- CHART FACTS (geometry and placements – structural evidence only) ---\n"
      : "--- CHART FACTS (birth data – use for personalization) ---\n";
    out += chartFactsOnly + "\n";
    out += "--- END CHART FACTS ---\n\n";
    out += webSection;
  }

  out +=
    "\n\nDo not end with suggested follow-up questions or 'you might ask…' prompts—the app shows those as separate chips.";
  if (chartAnalysisMode) {
    out += getPromptSection("chart-analysis.md", "closing");
  } else if (preferredMode === "advanced") {
    out += getPromptSection("advanced.md", "closing");
  } else if (thesisMode || topicMode) {
    out += getPromptSection("beginner.md", "turn-closing");
  } else if (preferredMode === "beginner") {
    out += getPromptSection("beginner.md", "closing");
  }
  out += "\n";
  if (options && options.readingConfig) {
    out += "\n=== ACTIVE BODIES ===\n" + formatActiveBodies(options.readingConfig) + "\n";
  }

  return out;
}

/**
 * Build profile memory block from profileMemory object (for use in runtime context).
 * @param {object} profileMemory - { preferredMode, lifeThemesDiscussed, userGoals, sensitivityFlags, priorTopicsSummary }
 * @returns {string} Block text or ""
 */
function buildProfileMemoryBlock(profileMemory, options) {
  if (!profileMemory || typeof profileMemory !== "object") return "";

  const isAdvanced = profileMemory.preferredMode === "advanced";
  const chartAnalysis = options && options.chartAnalysisMode;
  const themes =
    Array.isArray(profileMemory.lifeThemesDiscussed) &&
    profileMemory.lifeThemesDiscussed.length > 0
      ? profileMemory.lifeThemesDiscussed.join(", ")
      : "none yet";
  const goals =
    Array.isArray(profileMemory.userGoals) && profileMemory.userGoals.length > 0
      ? profileMemory.userGoals.join(", ")
      : "none yet";
  const sensitivity =
    Array.isArray(profileMemory.sensitivityFlags) &&
    profileMemory.sensitivityFlags.length > 0
      ? profileMemory.sensitivityFlags.join(", ")
      : "none";
  const priorSummary =
    profileMemory.priorTopicsSummary &&
    String(profileMemory.priorTopicsSummary).trim();

  const languageLevelBlock =
    (isAdvanced
      ? getPromptSection("advanced.md", "memory")
      : chartAnalysis
        ? getPromptSection("chart-analysis.md", "memory-beginner")
        : getPromptSection("beginner.md", "memory")) + "\n\n";

  let block =
    "--- PROFILE MEMORY (use this so the chat feels continuous; reference earlier discussions) ---\n" +
    languageLevelBlock +
    "Themes already discussed with this person: " +
    themes +
    "\n" +
    "Goals or interests they've shared: " +
    goals +
    "\n" +
    "Sensitivity preferences: " +
    sensitivity +
    (sensitivity !== "none"
      ? " — treat these as hard constraints, not optional flavor."
      : "") +
    "\n";
  if (priorSummary) block += "Prior topics summary: " + priorSummary + "\n";
  block +=
    "--- END PROFILE MEMORY ---\n\n" +
    "Use PROFILE MEMORY when it bears on this question, so you do not repeat basics already established. Do not invent earlier discussions that are not recorded here or in the conversation. Do not recap the previous reply. Call update_profile_memory when they share new themes or goals.\n\n";

  return block;
}

/**
 * Compose full system content from all layers (for chat endpoint).
 * @param {object} runtime - Same shape as buildRuntimeContext options
 * @returns {string} Full system message content
 */
function section(label, text) {
  return "=== " + label + " ===\n" + text;
}

function omittedAssistantTurn(content) {
  const text = content == null ? "" : String(content);
  const lower = text.toLowerCase();
  const isAskingForBirthData =
    lower.includes("birth date") ||
    lower.includes("birth time") ||
    lower.includes("birth location") ||
    lower.includes("provide me with those details");
  const isChecklistFormat =
    text.includes("###") ||
    /\*\*\s*\d+\./.test(text) ||
    text.includes("**1.") ||
    text.includes("**2.") ||
    text.includes("Let's delve") ||
    text.includes("These aspects offer a glimpse") ||
    text.includes("If you have specific questions, feel free to share");
  return isAskingForBirthData || isChecklistFormat;
}

/**
 * System prompt, prior turns, then the current user turn once.
 * history must already exclude the current user message.
 * @param {string} systemContent
 * @param {Array} history
 * @param {string} userContent
 * @returns {Array}
 */
function buildGenerationMessages(systemContent, history, userContent) {
  const messages = [
    {
      role: "system",
      content: systemContent,
    },
  ];
  (history || []).forEach(function (entry) {
    if (!entry) return;
    const content = entry.content == null ? "" : String(entry.content);
    if (entry.role === "assistant" && omittedAssistantTurn(content)) return;
    const msg = { role: entry.role, content: content };
    if (entry.role === "function" && entry.name) msg.name = entry.name;
    if (entry.role === "assistant" && entry.function_call) {
      msg.function_call = entry.function_call;
    }
    messages.push(msg);
  });
  messages.push({
    role: "user",
    content: userContent,
  });
  return messages;
}

function composeSystemContent(runtime) {
  // Order: core, capability and mode constraints, register, active intent,
  // confidence and output shape, source knowledge, then deterministic context.
  // chart-analysis.md replaces the default interpreter only for CHART_ANALYSIS.
  const mode = runtime && runtime.preferredMode;
  const factualTurn = !!(runtime && isFactualQuestion(runtime.question));
  const parts = factualTurn
    ? [
        section("CORE", getSystemRules()),
        section("ACTIVE INTENT", getFactualTurnRules()),
        section("DETERMINISTIC CONTEXT", buildRuntimeContext(runtime)),
      ]
    :
    runtime && runtime.thesisMode
      ? [
          section("CORE", getSystemRules()),
          section("ACTIVE INTENT", getThesisTurnRules(mode)),
          section("OUTPUT", getResponseTemplates()),
          section("DETERMINISTIC CONTEXT", buildRuntimeContext(runtime)),
        ]
      : runtime && runtime.topicMode
        ? [
            section("CORE", getSystemRules()),
            section("ACTIVE INTENT", getTopicTurnRules(runtime.topic, mode)),
            section("CONFIDENCE", getConfidenceWordingRules()),
            section("OUTPUT", getResponseTemplates()),
            section("DETERMINISTIC CONTEXT", buildRuntimeContext(runtime)),
          ]
        : runtime && runtime.aspectMode
          ? [
              section("CORE", getSystemRules()),
              section("ACTIVE INTENT", getAspectTurnRules(mode)),
              section("CONFIDENCE", getConfidenceWordingRules()),
              section("OUTPUT", getResponseTemplates()),
              section("DETERMINISTIC CONTEXT", buildRuntimeContext(runtime)),
            ]
          : runtime && runtime.chartAnalysisMode
            ? [
                section("CORE", getSystemRules()),
                section(
                  "ACTIVE INTENT",
                  getChartAnalysisRules(
                    mode,
                    runtime && runtime.chartAnalysisProgression,
                  ),
                ),
                section("CONFIDENCE", getConfidenceWordingRules()),
                section("OUTPUT", getResponseTemplates()),
                section("DETERMINISTIC CONTEXT", buildRuntimeContext(runtime)),
              ]
          : [
            section("CORE", getSystemRules()),
            section("ACTIVE INTENT", getAstrologyInterpreterRules()),
            section("CONFIDENCE", getConfidenceWordingRules()),
            section("OUTPUT", getResponseTemplates()),
            section("DETERMINISTIC CONTEXT", buildRuntimeContext(runtime)),
          ];
  if (isAdvancedPreferred(mode) && !factualTurn) {
    parts.splice(1, 0, section("REGISTER", getAdvancedVoiceRules()));
  }
  if (runtime && runtime.unknownBirthTime) {
    parts.splice(1, 0, section("CAPABILITIES", getUnknownBirthTimeRules()));
  }
  if (runtime && runtime.chartSystem === "traditional") {
    parts.splice(1, 0, section("MODE", getTraditionalChartRules()));
  }
  if (runtime && runtime.predictionMode) {
    parts.splice(1, 0, section("PREDICTION", getPredictionQuestionRules()));
  }
  const sensitivityRules = getSensitivityRules(
    runtime && runtime.sensitivityFlags,
  );
  if (sensitivityRules) {
    parts.splice(1, 0, section("CONSTRAINTS", sensitivityRules));
  }
  const knowledgeBlock = buildAlanLeoKnowledgeBlock(runtime || {});
  if (knowledgeBlock) {
    parts.splice(parts.length - 1, 0, section("SOURCE KNOWLEDGE", knowledgeBlock));
  }
  return parts.join("\n\n");
}

module.exports = {
  getSystemRules,
  getAstrologyInterpreterRules,
  getThesisTurnRules,
  getTopicTurnRules,
  getAspectTurnRules,
  getChartAnalysisRules,
  getAdvancedVoiceRules,
  getUnknownBirthTimeRules,
  getTraditionalChartRules,
  getSensitivityRules,
  getNoPredictionRules,
  getPredictionQuestionRules,
  getConfidenceWordingRules,
  getResponseTemplates,
  buildRuntimeContext,
  buildProfileMemoryBlock,
  buildGenerationMessages,
  composeSystemContent,
};
