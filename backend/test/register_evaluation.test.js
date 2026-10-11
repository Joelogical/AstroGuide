/**
 * Paired register evaluation.
 *
 * Same chart, same questions, beginner and advanced prompts.
 * These checks are prompt-level. They do not call a language model,
 * so they do not demonstrate that generated replies differ.
 */

const assert = require("assert");
const { composeSystemContent } = require("../prompt_layers");
const { resolveChatReading } = require("../reading_configuration");
const {
  ensureArchitecture,
  formatArchitectureForAI,
} = require("../chart_architecture");
const { formatBirthChartForChatGPT } = require("../chatgpt_template");
const { timedChart } = require("./fixtures");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function factsBetween(prompt) {
  const start = prompt.indexOf("--- CHART FACTS");
  const end = prompt.indexOf("--- END CHART FACTS ---");
  assert.ok(start > 0 && end > start);
  return prompt.slice(start, end);
}

function architectureBetween(prompt) {
  const start = prompt.indexOf("--- CHART ARCHITECTURE");
  const end = prompt.indexOf("--- END CHART ARCHITECTURE ---");
  if (start === -1 && end === -1) return "";
  assert.ok(start > 0 && end > start);
  return prompt.slice(start, end);
}

function registerBetween(prompt) {
  const start = prompt.indexOf("=== REGISTER ===");
  const end = prompt.indexOf("=== ACTIVE INTENT ===");
  assert.ok(start > 0 && end > start);
  return prompt.slice(start, end);
}

function pair(extra) {
  const shared = {
    chartFactsOnly: FACTS,
    architectureBlock: ARCHITECTURE,
    sensitivityFlags: extra && extra.sensitivityFlags,
  };
  return {
    beginner: composeSystemContent(
      Object.assign({ preferredMode: "beginner" }, shared, extra || {}),
    ),
    advanced: composeSystemContent(
      Object.assign({ preferredMode: "advanced" }, shared, extra || {}),
    ),
  };
}

function has(text, phrase) {
  return text.indexOf(phrase) !== -1;
}

const chart = clone(timedChart());
const FACTS = formatBirthChartForChatGPT(clone(timedChart()));
const ARCHITECTURE = formatArchitectureForAI(ensureArchitecture(clone(timedChart())));

function assertSameEvidence(name, prompts, extra) {
  assert.equal(
    factsBetween(prompts.beginner),
    factsBetween(prompts.advanced),
    name + ": chart facts diverged",
  );
  assert.equal(
    architectureBetween(prompts.beginner),
    architectureBetween(prompts.advanced),
    name + ": architecture block diverged",
  );
  if (!extra.aspectMode && !extra.topicMode && !extra.thesisMode) {
    assert.ok(architectureBetween(prompts.beginner).length > 0, name + ": architecture missing");
  }
  assert.ok(has(prompts.beginner, "does not forecast"), name + ": beginner prediction guard");
  assert.ok(has(prompts.advanced, "does not forecast"), name + ": advanced prediction guard");
  assert.ok(has(prompts.beginner, "Never ask for birth date"), name + ": beginner birth-data guard");
  assert.ok(has(prompts.advanced, "Never ask for birth date"), name + ": advanced birth-data guard");
}

function assertRegistersDiffer(name, prompts) {
  const beginner = registerBetween(prompts.beginner);
  const advanced = registerBetween(prompts.advanced);
  assert.notEqual(beginner, advanced, name + ": registers are identical");
  assert.ok(has(beginner, "BEGINNER REGISTER"), name + ": beginner heading");
  assert.ok(has(advanced, "ADVANCED MODE (expert analytical register"), name + ": advanced heading");
  assert.ok(!has(beginner, "ADVANCED MODE (expert analytical register"), name);
  assert.ok(!has(advanced, "BEGINNER REGISTER"), name);

  assert.ok(has(beginner, "little or no prior"), name + ": assumed knowledge");
  assert.ok(has(advanced, "Assume familiarity with astrology fundamentals"), name + ": assumed knowledge");
  assert.ok(!has(beginner, "Assume familiarity with astrology fundamentals"), name);

  assert.ok(has(beginner, "short plain gloss"), name + ": beginner explanation style");
  assert.ok(has(beginner, "CONCEPT BEFORE TECHNIQUE"), name + ": conceptual priority");
  assert.ok(has(advanced, "Do not teach that alphabet"), name + ": advanced skips textbook");
  assert.ok(has(advanced, "PRIMARY AND SECONDARY"), name + ": evidence hierarchy");
  assert.ok(
    has(
      advanced,
      "Discuss orbs, rulerships, dignities, dispositors, configurations, and house relationships",
    ),
    name + ": advanced technical scope",
  );
  assert.ok(
    has(beginner, "Skip orbs, dignities, dispositors"),
    name + ": beginner withholds technical inventory",
  );
  assert.ok(!has(beginner, "Discuss orbs, rulerships"), name);

  assert.ok(has(beginner, "Accessible does not mean a shorter"), name + ": beginner length");
  assert.ok(has(advanced, "Do not be automatically longer"), name + ": advanced length");

  assert.ok(has(beginner, "Consider the whole supplied chart"), name + ": beginner holistic");
  assert.ok(has(advanced, "Consider the whole supplied chart"), name + ": advanced holistic");
  assert.ok(has(beginner, "Do not list aspects or placements"), name);
  assert.ok(has(advanced, "not an inventory of aspects or placements"), name);

  assert.ok(has(beginner, "Do not restart"), name + ": beginner continuation");
  assert.ok(has(advanced, "Do not restart"), name + ": advanced continuation");
  assert.ok(has(beginner, "STYLE REQUESTS OUTRANK THIS REGISTER"), name);
  assert.ok(has(advanced, "STYLE REQUESTS OUTRANK THIS REGISTER"), name);

  assert.ok(has(prompts.beginner, "without printing labels"), name + ": beginner uncertainty");
  assert.ok(has(prompts.advanced, "without printing labels"), name + ": advanced uncertainty");
}

function test() {
  const beginnerReading = resolveChatReading({
    birthChart: clone(timedChart()),
    profileMemory: { preferredMode: "beginner" },
  });
  const advancedReading = resolveChatReading({
    birthChart: clone(timedChart()),
    profileMemory: { preferredMode: "advanced" },
  });
  assert.equal(beginnerReading.readingConfig.register, "beginner");
  assert.equal(advancedReading.readingConfig.register, "advanced");
  assert.deepEqual(
    beginnerReading.readingConfig.bodies,
    advancedReading.readingConfig.bodies,
  );
  assert.deepEqual(
    ensureArchitecture(beginnerReading.readingChart).planetConditions,
    ensureArchitecture(advancedReading.readingChart).planetConditions,
  );
  assert.deepEqual(
    ensureArchitecture(beginnerReading.readingChart).dominantPlanets,
    ensureArchitecture(advancedReading.readingChart).dominantPlanets,
  );
  assert.deepEqual(
    ensureArchitecture(beginnerReading.readingChart).aspectsAnnotated,
    ensureArchitecture(advancedReading.readingChart).aspectsAnnotated,
  );
  assert.ok(FACTS.length > 0);
  assert.ok(ARCHITECTURE.length > 0);
  assert.equal(chart.chartSystem, "modern");

  const aspectLens =
    "Clicked: Mars square Saturn, orb 0.8°, applying. Mars in Aries, 4th. Saturn in Capricorn, domicile, 1st.";

  const cases = [
    {
      name: "planet placement",
      extra: { question: "Tell me about Saturn" },
      expect: function (prompts) {
        assert.ok(has(prompts.beginner, "INTERNAL ANALYSIS AND EXTERNAL EXPLANATION"));
        assert.ok(has(prompts.advanced, "INTERNAL ANALYSIS AND EXTERNAL EXPLANATION"));
        assert.ok(has(prompts.beginner, "Do not walk the rest of the chart"));
        assert.ok(has(prompts.advanced, "Do not walk the rest of the chart"));
        assert.equal(prompts.beginner.indexOf("INTENT: CHART_ANALYSIS"), -1);
        assert.equal(prompts.advanced.indexOf("INTENT: CHART_ANALYSIS"), -1);
      },
    },
    {
      name: "aspect interpretation",
      extra: {
        question: "What does Mars square Saturn mean in my chart?",
        aspectMode: true,
        aspectLens: aspectLens,
      },
      expect: function (prompts) {
        assert.ok(has(prompts.beginner, "CLICKED ASPECT"));
        assert.ok(has(prompts.advanced, "CLICKED ASPECT"));
        assert.ok(has(prompts.beginner, aspectLens));
        assert.ok(has(prompts.advanced, aspectLens));
        assert.ok(has(prompts.beginner, "gloss an unfamiliar word once"));
        assert.ok(has(prompts.advanced, "Do not define “square” or “orb” unless they asked"));
        assert.ok(has(prompts.advanced, "If they asked for a simpler explanation, drop orb"));
        assert.ok(has(prompts.advanced, "primary reason this contact matters"));
      },
    },
    {
      name: "house significance",
      extra: {
        question: "What does my 10th house say about my work?",
        topicMode: true,
        topic: { label: "work" },
        topicLens: "10th house, ruler Venus in Libra. Saturn in the 1st disposes the chart ruler.",
      },
      expect: function (prompts) {
        assert.ok(has(prompts.beginner, "asked about work"));
        assert.ok(has(prompts.advanced, "asked about work"));
        assert.ok(has(prompts.beginner, "10th house, ruler Venus in Libra"));
        assert.ok(has(prompts.advanced, "10th house, ruler Venus in Libra"));
        assert.ok(has(prompts.beginner, "short gloss if the word is likely to be new"));
        assert.ok(has(prompts.advanced, "essential dignity"));
        assert.ok(has(prompts.advanced, "Do not define houses or rulers unless they asked"));
      },
    },
    {
      name: "broad chart reading",
      extra: {
        question: "Tell me about my chart",
        chartAnalysisMode: true,
        chartAnalysisProgression: { phase: "overview", id: "dominant_overview" },
      },
      expect: function (prompts) {
        assert.ok(has(prompts.beginner, "BEGINNER CHART_ANALYSIS"));
        assert.ok(has(prompts.advanced, "ADVANCED CHART_ANALYSIS"));
        assert.equal(prompts.beginner.indexOf("ADVANCED CHART_ANALYSIS"), -1);
        assert.equal(prompts.advanced.indexOf("BEGINNER CHART_ANALYSIS"), -1);
        assert.ok(has(prompts.beginner, "Consider the whole computed architecture"));
        assert.ok(has(prompts.advanced, "Consider the whole computed architecture"));
        assert.ok(has(prompts.beginner, "Do not invent a personality portrait"));
        assert.ok(has(prompts.advanced, "Separate primary evidence from secondary considerations"));
        assert.ok(has(prompts.advanced, "not a longer survey"));
      },
    },
    {
      name: "contextual follow-up",
      extra: {
        question: "Why is that difficult?",
        aspectMode: true,
        aspectLens: aspectLens,
      },
      expect: function (prompts) {
        assert.ok(has(prompts.beginner, aspectLens));
        assert.ok(has(prompts.advanced, aspectLens));
        assert.ok(has(prompts.beginner, "two functions do together"));
        assert.ok(has(prompts.advanced, "how each planet"));
        assert.equal(
          factsBetween(prompts.beginner),
          factsBetween(pair({ question: "What does Mars square Saturn mean in my chart?", aspectMode: true, aspectLens: aspectLens }).beginner),
        );
      },
    },
    {
      name: "tell me more",
      extra: {
        question: "Tell me more",
        aspectMode: true,
        aspectLens: aspectLens,
      },
      expect: function (prompts) {
        assert.ok(has(prompts.beginner, "go further into this same connection"));
        assert.ok(has(prompts.advanced, "deepen this contact"));
        assert.ok(has(prompts.beginner, "Do not restart"));
        assert.ok(has(prompts.advanced, "Do not restart"));
        assert.ok(has(prompts.beginner, "do not summarize the chart"));
        assert.ok(has(prompts.advanced, "do not summarize the chart"));
        assert.ok(has(prompts.beginner, aspectLens));
        assert.ok(has(prompts.advanced, aspectLens));
      },
    },
    {
      name: "clarification",
      extra: {
        question: "Can you explain that more simply?",
        aspectMode: true,
        aspectLens: aspectLens,
        sensitivityFlags: ["softer language", "focus on strengths"],
      },
      expect: function (prompts) {
        assert.ok(has(prompts.beginner, "STYLE REQUESTS OUTRANK THIS REGISTER"));
        assert.ok(has(prompts.advanced, "STYLE REQUESTS OUTRANK THIS REGISTER"));
        assert.ok(has(prompts.beginner, "outranks the default register"));
        assert.ok(has(prompts.advanced, "outranks the default register"));
        assert.ok(has(prompts.beginner, "SENSITIVITY PREFERENCES"));
        assert.ok(has(prompts.advanced, "SENSITIVITY PREFERENCES"));
        assert.ok(has(prompts.beginner, "Softer language"));
        assert.ok(has(prompts.advanced, "Focus on strengths"));
        assert.ok(has(prompts.beginner, aspectLens));
        assert.ok(has(prompts.advanced, aspectLens));
      },
    },
  ];

  cases.forEach(function (item) {
    const prompts = pair(item.extra);
    assertSameEvidence(item.name, prompts, item.extra);
    assertRegistersDiffer(item.name, prompts);
    item.expect(prompts);
  });

  const factual = pair({ question: "What degree is Saturn?" });
  assert.equal(factsBetween(factual.beginner), factsBetween(factual.advanced));
  assert.equal(factual.beginner.indexOf("=== REGISTER ==="), -1);
  assert.equal(factual.advanced.indexOf("=== REGISTER ==="), -1);
  assert.ok(has(factual.beginner, "Beginner: plain words"));
  assert.ok(has(factual.advanced, "Advanced: technical terms"));
  assert.ok(has(factual.beginner, "THIS TURN IS A FACTUAL LOOKUP"));
  assert.ok(has(factual.advanced, "THIS TURN IS A FACTUAL LOOKUP"));
  assert.ok(has(factual.beginner, "does not forecast"));
  assert.ok(has(factual.advanced, "does not forecast"));

  const unknown = pair({
    question: "Tell me about Saturn",
    unknownBirthTime: true,
  });
  assertRegistersDiffer("unknown birth time", unknown);
  assert.ok(has(unknown.beginner, "BIRTH TIME UNKNOWN"));
  assert.ok(has(unknown.advanced, "BIRTH TIME UNKNOWN"));
  assert.ok(has(unknown.beginner, "Do not treat the displayed 0° Aries Ascendant"));
  assert.ok(has(unknown.advanced, "Do not treat the displayed 0° Aries Ascendant"));
}

module.exports = test;
