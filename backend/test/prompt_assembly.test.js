const assert = require("assert");
const { composeSystemContent } = require("../prompt_layers");

function compose(extra) {
  return composeSystemContent(
    Object.assign(
      {
        preferredMode: "advanced",
        question: "Tell me about my chart",
        chartFactsOnly: "--- CHART FACTS ---\nSun in Capricorn at 15°.",
        architectureBlock: "Chart ruler: Saturn.",
      },
      extra || {},
    ),
  );
}

function test() {
  const chart = compose({
    chartAnalysisMode: true,
    chartAnalysisProgression: {
      phase: "overview",
      id: "dominant_overview",
      directive: "",
    },
  });
  assert.ok(chart.indexOf("=== CORE ===") === 0);
  assert.ok(chart.indexOf("=== REGISTER ===") > 0);
  assert.ok(chart.indexOf("=== ACTIVE INTENT ===") > chart.indexOf("=== REGISTER ==="));
  assert.ok(chart.indexOf("INTENT: CHART_ANALYSIS") > 0);
  assert.ok(chart.indexOf("=== SOURCE KNOWLEDGE ===") > 0);
  assert.ok(chart.indexOf("--- CHART FACTS ---") > chart.indexOf("=== SOURCE KNOWLEDGE ==="));
  assert.equal(chart.indexOf("THIS TURN IS A GENERAL CONVERSATION ABOUT THE PERSON"), -1);
  assert.equal(chart.indexOf("THIS TURN IS A SYNTHESIS OF THE PERSON"), -1);
  assert.equal(chart.indexOf("WEB SOURCES ARE PRIMARY"), -1);
  assert.ok(chart.indexOf("=== DETERMINISTIC CONTEXT ===") > chart.indexOf("=== SOURCE KNOWLEDGE ==="));

  const unknown = compose({
    chartAnalysisMode: true,
    unknownBirthTime: true,
    preferredMode: "beginner",
    structures: { houses: true, aspects: false, planets: ["saturn"] },
  });
  assert.ok(unknown.indexOf("=== CAPABILITIES ===") > 0);
  assert.equal(unknown.indexOf("# Alan Leo: Houses and Angles"), -1);
  assert.equal(unknown.indexOf("ADVANCED MODE (expert analytical register"), -1);

  const traditional = compose({
    chartAnalysisMode: true,
    chartSystem: "traditional",
  });
  assert.ok(traditional.indexOf("TRADITIONAL CHART SYSTEM (EXCLUSIVE)") > 0);
  assert.ok(
    traditional.indexOf("=== MODE ===") < traditional.indexOf("=== ACTIVE INTENT ==="),
  );

  const factual = compose({
    question: "What degree is Saturn?",
    chartAnalysisMode: false,
    thesisMode: false,
    topicMode: false,
    aspectMode: false,
  });
  assert.equal(factual.indexOf("INTENT: CHART_ANALYSIS"), -1);
  assert.equal(factual.indexOf("=== SOURCE KNOWLEDGE ==="), -1);
  assert.ok(factual.indexOf("THIS TURN IS A FACTUAL LOOKUP") > 0);
  assert.ok(factual.length < chart.length);
}

module.exports = test;
