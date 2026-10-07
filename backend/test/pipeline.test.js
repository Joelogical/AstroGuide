const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { resolveChatReading } = require("../reading_configuration");
const { ensureArchitecture, formatArchitectureForAI } = require("../chart_architecture");
const {
  selectChartAnalysisFocus,
  continuesEstablishedChartAnalysis,
} = require("../chart_analysis");
const { formatBirthChartForChatGPT } = require("../chatgpt_template");
const { composeSystemContent } = require("../prompt_layers");
const { selectAlanLeoModuleIds } = require("../knowledge/alan-leo/loader");
const { routeChatIntent } = require("../intent_router");
const { timedChart } = require("./fixtures");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const SUPPORTED = ["chiron", "ceres", "pallas", "juno", "vesta"];

function asteroid(sign, degree, house) {
  return { sign: sign, degree: degree, house: house, isRetrograde: false, speed: 0.02 };
}

function chartWithSelection(keys) {
  const chart = timedChart();
  chart.asteroids = {};
  SUPPORTED.forEach(function (key, index) {
    chart.asteroids[key] = asteroid(
      ["Gemini", "Leo", "Virgo", "Scorpio", "Pisces"][index],
      70 + index * 30,
      3 + index,
    );
  });
  chart.selectedAsteroids = keys.slice();
  chart.aspects = chart.aspects.concat([
    { planet1: "chiron", planet2: "sun", aspect: "trine", orb: 0.4 },
    { planet1: "juno", planet2: "saturn", aspect: "square", orb: 0.5 },
    { planet1: "ceres", planet2: "pallas", aspect: "sextile", orb: 0.3 },
  ]);
  return chart;
}

function frontendPayload(chart, options) {
  const settings = options || {};
  return {
    message: settings.message || "Tell me about my chart",
    birthChart: Object.assign({}, clone(chart), {
      chartSystem: settings.chartSystem || "modern",
    }),
    chartSystem: settings.chartSystem || "modern",
    profileMemory: { preferredMode: settings.register || "beginner" },
    conversationHistory: settings.history || [],
  };
}

function elementTotal(arch) {
  const dist = arch.elements.distribution;
  return dist.Fire + dist.Earth + dist.Air + dist.Water;
}

function assembledPrompt(payload) {
  const reading = resolveChatReading(clone(payload));
  const arch = ensureArchitecture(reading.readingChart);
  const route = routeChatIntent({
    message: payload.message,
    history: payload.conversationHistory,
  });
  return {
    reading: reading,
    arch: arch,
    route: route,
    prompt: composeSystemContent({
      preferredMode: reading.readingConfig.register,
      question: payload.message,
      chartAnalysisMode: route.chartAnalysisMode,
      thesisMode: route.thesisMode,
      chartSystem: reading.chartSystem,
      chartFactsOnly: formatBirthChartForChatGPT(reading.readingChart),
      architectureBlock: formatArchitectureForAI(arch),
      readingConfig: reading.readingConfig,
      unknownBirthTime: reading.readingConfig.unknownBirthTime,
      structures: { planets: (arch.dominantPlanets || []).map(function (item) { return item.planet; }) },
    }),
  };
}

function test() {
  const serverSrc = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
  assert.ok(serverSrc.indexOf("resolveChatReading(") !== -1);

  const stored = chartWithSelection(["chiron", "juno"]);
  const beginner = assembledPrompt(frontendPayload(stored, { register: "beginner" }));
  const advanced = assembledPrompt(frontendPayload(stored, { register: "advanced" }));
  assert.equal(beginner.reading.readingConfig.register, "beginner");
  assert.equal(advanced.reading.readingConfig.register, "advanced");
  assert.deepEqual(beginner.arch.planetConditions, advanced.arch.planetConditions);
  assert.deepEqual(beginner.arch.dominantPlanets, advanced.arch.dominantPlanets);
  assert.deepEqual(beginner.arch.aspectsAnnotated, advanced.arch.aspectsAnnotated);
  assert.deepEqual(beginner.reading.readingConfig.activeAsteroids, ["chiron", "juno"]);
  assert.deepEqual(advanced.reading.readingConfig.activeAsteroids, ["chiron", "juno"]);
  assert.equal(beginner.arch.planetConditions.uranus.sign, "Aquarius");
  assert.ok(advanced.prompt.indexOf("=== REGISTER ===") > 0);
  assert.equal(beginner.prompt.indexOf("=== REGISTER ==="), -1);
  assert.ok(beginner.prompt.indexOf("Chiron") > 0);
  assert.ok(beginner.prompt.indexOf("Juno") > 0);
  assert.ok(advanced.prompt.indexOf("Juno") > 0);
  assert.deepEqual(
    selectAlanLeoModuleIds({
      question: "Tell me about my chart",
      chartAnalysisMode: true,
      preferredMode: "beginner",
      readingConfig: beginner.reading.readingConfig,
    }),
    selectAlanLeoModuleIds({
      question: "Tell me about my chart",
      chartAnalysisMode: true,
      preferredMode: "advanced",
      readingConfig: advanced.reading.readingConfig,
    }),
  );

  const modern = assembledPrompt(frontendPayload(chartWithSelection([]), { chartSystem: "modern" }));
  const traditionalPayload = frontendPayload(chartWithSelection(["chiron", "juno"]), {
    chartSystem: "traditional",
    register: "advanced",
  });
  assert.ok(traditionalPayload.birthChart.planets.uranus);
  const traditional = assembledPrompt(traditionalPayload);
  assert.equal(traditional.reading.readingConfig.framework, "traditional");
  assert.equal(traditional.reading.readingConfig.register, "advanced");
  assert.deepEqual(traditional.reading.readingConfig.activeAsteroids, []);
  assert.equal(traditional.reading.readingChart.planets.uranus, undefined);
  assert.equal(traditionalPayload.birthChart.planets.uranus.sign, "Aquarius");
  assert.equal(elementTotal(traditional.arch), 7);
  assert.equal(elementTotal(modern.arch), 10);
  assert.equal(traditional.prompt.indexOf("Uranus:"), -1);
  assert.equal(traditional.prompt.indexOf("Chiron:"), -1);
  assert.ok(traditional.prompt.indexOf("TRADITIONAL CHART SYSTEM") > 0);
  const focus = selectChartAnalysisFocus(traditional.arch, [
    { role: "user", content: "Tell me about my chart" },
    { role: "assistant", content: "Saturn in Capricorn organizes the classical planets through rulership and the lights. The Sun and Moon oppose one another. Mars squares that opposition and gives the figure a T-square." },
  ]);
  const focusText = JSON.stringify(focus);
  assert.equal(/uranus|neptune|pluto|chiron|juno/i.test(focusText), false);

  const chiron = assembledPrompt(frontendPayload(chartWithSelection(["chiron"])));
  const several = assembledPrompt(frontendPayload(chartWithSelection(["chiron", "juno"])));
  const all = assembledPrompt(frontendPayload(chartWithSelection(SUPPORTED)));
  assert.deepEqual(Object.keys(chiron.arch.asteroidConditions), ["chiron"]);
  assert.deepEqual(Object.keys(several.arch.asteroidConditions).sort(), ["chiron", "juno"]);
  assert.deepEqual(Object.keys(all.arch.asteroidConditions).sort(), SUPPORTED.slice().sort());
  assert.equal(chiron.prompt.indexOf("Juno:"), -1);
  assert.equal(modern.reading.readingConfig.framework, several.reading.readingConfig.framework);
  assert.equal(chiron.reading.readingConfig.register, "beginner");

  const self = routeChatIntent({ message: "Tell me about myself", history: [] });
  const chartAsk = routeChatIntent({ message: "Tell me about my chart", history: [] });
  assert.equal(self.primaryIntent, "PERSONAL_SYNTHESIS");
  assert.equal(chartAsk.primaryIntent, "CHART_ANALYSIS");
  const selfReading = resolveChatReading(frontendPayload(stored, { message: "Tell me about myself" }));
  const chartReading = resolveChatReading(frontendPayload(stored, { message: "Tell me about my chart" }));
  assert.deepEqual(selfReading.readingConfig.activeAsteroids, chartReading.readingConfig.activeAsteroids);
  assert.equal(selfReading.readingConfig.framework, chartReading.readingConfig.framework);

  const unknownChart = chartWithSelection(["chiron"]);
  unknownChart.unknownBirthTime = true;
  const unknown = assembledPrompt(frontendPayload(unknownChart, { register: "advanced" }));
  assert.equal(unknown.reading.readingConfig.register, "advanced");
  assert.equal(unknown.reading.readingConfig.canUseHouses, false);
  assert.equal(unknown.reading.readingConfig.canUseAscendant, false);
  assert.equal(unknown.reading.readingConfig.canUseMC, false);
  assert.deepEqual(unknown.reading.readingConfig.activeAsteroids, ["chiron"]);
  assert.equal(unknown.arch.chartRuler, null);
  assert.equal(unknown.arch.angleAspects.length, 0);
  assert.ok(unknown.arch.planetConditions.saturn);
  assert.ok(unknown.arch.asteroidConditions.chiron);
  assert.ok(unknown.prompt.indexOf("=== CAPABILITIES ===") > 0);
  assert.equal(unknown.prompt.indexOf("Juno:"), -1);

  const sequenceChart = timedChart();
  const turn1 = "Tell me about my chart.";
  const turn2 = "Tell me more.";
  const assistant =
    "Saturn in Capricorn organizes the classical planets through rulership and the lights. The Sun and Moon oppose one another. Mars squares that opposition and gives the figure a T-square.";
  const history2 = [
    { role: "user", content: turn1 },
    { role: "assistant", content: assistant },
    { role: "user", content: turn2 },
  ];
  assert.equal(continuesEstablishedChartAnalysis(turn2, [{ role: "user", content: turn2 }]), false);
  assert.equal(continuesEstablishedChartAnalysis("hi", history2), false);
  assert.equal(continuesEstablishedChartAnalysis(turn2, history2), true);

  const routeA = routeChatIntent({ message: turn1, history: [{ role: "user", content: turn1 }] });
  const routeB = routeChatIntent({ message: turn2, history: history2 });
  assert.equal(routeA.primaryIntent, "CHART_ANALYSIS");
  assert.equal(routeA.progressionEligible, true);
  assert.equal(routeB.primaryIntent, "CHART_ANALYSIS");
  assert.equal(routeB.inheritedIntent, true);
  assert.equal(routeB.progressionEligible, true);

  const readingA = resolveChatReading(frontendPayload(sequenceChart, { message: turn1, register: "advanced" }));
  const readingB = resolveChatReading(frontendPayload(sequenceChart, { message: turn2, register: "advanced", history: history2 }));
  assert.equal(readingA.readingConfig.canUseHouses, true);
  assert.equal(readingB.readingConfig.canUseHouses, readingA.readingConfig.canUseHouses);
  assert.equal(readingB.readingConfig.canUseAscendant, readingA.readingConfig.canUseAscendant);
  assert.deepEqual(readingB.readingChart.planets, readingA.readingChart.planets);
  const factsA = formatBirthChartForChatGPT(readingA.readingChart);
  const factsB = formatBirthChartForChatGPT(readingB.readingChart);
  assert.equal(factsA, factsB);
  const archA = ensureArchitecture(readingA.readingChart);
  const archB = ensureArchitecture(readingB.readingChart);
  assert.deepEqual(archA.dominantPlanets, archB.dominantPlanets);
  assert.deepEqual(archA.planetConditions, archB.planetConditions);
  const evidence = formatArchitectureForAI(archA);
  assert.equal(evidence.indexOf("skeleton of the reading"), -1);
  assert.ok(evidence.indexOf("authoritative structural evidence") > 0);
  assert.equal(formatArchitectureForAI(archB), evidence);

  const focusA = selectChartAnalysisFocus(archA, routeA.priorConversation);
  const focusB = selectChartAnalysisFocus(archB, routeB.priorConversation);
  assert.equal(focusA.phase, "overview");
  assert.notEqual(focusB.phase, "overview");
  assert.ok(focusB.phase === "breadth" || focusB.phase === "integration");

  function analysisPrompt(reading, route, focus, facts) {
    return composeSystemContent({
      preferredMode: "advanced",
      question: route.questionForMode,
      chartAnalysisMode: route.chartAnalysisMode,
      thesisMode: route.thesisMode,
      chartSystem: reading.chartSystem,
      chartFactsOnly: facts,
      architectureBlock: formatArchitectureForAI(ensureArchitecture(reading.readingChart)),
      readingConfig: reading.readingConfig,
      unknownBirthTime: reading.readingConfig.unknownBirthTime,
      chartAnalysisProgression: focus,
      structures: {
        planets: (ensureArchitecture(reading.readingChart).dominantPlanets || []).map(function (item) {
          return item.planet;
        }),
      },
    });
  }
  const promptA = analysisPrompt(readingA, routeA, focusA, factsA);
  const promptB = analysisPrompt(readingB, routeB, focusB, factsB);
  assert.ok(promptA.indexOf(factsA) > 0);
  assert.ok(promptB.indexOf(factsB) > 0);
  assert.ok(promptA.indexOf("authoritative structural evidence") > 0);
  assert.ok(promptB.indexOf("authoritative structural evidence") > 0);
  assert.ok(promptA.indexOf("=== ACTIVE BODIES ===") > 0);
  assert.ok(promptB.indexOf("=== ACTIVE BODIES ===") > 0);
  assert.ok(promptA.indexOf("Never ask for birth date") > 0);
  assert.ok(promptB.indexOf("Never ask for birth date") > 0);
  assert.equal(promptA.indexOf("CASUAL MESSAGES"), -1);
  assert.equal(promptB.indexOf("CASUAL MESSAGES"), -1);
  assert.equal(promptA.indexOf("A final synthesis should state"), -1);
  assert.equal(promptB.indexOf("A final synthesis should state"), -1);
  assert.equal(promptA.indexOf("skeleton of the reading"), -1);
  assert.equal(promptB.indexOf("skeleton of the reading"), -1);
  assert.ok(promptA.indexOf("=== REGISTER ===") > 0);
  assert.ok(promptB.indexOf("=== REGISTER ===") > 0);
  assert.ok(promptA.indexOf("highest-ranked organizing structure") > 0);
  assert.ok(promptB.indexOf("THIS IS A LATER BROAD CHART_ANALYSIS") > 0 || promptB.indexOf("THE MAJOR UNEXPLORED STRUCTURES") > 0);
  assert.ok(promptB.indexOf("PRIMARY FOCUS:") > 0);
  assert.ok(promptA.indexOf("Do not rescore") > 0);
  assert.ok(promptB.indexOf("Do not rescore") > 0);
}

module.exports = test;
