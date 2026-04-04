/**
 * LLM-generated follow-up prompts: chart-grounded, varied, non-repetitive.
 * The model sets tone and wording; we only constrain format and safety.
 */

const { formatBirthChartForChatGPT } = require("./chatgpt_template");

const MAX_CHART_CHARS = 4200;
const MAX_ASSISTANT_CHARS = 6500;

function buildCompactChartFacts(birthChart) {
  if (!birthChart || typeof birthChart !== "object") return "";
  try {
    const full = formatBirthChartForChatGPT(birthChart);
    return full.length > MAX_CHART_CHARS
      ? full.slice(0, MAX_CHART_CHARS) + "\n[...truncated]"
      : full;
  } catch (e) {
    return "";
  }
}

function summarizeChartSummary(chartSummary) {
  if (!chartSummary || typeof chartSummary !== "object") return "";
  const keys = [
    "personalitySummary",
    "emotionalStyle",
    "relationshipStyle",
    "workStyle",
    "recurringLifeThemes",
    "blindSpots",
  ];
  const parts = [];
  for (const k of keys) {
    const v = chartSummary[k];
    if (v != null && String(v).trim())
      parts.push(String(v).trim().slice(0, 260));
  }
  return parts.join(" | ");
}

function shouldOfferFollowUps(userMessage, assistantResponse, options = {}) {
  const { isCasual = false } = options;
  if (isCasual) return false;
  const u = String(userMessage || "").toLowerCase().trim();
  const r = String(assistantResponse || "").trim();
  if (r.length < 35) return false;
  if (u.length < 5) return false;
  const thanks =
    /^(thanks|thank you|thx|ty|ok|okay|got it|cool|nice|bye)\b/i;
  if (thanks.test(u)) return false;
  return true;
}

function recentAssistantExcerpts(conversationHistory, max = 4) {
  const msgs = (conversationHistory || []).filter(
    (m) => m && m.role === "assistant" && m.content,
  );
  return msgs.slice(-max).map((m) => String(m.content).slice(0, 280));
}

/**
 * @param {import("openai").default} openai - OpenAI client
 * @param {object} params
 * @returns {Promise<string[]>}
 */
async function generateFollowUpSuggestionsLLM(openai, params) {
  const {
    userMessage,
    assistantResponse,
    birthChart,
    chartSummary,
    conversationHistory,
    isGeneralQuestion = false,
  } = params;

  if (!shouldOfferFollowUps(userMessage, assistantResponse)) {
    return [];
  }

  const chartFacts = buildCompactChartFacts(birthChart);
  const summaryStr = summarizeChartSummary(chartSummary);
  const excerpts = recentAssistantExcerpts(conversationHistory, 4);

  const system = `You write suggested "next step" lines for an astrology chat, in the same spirit as ChatGPT/Claude: short, friendly offers from the assistant that the user can tap to continue.

Output ONLY valid JSON with this exact shape: {"suggestions":["...","...","..."]}
Use exactly 3 or 4 strings in the array.

Each string:
- Is written in FIRST PERSON as the assistant (the AstroGuide helper), as if YOU are offering to continue—NOT as a raw topic label.
- Prefer phrasing like: "If you'd like, I can go deeper into ___" (fill ___ with something specific from their chart or your last reply). Also mix in natural variants so it does not sound copy-pasted, e.g. "I can also unpack ___", "Happy to explore ___ next if that's useful", "We could look at ___ in more detail", "Want me to walk through ___?"
- Each line max ~200 characters; be specific (name a placement, house theme, or pattern when CHART FACTS allow)—avoid vague "tell me more".
- When CHART FACTS are present, anchor most suggestions in THIS native's placements (signs, houses, angles, aspects, stelliums). At least two lines should name something concrete from the chart when facts allow.
- Cover different angles across the list (e.g. inner life vs relationships vs work vs growth)—not four paraphrases of the same idea.
- Do not use imperative "you should". Psychological tone; no fortune-telling.

If the user asked a general astrology question but CHART FACTS exist, include at least one offer that bridges to their own chart in plain language.`;

  const userBlock = [
    chartFacts
      ? `--- NATIVE CHART FACTS ---\n${chartFacts}\n---`
      : "--- NATIVE CHART FACTS: unavailable ---",
    summaryStr
      ? `--- STORED CHART SUMMARY ---\n${summaryStr}\n---`
      : "",
    excerpts.length
      ? `--- RECENT ASSISTANT SNIPPETS (avoid suggesting the same angles again) ---\n${excerpts.map((e, i) => `${i + 1}. ${e}`).join("\n\n")}\n---`
      : "",
    `--- USER MESSAGE ---\n${String(userMessage)}`,
    `--- LATEST ASSISTANT REPLY (primary basis for suggestions) ---\n${String(assistantResponse).slice(0, MAX_ASSISTANT_CHARS)}`,
    isGeneralQuestion
      ? "Context: User message was treated as a general astrology question; still personalize using chart facts when available."
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.85,
      max_tokens: 550,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userBlock },
      ],
    });
    const raw = completion.choices[0].message.content || "{}";
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
      : Array.isArray(parsed.followUpSuggestions)
        ? parsed.followUpSuggestions
        : [];
    const cleaned = arr
      .map((s) => String(s || "").trim().replace(/\s+/g, " "))
      .filter((s) => s.length > 15 && s.length <= 260);
    const seen = new Set();
    const uniq = [];
    for (const s of cleaned) {
      const k = s.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        uniq.push(s);
      }
    }
    return uniq.slice(0, 4);
  } catch (err) {
    console.warn("[followup_suggestions] LLM error:", err.message);
    return [];
  }
}

module.exports = {
  generateFollowUpSuggestionsLLM,
  shouldOfferFollowUps,
  buildCompactChartFacts,
};
