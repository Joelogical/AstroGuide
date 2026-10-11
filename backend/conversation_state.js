/**
 * Profile routing record for the active chart subject.
 * Built from routeChatIntent. Not model prose.
 * chartKey binds the record to the birth chart in the request.
 * coverage lists dimension ids assigned for that subject. It is replaced
 * when the subject changes and dropped when the chart key does not match.
 * Keep chartKeyFromChart in sync with the copy in frontend/index.html.
 */

const { parseClickedAspect } = require("./chart_architecture");
const { routeChatIntent } = require("./intent_router");
const { sanitizeCoverage, subjectKeyFromState } = require("./interpretive_depth");

const SUPPORTED_INTENTS = {
  ASPECT: true,
  PLACEMENT: true,
  CHART_ANALYSIS: true,
};

function identityPart(value) {
  if (value == null) return "";
  const text = String(value).trim();
  if (!text) return "";
  const number = Number(text);
  if (Number.isFinite(number)) return String(number);
  return text;
}

function chartKeyFromChart(chart) {
  if (!chart || typeof chart !== "object") return "";
  const birth =
    chart.birthData && typeof chart.birthData === "object" ? chart.birthData : {};
  const location =
    birth.location && typeof birth.location === "object" ? birth.location : {};
  const system =
    String(chart.chartSystem || "modern").toLowerCase() === "traditional"
      ? "traditional"
      : "modern";
  const unknown =
    chart.unknownBirthTime || birth.unknownBirthTime ? "unknown-time" : "known-time";
  return [
    system,
    unknown,
    identityPart(birth.date),
    identityPart(birth.time),
    identityPart(location.latitude),
    identityPart(location.longitude),
    identityPart(location.timezone),
  ].join("|");
}

function aspectRecord(clicked) {
  if (!clicked) return null;
  return {
    planet1: clicked.planet1,
    aspect: clicked.aspect,
    planet2: clicked.planet2,
  };
}

function sameAspect(left, right) {
  if (!left || !right) return false;
  return (
    left.planet1 === right.planet1 &&
    left.aspect === right.aspect &&
    left.planet2 === right.planet2
  );
}

function withCoverage(state, raw, chart) {
  if (!raw || raw.coverage == null) return state;
  const coverage = sanitizeCoverage(raw.coverage, state, chart);
  if (!coverage) return state;
  return {
    subject: state.subject,
    intent: state.intent,
    aspect: state.aspect,
    chartKey: state.chartKey,
    coverage: coverage,
  };
}

function validateConversationState(raw, chart) {
  if (raw == null) return null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const chartKey = chartKeyFromChart(chart);
  if (!chartKey || raw.chartKey !== chartKey) return null;
  const subject = typeof raw.subject === "string" ? raw.subject.trim() : "";
  if (!subject || subject.length > 500) return null;
  if (!SUPPORTED_INTENTS[raw.intent]) return null;
  const routed = routeChatIntent({ message: subject, history: [] });
  if (!routed || routed.primaryIntent !== raw.intent) return null;
  if (raw.intent === "ASPECT") {
    const parsed = aspectRecord(parseClickedAspect(subject));
    if (!parsed || !sameAspect(raw.aspect, parsed)) return null;
    return withCoverage(
      {
        subject: subject,
        intent: "ASPECT",
        aspect: parsed,
        chartKey: chartKey,
      },
      raw,
      chart,
    );
  }
  if (raw.aspect != null) return null;
  return withCoverage(
    {
      subject: subject,
      intent: raw.intent,
      aspect: null,
      chartKey: chartKey,
    },
    raw,
    chart,
  );
}

function conversationStateFromRoute(route, chart) {
  if (!route || !SUPPORTED_INTENTS[route.primaryIntent]) return null;
  const subject = String(route.questionForMode || "").trim();
  if (!subject || subject.length > 500) return null;
  const chartKey = chartKeyFromChart(chart);
  if (!chartKey) return null;
  const checked = routeChatIntent({ message: subject, history: [] });
  if (!checked || checked.primaryIntent !== route.primaryIntent) return null;
  if (route.primaryIntent === "ASPECT") {
    const aspect = aspectRecord(checked.clickedAspect);
    if (!aspect) return null;
    return {
      subject: subject,
      intent: "ASPECT",
      aspect: aspect,
      chartKey: chartKey,
    };
  }
  return {
    subject: subject,
    intent: route.primaryIntent,
    aspect: null,
    chartKey: chartKey,
  };
}

function cloneCoverage(coverage) {
  return {
    subjectKey: coverage.subjectKey,
    kind: coverage.kind,
    covered: coverage.covered.slice(),
  };
}

function coverageToStore(base, previous, depth) {
  const key = subjectKeyFromState(base);
  if (!key) return null;
  if (
    depth &&
    depth.applicable &&
    depth.coverage &&
    depth.coverage.subjectKey === key &&
    Array.isArray(depth.coverage.covered)
  ) {
    return cloneCoverage(depth.coverage);
  }
  if (depth && depth.applicable === false) return null;
  if (!previous || !previous.coverage || previous.coverage.subjectKey !== key) {
    return null;
  }
  if (!Array.isArray(previous.coverage.covered)) return null;
  return cloneCoverage(previous.coverage);
}

function nextConversationState(route, chart, previous, depth) {
  const base = conversationStateFromRoute(route, chart);
  if (!base) return previous || null;
  const coverage = coverageToStore(base, previous, depth);
  if (!coverage) return base;
  return {
    subject: base.subject,
    intent: base.intent,
    aspect: base.aspect,
    chartKey: base.chartKey,
    coverage: coverage,
  };
}

module.exports = {
  chartKeyFromChart,
  validateConversationState,
  conversationStateFromRoute,
  nextConversationState,
};
