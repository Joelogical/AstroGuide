const assert = require("assert");
const { composeSystemContent } = require("../prompt_layers");
const { readingConfiguration } = require("../reading_configuration");
const { timedChart, traditionalChart } = require("./fixtures");

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
  assert.equal(factual.indexOf("THE ARCHITECTURE IS ALREADY COMPUTED"), -1);
  assert.equal(factual.indexOf("=== REGISTER ==="), -1);
  assert.ok(factual.indexOf("Web pages are supplemental") > 0);
  assert.ok(factual.length < chart.length);

  const beginnerFactual = compose({
    preferredMode: "beginner",
    question: "Where is Saturn?",
  });
  const advancedFactual = compose({
    preferredMode: "advanced",
    question: "What degree is Venus?",
  });
  assert.ok(beginnerFactual.indexOf("Beginner: plain words") > 0);
  assert.ok(advancedFactual.indexOf("Advanced: technical terms") > 0);
  assert.equal(beginnerFactual.indexOf("INTENT: CHART_ANALYSIS"), -1);
  assert.equal(advancedFactual.indexOf("ADVANCED MODE (expert analytical register"), -1);

  const beginnerChart = compose({
    preferredMode: "beginner",
    chartAnalysisMode: true,
    question: "Tell me about my chart",
  });
  assert.ok(beginnerChart.indexOf("BEGINNER CHART_ANALYSIS") > 0);
  assert.equal(beginnerChart.indexOf("=== REGISTER ==="), -1);
  assert.ok(chart.indexOf("ADVANCED CHART_ANALYSIS") > 0);
  assert.ok(chart.indexOf("Do not rescore") > 0);
  assert.ok(chart.indexOf("If this turn supplies a primary focus") > 0);

  const synthesis = compose({
    thesisMode: true,
    chartAnalysisMode: false,
    question: "Tell me about myself",
  });
  assert.ok(synthesis.indexOf("THIS TURN IS A SYNTHESIS OF THE PERSON") > 0);
  assert.equal(synthesis.indexOf("INTENT: CHART_ANALYSIS"), -1);
  assert.equal(synthesis.indexOf("THIS IS A LATER BROAD CHART_ANALYSIS"), -1);

  const placement = compose({
    question: "Tell me about Saturn",
    chartAnalysisMode: false,
    thesisMode: false,
  });
  assert.ok(placement.indexOf("THE ARCHITECTURE IS ALREADY COMPUTED") > 0);
  assert.equal(placement.indexOf("Determine the chart ruler"), -1);
  assert.equal(placement.indexOf("Ceres, Pallas, Juno, and Vesta"), -1);
  assert.ok(placement.toLowerCase().indexOf("do not rescore") > 0);

  const progressed = compose({
    chartAnalysisMode: true,
    chartAnalysisProgression: {
      phase: "breadth",
      id: "rulership_chains",
      directive: "PRIMARY FOCUS: rulership chains.",
    },
  });
  assert.ok(progressed.indexOf("PRIMARY FOCUS: rulership chains.") > 0);
  assert.ok(
    progressed.indexOf("PRIMARY FOCUS: rulership chains.") >
      progressed.indexOf("If this turn supplies a primary focus"),
  );
  assert.equal(progressed.indexOf("Add at least 2–3 NEW lenses"), -1);

  const sharedFacts = "--- CHART FACTS ---\nSaturn in Capricorn at 10°.";
  const beginnerSame = compose({
    preferredMode: "beginner",
    chartAnalysisMode: true,
    chartFactsOnly: sharedFacts,
    readingConfig: readingConfiguration({
      chart: timedChart(),
      register: "beginner",
    }),
  });
  const advancedSame = compose({
    preferredMode: "advanced",
    chartAnalysisMode: true,
    chartFactsOnly: sharedFacts,
    readingConfig: readingConfiguration({
      chart: timedChart(),
      register: "advanced",
    }),
  });
  assert.ok(beginnerSame.indexOf(sharedFacts) > 0);
  assert.ok(advancedSame.indexOf(sharedFacts) > 0);
  assert.ok(advancedSame.indexOf("=== REGISTER ===") > 0);
  assert.equal(beginnerSame.indexOf("=== REGISTER ==="), -1);

  const traditionalBodies = compose({
    chartAnalysisMode: true,
    chartSystem: "traditional",
    chartFactsOnly: "--- CHART FACTS ---\nSaturn in Capricorn.",
    readingConfig: readingConfiguration({
      chart: traditionalChart(),
      register: "advanced",
    }),
  });
  assert.equal(traditionalBodies.indexOf("Uranus:"), -1);
  assert.ok(traditionalBodies.indexOf("not in this chart") > 0);
  assert.ok(traditionalBodies.indexOf("Active asteroids: none") > 0);
  assert.equal(traditionalBodies.indexOf("If asteroid data exists"), -1);

  const chironOnly = Object.assign({}, timedChart(), {
    selectedAsteroids: ["chiron"],
  });
  const disabledAsteroids = compose({
    chartAnalysisMode: true,
    chartFactsOnly: "--- CHART FACTS ---\nChiron in Gemini.",
    readingConfig: readingConfiguration({
      chart: chironOnly,
      register: "advanced",
    }),
  });
  assert.ok(disabledAsteroids.indexOf("Active asteroids: Chiron") > 0);
  assert.equal(disabledAsteroids.indexOf("Juno"), -1);
  assert.equal(disabledAsteroids.indexOf("If asteroid data exists"), -1);

  const selected = Object.assign({}, timedChart(), {
    selectedAsteroids: ["chiron", "juno"],
  });
  const selectedPrompt = compose({
    chartAnalysisMode: true,
    chartFactsOnly: "--- CHART FACTS ---\nChiron in Gemini. Juno in Scorpio.",
    readingConfig: readingConfiguration({
      chart: selected,
      register: "advanced",
    }),
  });
  assert.ok(selectedPrompt.indexOf("Active asteroids: Chiron, Juno") > 0);
  assert.equal(factual.indexOf("# Alan Leo"), -1);
  assert.ok(chart.indexOf("=== SOURCE KNOWLEDGE ===") > 0);
  assert.ok(chart.indexOf("Web pages are supplemental") > 0);
}

module.exports = test;
