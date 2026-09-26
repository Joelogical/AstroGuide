/**
 * LLM-generated follow-up prompts: chart-grounded, varied, non-repetitive.
 * The model sets tone and wording; we only constrain format and safety.
 */

const { formatBirthChartForChatGPT } = require("./chatgpt_template");
const { ensureArchitecture } = require("./chart_architecture");

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

function claimsFromChart(birthChart) {
  try {
    const arch = ensureArchitecture(birthChart);
    return arch && arch.ok && Array.isArray(arch.thesisClaims)
      ? arch.thesisClaims
      : [];
  } catch (e) {
    return [];
  }
}

function chipsTooSimilar(a, b) {
  const na = String(a || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");
  const nb = String(b || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");
  const startA = na.slice(0, 28);
  const startB = nb.slice(0, 28);
  if (startA && startA === startB) return true;
  const stop = {
    if: 1,
    youd: 1,
    like: 1,
    i: 1,
    can: 1,
    also: 1,
    into: 1,
    how: 1,
    the: 1,
    a: 1,
    to: 1,
    and: 1,
    my: 1,
    your: 1,
    of: 1,
    in: 1,
    with: 1,
  };
  function toks(s) {
    return new Set(
      s.split(/\s+/).filter(function (w) {
        return w.length > 2 && !stop[w];
      }),
    );
  }
  const A = toks(na);
  const B = toks(nb);
  if (!A.size || !B.size) return false;
  let inter = 0;
  A.forEach(function (w) {
    if (B.has(w)) inter += 1;
  });
  return inter / Math.min(A.size, B.size) >= 0.55;
}

function recentAssistantExcerpts(conversationHistory, max = 4) {
  const msgs = (conversationHistory || []).filter(
    (m) => m && m.role === "assistant" && m.content,
  );
  return msgs.slice(-max).map((m) => String(m.content).slice(0, 280));
}

const recentChipMemory = [];

function rememberChips(chips) {
  (chips || []).forEach(function (c) {
    const t = String(c || "").trim();
    if (t) recentChipMemory.push(t);
  });
  while (recentChipMemory.length > 16) recentChipMemory.shift();
}

function recentInviteLines(conversationHistory) {
  return (conversationHistory || [])
    .filter(function (m) {
      return m && m.role === "user" && m.content;
    })
    .map(function (m) {
      return String(m.content).trim();
    })
    .filter(function (s) {
      return (
        s.length > 12 &&
        s.length < 220 &&
        (/[?]/.test(s) ||
          /if you'?d like|want to|should we|would you|curious to|up for/i.test(
            s,
          ))
      );
    })
    .slice(-8);
}

function openerKey(s) {
  const t = String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  return t.split(/\s+/).slice(0, 4).join(" ");
}

function looksLikeQuestion(s) {
  return (
    /[?]/.test(s) ||
    /^(want |should we|would you|do you want|shall we|curious |up for |if you)/i.test(
      s,
    )
  );
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
    lastMode = "",
  } = params;

  if (!shouldOfferFollowUps(userMessage, assistantResponse)) {
    return [];
  }

  const chartFacts = buildCompactChartFacts(birthChart);
  const summaryStr = summarizeChartSummary(chartSummary);
  const excerpts = recentAssistantExcerpts(conversationHistory, 4);
  const claims = claimsFromChart(birthChart);
  const modeNote =
    lastMode === "portrait"
      ? "Last reply was a portrait. Ask if they want to talk about one concrete thread already in that reply."
      : lastMode === "topic"
        ? "Last reply stayed in one life area. Ask if they want one more turn there."
        : lastMode === "aspect"
          ? "Last reply was one clicked connection. Ask if they want to stay with that thread. No other pairs."
          : lastMode === "chart"
            ? "Last reply walked the chart. Ask if they want one lived-life thread, not more placements."
            : "";

  const banned = recentInviteLines(conversationHistory).concat(recentChipMemory);
  const bannedOpeners = [];
  const seenOpen = {};
  banned.forEach(function (line) {
    const k = openerKey(line);
    if (k && !seenOpen[k]) {
      seenOpen[k] = true;
      bannedOpeners.push(k);
    }
  });

  const system = `You write tap-to-continue QUESTIONS for an astrology chat. You are asking the person whether they want to talk about something next.

Output ONLY valid JSON: {"suggestions":["..."]}
One question, or two if they invite truly different threads. Never more than 2.

Each line:
- Is a question (use a question mark).
- Asks if they want to talk about X — an invitation, not a diagnosis and not a statement.
- "I" is you, the helper. Their life is "you" / "your". Never "my".
- Fluid and improvised. Change the opener every time. Do not reuse a banned opener or a banned line.
- Possible shapes (invent others; do not cycle these in order): "Want to talk about…?", "Should we stay with…?", "Would you like to look at…?", "Curious to go into…?", "If you want, we could…?", "Up for the part about…?"
- Pick a concrete detail from the last reply. Short. Max ~160 characters.
- At least one question stays in ordinary life language.
- You MAY offer one technical invitation (a planet, house, or aspect) if it fits, in helper voice: e.g. "Want to look at your Saturn?" Do not make both chips technical.
- Not therapy-speak: avoid "impacts", "your tendency", "emotional safety", "cycles of effort", "unpack".
- No "you should". No fortune-telling.

If you only have one good question, return one.`;

  const userBlock = [
    claims.length
      ? `--- INTERNAL CLAIMS (through-line; write questions from these, do not quote them) ---\n${claims.map((c, i) => i + 1 + ". " + c).join("\n")}\n---`
      : "",
    chartFacts
      ? `--- NATIVE CHART FACTS (background only; do not name placements) ---\n${chartFacts}\n---`
      : "--- NATIVE CHART FACTS: unavailable ---",
    summaryStr
      ? `--- STORED CHART SUMMARY ---\n${summaryStr}\n---`
      : "",
    modeNote ? `--- LAST TURN ---\n${modeNote}` : "",
    banned.length
      ? `--- BANNED (already used; new opener AND new topic) ---\n${banned
          .slice(-12)
          .map(function (l, i) {
            return i + 1 + ". " + l;
          })
          .join("\n")}\nBanned openers: ${bannedOpeners.join(" | ")}\n---`
      : "",
    excerpts.length
      ? `--- RECENT ASSISTANT SNIPPETS ---\n${excerpts.map((e, i) => `${i + 1}. ${e}`).join("\n\n")}\n---`
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
      temperature: 0.95,
      max_tokens: 280,
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
      .map(function (s) {
        return s.replace(/\b[Mm]y\b/g, "your").replace(/\b[Mm]ine\b/g, "yours");
      })
      .filter((s) => s.length > 12 && s.length <= 180);
    const seen = new Set();
    const uniq = [];
    for (const s of cleaned) {
      const k = s.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        uniq.push(s);
      }
    }
    const jargon =
      /\b(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|ascendant|midheaven|rising|trine|square|sextile|opposition|conjunction|house \d|1st|7th|10th)\b/i;
    const sessionSpeak =
      /your tendency|emotional safety|cycles of effort|\bunpack\b|how (that|this|your) (impacts?|affects?)/i;
    const pool = uniq.filter(function (s) {
      return !jargon.test(s) && !sessionSpeak.test(s) && looksLikeQuestion(s);
    });
    const fresh = [];
    (pool.length ? pool : uniq).forEach(function (s) {
      const against = banned.concat(fresh);
      const stale = against.some(function (old) {
        return chipsTooSimilar(s, old) || openerKey(s) === openerKey(old);
      });
      if (!stale) fresh.push(s);
    });
    const picked = (fresh.length ? fresh : pool.length ? pool : uniq).slice(
      0,
      2,
    );
    if (picked.length === 2 && chipsTooSimilar(picked[0], picked[1])) {
      rememberChips([picked[0]]);
      return [picked[0]];
    }
    rememberChips(picked);
    return picked;
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
