const assert = require("assert");
const { buildChartArchitecture } = require("../chart_architecture");
const {
  isBroadChartAnalysisPrompt,
  isChartAnalysisQuestion,
  selectChartAnalysisFocus,
} = require("../chart_analysis");
const { isFactualQuestion } = require("../factual_questions");
const { timedChart, unknownTimeChart, traditionalChart } = require("./fixtures");

function developed(text) {
  return { role: "assistant", content: text };
}

const RULERSHIP = [
  "Saturn rules Capricorn and holds the final dispositor position for the classical chain in this figure.",
  "The chain runs through the Sun and Mercury in Capricorn back to Saturn, so rulership is concentrated.",
  "That dispositor chain is the structural reason Saturn organizes the other Capricorn placements.",
].join(" ");

function test() {
  assert.equal(isBroadChartAnalysisPrompt("Analyze my chart"), true);
  assert.equal(isBroadChartAnalysisPrompt("What stands out?"), true);
  assert.equal(isBroadChartAnalysisPrompt("What else stands out?"), false);
  assert.equal(
    isBroadChartAnalysisPrompt("What else stands out?", [
      { role: "user", content: "Tell me about my chart" },
    ]),
    true,
  );
  assert.equal(
    isBroadChartAnalysisPrompt("Tell me more", [
      { role: "user", content: "Tell me about my chart" },
    ]),
    true,
  );
  assert.equal(isBroadChartAnalysisPrompt("Tell me more about Saturn"), false);
  assert.equal(isChartAnalysisQuestion("Why is Saturn so important?"), false);
  assert.equal(isChartAnalysisQuestion("Where is my Saturn?"), false);
  assert.equal(isFactualQuestion("Where is my Saturn?"), true);
  assert.equal(isFactualQuestion("What house is Mars in?"), true);
  assert.equal(isFactualQuestion("What degree is Venus?"), true);
  assert.equal(isFactualQuestion("Is Mercury retrograde?"), true);
  assert.equal(isBroadChartAnalysisPrompt("Tell me more about my career"), false);

  const arch = buildChartArchitecture(timedChart());
  const before = JSON.stringify(arch.dominantPlanets);
  const first = selectChartAnalysisFocus(arch, []);
  assert.equal(first.id, "dominant_overview");
  assert.equal(first.phase, "overview");

  const namedrop = selectChartAnalysisFocus(arch, [
    { role: "user", content: "Tell me about my chart" },
    developed("Saturn also contributes to this pattern."),
  ]);
  assert.equal(namedrop.phase, "breadth");
  assert.notEqual(namedrop.id, "dominant_overview");

  const afterRulership = selectChartAnalysisFocus(arch, [
    { role: "user", content: "Tell me about my chart" },
    developed(RULERSHIP),
    { role: "user", content: "Tell me about my chart" },
  ]);
  assert.equal(afterRulership.phase, "breadth");
  assert.notEqual(afterRulership.id, "rulership_chains");
  assert.equal(JSON.stringify(arch.dominantPlanets), before);

  const unknown = buildChartArchitecture(unknownTimeChart());
  const unknownFocus = selectChartAnalysisFocus(unknown, [
    { role: "user", content: "Tell me about my chart" },
    developed("The Sun and Moon oppose each other across the signs."),
    developed("Saturn in Capricorn is in its own sign and disposes the Sun."),
    developed("Mars squares both lights and forms the focal point of the pattern."),
  ]);
  assert.notEqual(unknownFocus.id, "house_axes");
  assert.notEqual(unknownFocus.id, "angular_structure");

  const traditional = buildChartArchitecture(traditionalChart());
  assert.equal(traditional.chartSystem, "traditional");
  const names = (traditional.dominantPlanets || []).map(function (item) {
    return item.planet;
  });
  assert.equal(names.indexOf("uranus"), -1);
  assert.equal(names.indexOf("neptune"), -1);
  assert.equal(names.indexOf("pluto"), -1);
}

module.exports = test;
