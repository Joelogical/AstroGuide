const assert = require("assert");
const { buildChartArchitecture, formatArchitectureForAI } = require("../chart_architecture");
const { chartCapabilities } = require("../chart_capabilities");
const { formatBirthChartForChatGPT } = require("../chatgpt_template");
const { composeSystemContent } = require("../prompt_layers");
const { selectAlanLeoModuleIds, buildAlanLeoKnowledgeBlock } = require("../knowledge/alan-leo/loader");
const { routeChatIntent } = require("../intent_router");
const { getPrioritizedChartPoints } = require("../chart_signals");
const {
  readingConfiguration,
  applyActiveBodyView,
  unavailableBodyReply,
} = require("../reading_configuration");
const { timedChart } = require("./fixtures");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function asteroid(sign, degree, house) {
  return {
    sign: sign,
    degree: degree,
    house: house,
    isRetrograde: false,
    speed: 0.02,
  };
}

function withAsteroids(chart, keys) {
  const next = clone(chart);
  const catalog = {
    chiron: asteroid("Gemini", 72, 3),
    ceres: asteroid("Leo", 135, 5),
    pallas: asteroid("Virgo", 165, 6),
    juno: asteroid("Scorpio", 215, 8),
    vesta: asteroid("Pisces", 350, 12),
  };
  next.asteroids = {};
  keys.forEach(function (key) {
    next.asteroids[key] = catalog[key];
  });
  next.selectedAsteroids = keys.slice();
  next.aspects = (next.aspects || []).concat([
    { planet1: "chiron", planet2: "sun", aspect: "trine", orb: 0.4 },
    { planet1: "juno", planet2: "saturn", aspect: "square", orb: 0.5 },
    { planet1: "ceres", planet2: "pallas", aspect: "sextile", orb: 0.3 },
    { planet1: "vesta", planet2: "juno", aspect: "opposition", orb: 0.6 },
    { planet1: "chiron", planet2: "juno", aspect: "trine", orb: 0.2 },
  ]);
  return next;
}

function scoreMap(arch) {
  const map = {};
  (arch.dominantPlanets || []).forEach(function (item) {
    map[item.planet] = item.score;
  });
  return map;
}

function containsBody(value, name) {
  if (value == null) return false;
  if (typeof value === "string") {
    return value.toLowerCase().split(/[^a-z]+/).indexOf(name) !== -1;
  }
  if (Array.isArray(value)) {
    return value.some(function (item) {
      return containsBody(item, name);
    });
  }
  if (typeof value === "object") {
    return Object.keys(value).some(function (key) {
      return key.toLowerCase() === name || containsBody(value[key], name);
    });
  }
  return false;
}

function activeNames(arch) {
  return Object.keys(arch.asteroidConditions || {}).sort();
}

function test() {
  const modern = timedChart();
  const beginnerArch = buildChartArchitecture(modern);
  const advancedArch = buildChartArchitecture(modern);
  assert.deepEqual(beginnerArch.dominantPlanets, advancedArch.dominantPlanets);
  assert.deepEqual(beginnerArch.planetConditions, advancedArch.planetConditions);
  assert.deepEqual(beginnerArch.aspectsAnnotated, advancedArch.aspectsAnnotated);
  assert.equal(
    readingConfiguration({ chart: modern, register: "beginner" }).framework,
    readingConfiguration({ chart: modern, register: "advanced" }).framework,
  );

  const aquarius = clone(modern);
  aquarius.angles.ascendant.sign = "Aquarius";
  const modernRuler = buildChartArchitecture(aquarius);
  const traditionalAquarius = clone(aquarius);
  traditionalAquarius.chartSystem = "traditional";
  const traditionalRuler = buildChartArchitecture(traditionalAquarius);
  assert.equal(modernRuler.chartRuler.planet, "saturn");
  assert.equal(traditionalRuler.chartRuler.planet, "saturn");

  const traditional = clone(modern);
  traditional.chartSystem = "traditional";
  traditional.selectedAsteroids = ["chiron", "juno"];
  traditional.asteroids = {
    chiron: asteroid("Gemini", 72, 3),
    juno: asteroid("Scorpio", 215, 8),
  };
  const traditionalArch = buildChartArchitecture(traditional);
  ["uranus", "neptune", "pluto", "chiron", "juno"].forEach(function (name) {
    assert.equal(containsBody(traditionalArch, name), false, name);
  });
  assert.equal(traditionalArch.chartRuler.planet, "saturn");
  assert.deepEqual(chartCapabilities(traditionalArch).activeAsteroids, []);
  const traditionalConfig = readingConfiguration({
    chart: traditional,
    register: "advanced",
  });
  assert.equal(traditionalConfig.framework, "traditional");
  assert.equal(traditionalConfig.register, "advanced");
  assert.deepEqual(traditionalConfig.activeAsteroids, []);
  assert.equal(traditionalConfig.allowOuterPlanets, false);

  const bare = buildChartArchitecture(modern);
  const crowded = buildChartArchitecture(
    withAsteroids(modern, ["chiron", "ceres", "pallas", "juno", "vesta"]),
  );
  assert.deepEqual(scoreMap(bare), scoreMap(crowded));
  assert.equal(
    (crowded.dominantPlanets || []).some(function (item) {
      return ["chiron", "ceres", "pallas", "juno", "vesta"].indexOf(item.planet) !== -1;
    }),
    false,
  );

  const none = buildChartArchitecture(withAsteroids(modern, []));
  const chironOnly = buildChartArchitecture(withAsteroids(modern, ["chiron"]));
  const two = buildChartArchitecture(withAsteroids(modern, ["chiron", "juno"]));
  const all = buildChartArchitecture(
    withAsteroids(modern, ["chiron", "ceres", "pallas", "juno", "vesta"]),
  );
  assert.deepEqual(activeNames(none), []);
  assert.deepEqual(activeNames(chironOnly), ["chiron"]);
  assert.deepEqual(activeNames(two), ["chiron", "juno"]);
  assert.deepEqual(activeNames(all), ["ceres", "chiron", "juno", "pallas", "vesta"]);
  assert.equal(containsBody(chironOnly, "juno"), false);
  assert.equal(formatArchitectureForAI(chironOnly).indexOf("Juno"), -1);
  assert.equal(
    formatBirthChartForChatGPT(applyActiveBodyView(withAsteroids(modern, ["chiron"]))).indexOf(
      "Juno",
    ),
    -1,
  );
  const storedButDisabled = withAsteroids(modern, ["chiron", "juno"]);
  storedButDisabled.selectedAsteroids = ["chiron"];
  const filtered = buildChartArchitecture(storedButDisabled);
  assert.deepEqual(activeNames(filtered), ["chiron"]);
  assert.equal(containsBody(filtered, "juno"), false);

  const unknown = withAsteroids(modern, ["chiron", "juno"]);
  unknown.unknownBirthTime = true;
  const unknownConfig = readingConfiguration({
    chart: unknown,
    register: "advanced",
  });
  assert.equal(unknownConfig.register, "advanced");
  assert.equal(unknownConfig.framework, "modern");
  assert.equal(unknownConfig.canUseHouses, false);
  assert.equal(unknownConfig.canUseAscendant, false);
  assert.equal(unknownConfig.canUseMC, false);
  assert.deepEqual(unknownConfig.activeAsteroids, ["chiron", "juno"]);
  const unknownArch = buildChartArchitecture(unknown);
  assert.equal(unknownArch.chartRuler, null);
  assert.equal(unknownArch.angleAspects.length, 0);
  assert.deepEqual(activeNames(unknownArch), ["chiron", "juno"]);
  assert.ok(unknownArch.planetConditions.saturn);
  const prioritized = getPrioritizedChartPoints(unknown, "tell me about my chart");
  assert.equal(prioritized.prioritizedBlock.indexOf("Midheaven"), -1);
  assert.equal(prioritized.prioritizedBlock.indexOf("Ascendant"), -1);

  assert.equal(
    unavailableBodyReply("Where is Pluto?", traditionalConfig).indexOf("traditional seven") > -1,
    true,
  );
  const modernConfig = readingConfiguration({
    chart: withAsteroids(modern, ["chiron"]),
    register: "beginner",
  });
  assert.equal(
    unavailableBodyReply("Where is Juno?", modernConfig),
    "Juno isn't included in this chart configuration.",
  );
  assert.equal(unavailableBodyReply("Where is Chiron?", modernConfig), null);
  assert.equal(
    readingConfiguration({
      chart: withAsteroids(modern, ["juno"]),
      register: "advanced",
    }).register,
    "advanced",
  );

  const chartAsk = routeChatIntent({ message: "Tell me about my chart", history: [] });
  const selfAsk = routeChatIntent({ message: "Tell me about myself", history: [] });
  assert.equal(chartAsk.primaryIntent, "CHART_ANALYSIS");
  assert.equal(selfAsk.primaryIntent, "PERSONAL_SYNTHESIS");
  assert.deepEqual(
    buildChartArchitecture(modern).planetConditions,
    buildChartArchitecture(modern).planetConditions,
  );

  const facts = "--- CHART FACTS ---\nSun in Capricorn at 15°.";
  const beginnerPrompt = composeSystemContent({
    preferredMode: "beginner",
    question: "Tell me about my chart",
    chartAnalysisMode: true,
    chartFactsOnly: facts,
    readingConfig: readingConfiguration({ chart: modern, register: "beginner" }),
  });
  const advancedPrompt = composeSystemContent({
    preferredMode: "advanced",
    question: "Tell me about my chart",
    chartAnalysisMode: true,
    chartFactsOnly: facts,
    readingConfig: readingConfiguration({ chart: modern, register: "advanced" }),
  });
  assert.ok(beginnerPrompt.indexOf(facts) > 0);
  assert.ok(advancedPrompt.indexOf(facts) > 0);
  assert.ok(advancedPrompt.indexOf("=== REGISTER ===") > 0);
  assert.equal(beginnerPrompt.indexOf("=== REGISTER ==="), -1);
  assert.ok(beginnerPrompt.indexOf("Active asteroids: none") > 0);
  assert.ok(advancedPrompt.indexOf("Active asteroids: none") > 0);

  const traditionalPrompt = composeSystemContent({
    preferredMode: "beginner",
    question: "Tell me about my chart",
    chartAnalysisMode: true,
    chartSystem: "traditional",
    chartFactsOnly: "--- CHART FACTS ---\nSaturn in Capricorn.",
    readingConfig: traditionalConfig,
  });
  assert.ok(traditionalPrompt.indexOf("TRADITIONAL CHART SYSTEM") > 0);
  assert.ok(traditionalPrompt.indexOf("Active asteroids: none") > 0);
  assert.equal(traditionalPrompt.indexOf("secondary nuances"), -1);

  const saturnKnowledge = buildAlanLeoKnowledgeBlock({
    question: "Tell me about Saturn",
    preferredMode: "advanced",
    readingConfig: traditionalConfig,
  });
  assert.ok(saturnKnowledge.indexOf("## Saturn") > 0);
  assert.equal(saturnKnowledge.indexOf("## Uranus"), -1);
  assert.deepEqual(
    selectAlanLeoModuleIds({
      question: "Tell me about Uranus",
      preferredMode: "advanced",
      readingConfig: traditionalConfig,
    }),
    [],
  );
  assert.deepEqual(
    selectAlanLeoModuleIds({
      question: "Tell me about Uranus",
      preferredMode: "beginner",
      readingConfig: readingConfiguration({ chart: modern, register: "beginner" }),
    }),
    selectAlanLeoModuleIds({
      question: "Tell me about Uranus",
      preferredMode: "advanced",
      readingConfig: readingConfiguration({ chart: modern, register: "advanced" }),
    }),
  );
}

module.exports = test;
