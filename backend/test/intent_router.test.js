const assert = require("assert");
const { routeChatIntent } = require("../intent_router");
const { buildAnalysisState } = require("../analysis_state");
const { buildChartArchitecture } = require("../chart_architecture");
const { timedChart } = require("./fixtures");

function route(message, history) {
  return routeChatIntent({ message: message, history: history || [] });
}

function test() {
  assert.equal(route("Tell me about myself").primaryIntent, "PERSONAL_SYNTHESIS");
  assert.equal(route("Tell me about my chart").primaryIntent, "CHART_ANALYSIS");
  assert.equal(
    route("What stands out in my chart?").primaryIntent,
    "CHART_ANALYSIS",
  );
  assert.equal(route("Where is Saturn?").primaryIntent, "FACTUAL");
  assert.equal(route("What degree is Saturn?").primaryIntent, "FACTUAL");
  assert.equal(
    route("What does Venus opposite Saturn mean in my chart?").primaryIntent,
    "ASPECT",
  );
  assert.equal(route("What about relationships?").primaryIntent, "TOPIC");
  assert.equal(route("Tell me about Saturn").explicitSubject, "saturn");
  assert.notEqual(route("Tell me about Saturn").primaryIntent, "CHART_ANALYSIS");

  const prior = [{ role: "user", content: "Tell me about my chart" }];
  const more = route("Tell me more", prior);
  assert.equal(more.primaryIntent, "CHART_ANALYSIS");
  assert.equal(more.inheritedIntent, true);
  const deeper = route("Go deeper", prior);
  assert.equal(deeper.primaryIntent, "CHART_ANALYSIS");
  assert.equal(deeper.inheritedIntent, true);

  const history = [
    { role: "user", content: "Tell me about my chart" },
    { role: "assistant", content: "The chart is organized by Saturn." },
    { role: "user", content: "Tell me about my chart" },
  ];
  const second = route("Tell me about my chart", history);
  assert.equal(second.primaryIntent, "CHART_ANALYSIS");
  assert.equal(second.progressionEligible, true);
  const state = buildAnalysisState(
    buildChartArchitecture(timedChart()),
    second.priorConversation,
    second,
  );
  assert.equal(state.currentIntent, "CHART_ANALYSIS");
  assert.equal(state.progressionPhase, "breadth");
  assert.ok(state.currentFocus);
  assert.notEqual(state.currentFocus, "dominant_overview");

  const saturn = route("Tell me more about Saturn", prior);
  assert.equal(saturn.explicitSubject, "saturn");
  assert.equal(saturn.progressionEligible, false);
}

module.exports = test;
