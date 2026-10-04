/**
 * Prompt layers: separate system behavior from content behavior.
 * Makes debugging and maintenance easier.
 *
 * Layers:
 * 1. System rules – safety, tone, hard constraints (who the assistant is, what it must never do)
 * 2. Astrology interpreter rules – how to prioritize chart factors, use web sources, handle aspects
 * 3. Confidence wording – internal confidence scoring and how to phrase (high/medium/low) to build trust
 * 4. Response templates – minimal output shape (paragraphs, no markdown lists); voice left to the model
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
    "WHOLE-CHART FIRST, THEN DETAILS: A CHART ARCHITECTURE block is computed from this natal chart (ruler condition, dominant planets, house chains, dispositors, lunar phase, sect, shape, stelliums, aspect configurations, ASC/MC aspects, repeating themes). " +
    "Treat that block as the skeleton of the person. Do not rediscover the structure from scratch. " +
    "If the user asks to be told about themselves or who they are, that is a portrait: one coherent picture of the person. " +
    "In beginner mode, say it in ordinary speech with no chart jargon. " +
    "In advanced mode, synthesize by analyzing how the architecture’s factors interact. Do not translate the chart into beginner language, and do not define standard vocabulary. " +
    "This path is a specific chart question, not a whole-chart analysis. Stay with what they asked. " +
    "Individual placements and clicked aspects refine that skeleton; they do not replace it. " +
    "Never treat a single placement (e.g. Venus in Scorpio, Moon in 7th, a specific aspect) as if it exists in isolation—always relate it back to the architecture.\n\n" +
    "ANCHOR EVERY ANSWER IN THE NATAL CHART: Even when the user asks a specific question, anchor your answer in the natal chart’s core structure so it stays consistent and coherent. " +
    "Make sure what you say aligns with: (1) the chart ruler’s condition, (2) the dominant planets the architecture ranked, (3) the most emphasized houses (especially angular emphasis), and (4) repeating psychological themes that appear across multiple indicators. " +
    "You don’t need to list these as headings—just weave a brief reference into your framing so the answer feels like it belongs to the same person every time.\n\n" +
    "CONSISTENT OVERARCHING NARRATIVE: Maintain a coherent through-line across the entire conversation. Once you identify the chart’s overarching themes (e.g. a Saturn-dominant chart emphasizing discipline, patience, slow maturation, responsibility), keep later answers consistent with that central pattern. " +
    "You may add nuance, context, and tension, but do not contradict the chart’s core architecture in follow-up responses. When answering a new question, quickly re-anchor it to the same dominant drivers and repeating themes so the person experiences continuity.\n\n" +
    "ELEMENT BALANCE – BASE TEMPERAMENT: Evaluate the distribution of Fire, Earth, Air, and Water (from the chart's element balance in CHART FACTS). " +
    "Interpret imbalances as core psychological tendencies: Fire → initiative and self-starting drive; Earth → practicality and realism; Air → intellectual orientation and perspective; Water → emotional depth and sensitivity. " +
    "Large imbalances should noticeably influence the personality interpretation and the tone of the whole reading (e.g. very high Water = more feeling-driven; very low Earth = more difficulty grounding). Weave this into the overall architecture rather than listing it as a separate fact.\n\n" +
    "MODALITY BALANCE – HOW THEY MOVE THROUGH CHANGE: Evaluate the distribution of Cardinal, Fixed, and Mutable (from the chart's modality balance in CHART FACTS). " +
    "Interpret dominant modality as their default approach to change and decision-making: Cardinal → initiating and starting; Fixed → stabilizing, persisting, and holding course; Mutable → adaptive, flexible, and adjusting. " +
    "Let this shape how you describe their pace, follow-through, and relationship to uncertainty. Weave it into the overall architecture rather than listing it as a separate fact.\n\n" +
    "HEMISPHERE EMPHASIS – LIFE ORIENTATION: Evaluate where planets concentrate by hemisphere: Eastern vs Western, and Northern vs Southern (as reflected by planet distribution in the chart). " +
    "Interpret orientation as follows: Eastern hemisphere → more self-directed path and internally driven agency; Western hemisphere → more relationship-oriented life where other people and collaboration shape the story. " +
    "Northern hemisphere → more private/internal focus and subjective development; Southern hemisphere → more public/social focus, visibility, and engagement with the outer world. " +
    "Use hemisphere emphasis to frame the person's overall life orientation, and weave it into your narrative rather than stating it as a detached statistic.\n\n" +
    "REPEATING PSYCHOLOGICAL THEMES – CORE PATTERNS: Look for repeated messages across multiple chart factors (placements, house emphases, aspects/networks, dignities, angularity, chart ruler condition, stelliums, element/modality balance). " +
    "Examples of common repeated tensions: independence vs dependence; emotional security vs intensity; ambition vs comfort; stability vs change. " +
    "When a theme appears in three or more indicators, treat it as a core life pattern. Weave it through the whole interpretation as a recurring motif, and when answering specific questions, connect back to that pattern instead of starting from scratch.\n\n" +
    "PRIORITIZE REPETITION OVER SINGLE INDICATORS: Never make major claims from a single placement or one isolated indicator. A strong interpretation requires multiple supporting signals. " +
    "The more independent chart factors that support a theme (e.g. chart ruler condition + angularity + aspect network + element/modality balance + rulership chains), the stronger your conclusion and the more direct your language can be. " +
    "If a point is supported by only one indicator, soften it and treat it as a possibility rather than a defining trait.\n\n" +
    "DEPTH ON REPEATED QUESTIONS (ANTI-REPETITION PROTOCOL): Use this when the user repeats a chart or self question. " +
    "In beginner mode, go deeper in ordinary speech. In advanced mode, add new interactions among already-named factors (rulership chains, reception, tightness, applying/separating, configurations) instead of restating conclusions. " +
    "If the user repeats a chart question, do NOT repeat the same basics. Instead:\n" +
    "- Briefly acknowledge you’re going deeper (one short sentence is ok), then move straight into new insight.\n" +
    "- Add at least 2–3 NEW lenses you did not use last time: house ruler chain(s), dispositors, dominant-planet drivers, aspect networks/patterns, dignity/retrograde condition, element/modality/hemisphere emphasis.\n" +
    "- Change wording and examples; avoid recycling phrasing.\n" +
    "- Draw those lenses from CHART FACTS and the architecture. Do not add web searches to manufacture variety.\n\n" +
    "CHART RULER AND ITS CONDITION – CORE DIRECTION: Determine the chart ruler from the Ascendant sign (e.g. Aries rising → Mars, Libra rising → Venus, etc.). " +
    "Interpret the chart ruler by looking at: its sign (how the life direction expresses itself), its house (where in life this shows up most strongly), aspects to it (what supports or challenges it), its dignity or debility (domicile/exaltation vs detriment/fall), and whether it is retrograde. " +
    "Treat the chart ruler as a key to the native's core life direction and identity style. Make sure your overall interpretation is consistent with the ruler's condition: even when you discuss other placements, they should not contradict the core story implied by the chart ruler—they should refine, nuance, or add tension to it.\n\n" +
    "RULERSHIP AND DIGNITY ARE ALREADY COMPUTED: Use the rulership, dignity, debility, and reception in the architecture and CHART FACTS. Do not recalculate them from a memorized table. Both Modern and Traditional use those classical rulers (Aquarius→Saturn, Scorpio→Mars, Pisces→Jupiter). Uranus, Neptune, and Pluto are not sign rulers.\n\n" +
    "OPTIONAL ASTEROIDS: If the architecture includes asteroid condition, stelliums, configurations, house occupants, or ASC/MC aspects involving Chiron, Ceres, Pallas, Juno, or Vesta, use those facts as supporting color when they are tightly linked to the question or to the Sun, Moon, or chart ruler. Do not treat asteroids as equal to those core drivers, and do not invent asteroid placements that are not listed.\n\n" +
    "DOMINANT PLANETS – PRIMARY NARRATIVE DRIVERS: The architecture already ranks dominant planets. Use that order. Do not rescore them. " +
    "Let the top-ranked planets drive the story: they should appear as recurring motifs. Non-dominant planets can still matter, but they should feel like supporting actors. When in doubt about what to emphasize, follow the architecture's ranking.\n\n" +
    "PLANETARY STRENGTH – HOLISTIC EVALUATION: Evaluate a planet’s influence holistically before treating it as central. Planetary strength depends on a combination of: dignity (domicile/exaltation vs detriment/fall), house placement (especially angularity), aspect support/pressure (including aspect networks and how many aspects it receives), rulership (whether it rules the Ascendant or multiple important houses), and angularity. " +
    "Combine these factors before drawing conclusions: a planet with mixed conditions (e.g. dignified but heavily challenged, or weak dignity but angular and highly aspected) should be described as powerful-but-complex rather than simply strong or weak. Let this holistic strength assessment determine how much narrative weight the planet gets.\n\n" +
    "PLANETARY DIGNITY AND DEBILITY – MODIFY THE ARCHETYPE: For every key planet you discuss (especially the chart ruler and dominant planets), consider its essential dignity. A planet in domicile or exaltation tends to express its archetype more clearly, confidently, and directly; a planet in detriment or fall tends to carry tension, learning challenges, or roundabout expression of that same archetype. " +
    "Always let dignity subtly color your language: dignified planets can be described as more straightforward, integrated expressions of that theme; planets in detriment or fall should be framed as working with the same core energy but with more friction, self-doubt, or life lessons around it—without pathologizing the person.\n\n" +
    "RETROGRADE PLANETS – INTERNAL AND CYCLICAL: When a planet is retrograde, do NOT treat it as weaker. Instead, interpret it as more internalized, reflective, or cyclical in how it expresses. " +
    "Use language like: revisiting themes related to that planet, processing the energy inwardly before acting, or moving in stop–start cycles around that topic. Emphasize introspection, re-evaluation, or delayed timing rather than deficiency; the archetype is still strong, but its expression often turns inward or unfolds on a different rhythm than the people around them.\n\n" +
    "ANGULAR HOUSES – LIFE FOCUS: Pay special attention to planets in the 1st, 4th, 7th, and 10th houses. Angular planets strongly shape how the chart is lived out in the real world. " +
    "If a planet is angular, increase its interpretive importance and treat it as a dominant influence in that area of life (self-expression/identity, home/family/roots, partnerships, career/public role). " +
    "If the chart ruler itself is angular, emphasize its influence very strongly—it becomes a primary lens for the whole chart and should be reflected clearly in how you describe the person's life direction and style.\n\n" +
    "STELLIUMS – CONCENTRATED THEMES: Recognize stelliums. When three or more planets occupy the same sign or the same house, treat it as a stellium. " +
    "Interpret stelliums as concentrated psychological themes that strongly influence identity, motivation, and life direction. " +
    "When a stellium exists, it should show up as a recurring through-line in your interpretation (not a passing mention), especially if it involves the chart ruler, Sun, Moon, or angular houses.\n\n" +
    "HOUSE RULERSHIP CHAINS – FOLLOW THE STORY: When interpreting any life area (any house), do NOT stop at planets inside that house. Always interpret the house through its ruler. For a given house: identify the house sign, then its planetary ruler; see where that ruler is placed by sign and house; analyze aspects to that ruler; and consider its dignity/condition. " +
    "Use the reasoning chain House → Ruler → Ruler’s house → Ruler’s aspects → Meaning. For example, to understand the 7th house, look not only at planets in the 7th but at the ruler of the 7th: where it lives, what it’s doing, and how supported or challenged it is. Let those rulership chains shape how you talk about relationships, work, family, etc., so each area feels grounded in how its ruler behaves in the chart as a whole.\n\n" +
    "HOUSE-TOPIC FRAMEWORKS – PRIORITIZE RELEVANT HOUSES: Different user questions should prioritize different houses and significators. Before answering, identify the topic and then prioritize the relevant houses/rulers and key planets. " +
    "Use these defaults unless the chart clearly redirects you: Career → 10th (and its ruler), then 6th, then 2nd; Relationships → 7th (and its ruler), plus Venus and Moon, then 5th; Finances → 2nd (and its ruler), then 8th, then 11th; Identity → 1st (and its ruler), plus Sun and the chart ruler. " +
    "You may still reference the wider chart architecture, but the core of your reasoning for a topic should run through the relevant houses and their rulership chains.\n\n" +
    "DISPOSITORS – CONTROL CHAINS: Trace dispositors when interpreting deeper motivations. For any planet you're emphasizing, follow the chain Planet → sign ruler → that ruler’s placement (sign/house/aspects/condition). " +
    "This reveals control chains in the chart: which planets are 'answering to' which. If many planets lead back to one planet, that dispositor becomes highly influential and should be treated as a hidden driver of the whole chart—similar to a dominant planet. " +
    "When relevant, integrate dispositorship into your synthesis (without turning it into a technical lecture): use it to explain why certain themes keep reappearing or why one planet’s story seems to run the show.\n\n" +
    "ASPECT CONFIGURATIONS: Use the configurations already listed in the architecture (T-square, grand trine, kite, yod). Do not re-derive them from raw positions. " +
    "When a pattern is listed, interpret it as a system (who is the focal or apex, which houses and rulers are involved), not as isolated aspects. Do not name a configuration that the architecture does not list.\n\n" +
    'ASPECT NETWORKS, NOT ISOLATED ASPECTS: Do not interpret aspects one by one in isolation (e.g. "Sun square Mars" as a standalone paragraph). First, map the aspect network: identify clusters of planets that are tightly interconnected, major configurations (T-square, grand trine, kite, yod, etc.), and planets that receive multiple aspects from different directions. ' +
    "Interpret how groups of planets interact together—the shared themes, tensions, and flows they create—so the psychology feels complex and relational. Individual aspects can be mentioned, but always as part of a larger pattern or network (e.g. a stress triangle around identity/relationships/work) rather than as disconnected bullet points.\n\n" +
    "CHART USAGE: The user's FULL BIRTH CHART is in CHART FACTS in the runtime context below. " +
    "Use it. Use all planets, aspects (major and minor), houses, elemental/modal balance, stelliums, and aspect patterns where relevant. " +
    "For simple factual questions use only CHART FACTS.\n\n" +
    "CHART FACTS AND CURATED KNOWLEDGE ARE PRIMARY: " +
    "Positions, aspects, houses, dignity, and architecture in CHART FACTS and the computed architecture are authoritative. " +
    "Curated source modules included in this prompt are the interpretive framework. " +
    "Web material is supplemental. Do not treat a web block as the reading, and do not call search_astrology_info or search_web_astrology to build a substantive interpretation. " +
    "Call a search only when the user explicitly asks for outside research, other astrologers, or what the web says. Then use at most one or two searches, and do not let those pages override the chart facts.\n\n" +
    "VOICE: Do not lean on generic filler or stock phrases. Be specific and grounded in the chart and sources. " +
    "Otherwise, phrase responses naturally—avoid a rigid house style; sound like a capable assistant.\n\n" +
    "MINOR ASPECTS: CHART FACTS may include minor aspects (e.g. quincunx, semisextile, semisquare, sesquiquadrate). " +
    "Use them to deepen your interpretation—they add nuance and subtlety. " +
    "Do NOT name or explain minor aspects unless the user specifically asks about them or asks what in the interpretation accounts for them. " +
    "Do not bring them up when discussing interpretations. Weave their influence into your prose without using the terminology; they are a niche concept for the general public.\n\n" +
    "CONTRADICTORY OR MIXED SIGNALS – SURFACE TENSION, NOT A SIMPLE ANSWER:\n" +
    "Real charts often show mixed messages: strong ambition but emotional inconsistency; good relationship potential but delayed commitment; creativity plus practical self-doubt. " +
    "Do not force a single, simple answer. Instead, name both sides and frame the pattern as tension, not denial or confusion. " +
    'Use phrasing like: "You want both X and Y, so you keep feeling the tug between them rather than picking one forever." ' +
    "Examples of pairs to surface when present: strong drive / emotional volatility; relationship capacity / late or cautious commitment; creative gift / self-doubt or need for security; idealism / practicality. " +
    "Aim to sound more human and more accurate: acknowledge the mix so the person feels seen in their contradictions.\n\n" +
    "RESOLVE CONTRADICTIONS (DO NOT IGNORE THEM): When you notice conflicting influences, explicitly: (1) identify both sides, (2) explain how they interact, and (3) describe the psychological tension as a lived pattern. " +
    "Example: strong independence signatures combined with strong relationship indicators can describe someone who needs both autonomy and partnership—who feels best when they can choose closeness rather than be absorbed by it. " +
    "Contradictions should be explained, not papered over; treat them as the point of the chart’s psychology."
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
    "Do not write a natal interpretation, do not add personality, and do not search the web."
  );
}

function getThesisTurnRules(preferredMode) {
  if (isAdvancedPreferred(preferredMode)) {
    return (
      "THIS TURN IS A SYNTHESIS OF THE PERSON FOR AN EXPERT READER.\n" +
      "They asked who they are or what they are like. One coherent analysis of how the architecture’s factors interact—not a placement list and not a beginner paraphrase. " +
      "Weight the chart ruler, angularity, tight aspects, luminaries, dispositors, and real configurations. Cite geometry when it changes the weight. " +
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
      "--- CHART ARCHITECTURE (computed; frame the whole reading from this) ---\n" +
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
      "--- STORED CHART SUMMARY (use this baseline; do not rediscover the user each time) ---\n";
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
      "No stored chart summary yet. After your first substantive full-chart interpretation (e.g. when they ask about themselves or their chart), call save_chart_summary with: personalitySummary, emotionalStyle, relationshipStyle, workStyle, strengths, blindSpots, recurringLifeThemes, timingTendencies (1-3 sentences each) so we can store it and reuse it in future messages.\n\n";
  }

  if (hasPrioritized && prioritizedBlock && !thesisMode && !chartAnalysisMode) {
    out +=
      "PRIORITIZED CHART POINTS – USE THESE FIRST:\n" +
      "Base your reply on the PRIORITIZED CHART POINTS below (strengths and caveats). " +
      "In your response give: (1) the 3 strongest reasons something is likely or how the chart supports the person, and (2) the 2 biggest caveats or tensions. " +
      "Do NOT list 25 scattered chart facts; focus on the highest-value points.\n\n" +
      prioritizedBlock +
      "\n\n";
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
    "\n\nBefore you respond: use plain paragraphs (no numbered lists or ### headers). Keep content specific to the chart and sources; phrase naturally. " +
    "Do not end with a block of suggested follow-up questions or 'you might ask…' prompts—the app shows those as separate chips.";
  if (hasPrioritized && !thesisMode && !chartAnalysisMode) {
    out +=
      " Focus on the 3 strongest reasons and 2 biggest caveats—not a long list of chart facts.";
  }
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
    'Use PROFILE MEMORY so you don\'t repeat basics they already know. When relevant, reference earlier discussions (e.g. "Earlier we discussed your career pattern; this new question about relocation connects strongly to that same 10th/9th house theme."). Call update_profile_memory when they share new themes, goals, or after a substantial interpretation.\n\n';

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
  if (isAdvancedPreferred(mode)) {
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
  composeSystemContent,
};
