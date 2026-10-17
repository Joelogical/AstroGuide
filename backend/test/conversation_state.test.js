const assert = require("assert");
const { routeChatIntent, continuesEstablishedChartSubject } = require("../intent_router");
const {
  chartKeyFromChart,
  validateConversationState,
  conversationStateFromRoute,
  nextConversationState,
} = require("../conversation_state");
const { composeSystemContent } = require("../prompt_layers");
const { formatAspectLensForModel, ensureArchitecture } = require("../chart_architecture");
const { timedChart } = require("./fixtures");

function chart(date) {
  const next = timedChart();
  next.birthData = {
    date: date || "1990-01-15",
    time: "14:30",
    location: { latitude: 40.7, longitude: -74, timezone: -5 },
  };
  return next;
}

function route(message, history, state, birthChart) {
  const validated = validateConversationState(state, birthChart || chart());
  return routeChatIntent({
    message: message,
    history: history || [],
    validatedState: validated,
  });
}

function storeAfter(stored, message, reply) {
  const next = stored.concat([
    { role: "user", content: message },
    { role: "assistant", content: reply || "Continued." },
  ]);
  return next.length > 10 ? next.slice(-10) : next;
}

function requestHistory(stored, message) {
  return stored.concat([{ role: "user", content: message }]);
}

function test() {
  const birth = chart();
  const other = chart("1985-06-01");
  assert.notEqual(chartKeyFromChart(birth), chartKeyFromChart(other));
  assert.equal(chartKeyFromChart(birth), chartKeyFromChart(JSON.parse(JSON.stringify(birth))));

  const saturnRoute = route("Saturn Capricorn", [
    { role: "user", content: "Saturn Capricorn" },
  ], null, birth);
  const saturnState = conversationStateFromRoute(saturnRoute, birth);
  assert.equal(saturnState.intent, "PLACEMENT");
  assert.equal(saturnState.subject, "Saturn Capricorn");
  assert.equal(saturnState.aspect, null);
  assert.equal(saturnState.chartKey, chartKeyFromChart(birth));

  let stored = storeAfter([], "Saturn Capricorn", "Saturn in Capricorn carries the chart.");
  let state = saturnState;
  for (let i = 0; i < 10; i++) {
    const history = requestHistory(stored, "Tell me more");
    const next = route("Tell me more", history, state, birth);
    assert.equal(next.primaryIntent, "PLACEMENT", "continuation " + (i + 1));
    assert.equal(next.asked, "Tell me more");
    assert.equal(next.questionForMode, "Saturn Capricorn");
    assert.equal(next.chartMode, true);
    assert.equal(
      continuesEstablishedChartSubject("Tell me more", history, state),
      true,
    );
    state = nextConversationState(next, birth, validateConversationState(state, birth));
    assert.equal(state.subject, "Saturn Capricorn");
    stored = storeAfter(stored, "Tell me more");
  }
  assert.equal(
    stored.some(function (entry) {
      return entry.role === "user" && entry.content === "Saturn Capricorn";
    }),
    false,
  );

  const aspectRoute = route("Mars square Saturn", [
    { role: "user", content: "Mars square Saturn" },
  ], null, birth);
  let aspectState = conversationStateFromRoute(aspectRoute, birth);
  assert.equal(aspectState.intent, "ASPECT");
  assert.equal(aspectState.aspect.planet1, "mars");
  assert.equal(aspectState.aspect.aspect, "square");
  assert.equal(aspectState.aspect.planet2, "saturn");
  let aspectStored = storeAfter([], "Mars square Saturn", "Mars square Saturn is a tight contact.");
  ["Tell me more", "why is that difficult?", "Tell me more"].forEach(function (message) {
    aspectStored = storeAfter(aspectStored, message, "Still the Mars square Saturn contact.");
  });
  aspectStored = storeAfter(aspectStored, "Tell me more");
  aspectStored = storeAfter(aspectStored, "Tell me more");
  assert.equal(
    aspectStored.some(function (entry) {
      return entry.content === "Mars square Saturn";
    }),
    false,
  );
  ["Tell me more", "why is that difficult?"].forEach(function (message) {
    const history = requestHistory(aspectStored, message);
    const next = route(message, history, aspectState, birth);
    assert.equal(next.primaryIntent, "ASPECT");
    assert.equal(next.asked, message);
    assert.notEqual(next.questionForMode, message);
    assert.equal(next.clickedAspect.planet1, "mars");
    assert.equal(next.clickedAspect.aspect, "square");
    assert.equal(next.clickedAspect.planet2, "saturn");
    const lens = formatAspectLensForModel(
      ensureArchitecture(birth),
      next.clickedAspect,
      birth,
    );
    assert.ok(lens.indexOf("Mars") > 0);
    assert.ok(lens.indexOf("Saturn") > 0);
    aspectState = nextConversationState(next, birth, aspectState);
  });

  const venus = route("Tell me about Venus", [], saturnState, birth);
  assert.equal(venus.primaryIntent, "PLACEMENT");
  assert.equal(venus.explicitSubject, "venus");
  assert.equal(venus.inheritedIntent, false);
  assert.equal(venus.asked, "Tell me about Venus");
  const venusState = conversationStateFromRoute(venus, birth);
  assert.equal(venusState.subject, "Tell me about Venus");
  const back = route("Saturn Capricorn", [], venusState, birth);
  assert.equal(back.questionForMode, "Saturn Capricorn");
  assert.equal(back.primaryIntent, "PLACEMENT");
  const backState = conversationStateFromRoute(back, birth);
  const resumed = route("Tell me more", [
    { role: "user", content: "Tell me more" },
  ], backState, birth);
  assert.equal(resumed.questionForMode, "Saturn Capricorn");
  assert.equal(resumed.asked, "Tell me more");

  const thanksHistory = [
    { role: "user", content: "thanks" },
    { role: "user", content: "Tell me more" },
  ];
  assert.equal(
    continuesEstablishedChartSubject("Tell me more", thanksHistory, saturnState),
    true,
  );
  const afterThanks = route("Tell me more", thanksHistory, saturnState, birth);
  assert.equal(afterThanks.primaryIntent, "PLACEMENT");
  assert.equal(afterThanks.questionForMode, "Saturn Capricorn");
  assert.equal(afterThanks.asked, "Tell me more");
  const thanksAlone = route("thanks", [{ role: "user", content: "thanks" }], saturnState, birth);
  assert.equal(thanksAlone.primaryIntent, "PERSONAL_SYNTHESIS");
  assert.equal(thanksAlone.aspectMode, false);

  const factualHistory = [
    { role: "user", content: "Where is Saturn?" },
    { role: "assistant", content: "Saturn is in Capricorn." },
    { role: "user", content: "Tell me more" },
  ];
  assert.equal(
    continuesEstablishedChartSubject("Tell me more", factualHistory, aspectState),
    false,
  );
  const afterFactual = route("Tell me more", factualHistory, aspectState, birth);
  assert.equal(afterFactual.asked, "Tell me more");
  assert.equal(afterFactual.aspectMode, false);
  assert.notEqual(afterFactual.questionForMode, aspectState.subject);
  assert.notEqual(afterFactual.primaryIntent, "ASPECT");
  assert.equal(route("Where is Saturn?", factualHistory, aspectState, birth).primaryIntent, "FACTUAL");

  const unrelatedHistory = [
    { role: "user", content: "What is the weather like today?" },
    { role: "assistant", content: "I only read charts." },
    { role: "user", content: "Tell me more" },
  ];
  assert.equal(
    continuesEstablishedChartSubject("Tell me more", unrelatedHistory, saturnState),
    false,
  );
  const afterUnrelated = route("Tell me more", unrelatedHistory, saturnState, birth);
  assert.notEqual(afterUnrelated.primaryIntent, "PLACEMENT");
  assert.notEqual(afterUnrelated.primaryIntent, "CHART_ANALYSIS");
  assert.equal(afterUnrelated.questionForMode, "Tell me more");

  const beginner = route("Tell me more", [{ role: "user", content: "Tell me more" }], aspectState, birth);
  const advanced = route("Tell me more", [{ role: "user", content: "Tell me more" }], aspectState, birth);
  assert.equal(beginner.primaryIntent, advanced.primaryIntent);
  assert.deepEqual(beginner.clickedAspect, advanced.clickedAspect);
  assert.equal(beginner.questionForMode, advanced.questionForMode);
  const beginnerPrompt = composeSystemContent({
    preferredMode: "beginner",
    question: beginner.questionForMode,
    aspectMode: true,
    aspectLens: "Clicked: Mars square Saturn.",
  });
  const advancedPrompt = composeSystemContent({
    preferredMode: "advanced",
    question: advanced.questionForMode,
    aspectMode: true,
    aspectLens: "Clicked: Mars square Saturn.",
  });
  assert.ok(beginnerPrompt.indexOf("=== REGISTER ===") > 0);
  assert.ok(beginnerPrompt.indexOf("BEGINNER REGISTER") > 0);
  assert.equal(beginnerPrompt.indexOf("ADVANCED MODE (expert analytical register"), -1);
  assert.ok(beginnerPrompt.indexOf("=== REGISTER ===") < beginnerPrompt.indexOf("=== ACTIVE INTENT ==="));
  assert.ok(advancedPrompt.indexOf("=== REGISTER ===") > 0);
  assert.ok(advancedPrompt.indexOf("ADVANCED MODE (expert analytical register") > 0);
  assert.ok(advancedPrompt.indexOf("=== REGISTER ===") < advancedPrompt.indexOf("=== ACTIVE INTENT ==="));

  const roundTrip = validateConversationState(
    JSON.parse(JSON.stringify(saturnState)),
    birth,
  );
  assert.deepEqual(roundTrip, saturnState);

  assert.equal(validateConversationState(saturnState, other), null);
  assert.equal(validateConversationState(null, birth), null);
  assert.equal(validateConversationState([], birth), null);
  assert.equal(
    validateConversationState(
      {
        profileId: "other-profile",
        subject: "Saturn Capricorn",
        intent: "PLACEMENT",
        aspect: null,
        chartKey: "not-this-chart",
      },
      birth,
    ),
    null,
  );
  assert.equal(
    validateConversationState(
      {
        subject: "hello",
        intent: "PLACEMENT",
        aspect: null,
        chartKey: saturnState.chartKey,
      },
      birth,
    ),
    null,
  );
  assert.equal(
    validateConversationState(
      {
        subject: "Mars square Saturn",
        intent: "ASPECT",
        aspect: { planet1: "venus", aspect: "trine", planet2: "jupiter" },
        chartKey: saturnState.chartKey,
      },
      birth,
    ),
    null,
  );
  assert.equal(
    validateConversationState(
      {
        subject: "Mars square Saturn",
        intent: "PLACEMENT",
        aspect: null,
        chartKey: aspectState.chartKey,
      },
      birth,
    ),
    null,
  );
  const withProfileId = validateConversationState(
    Object.assign({ profileId: "client-supplied" }, saturnState),
    birth,
  );
  assert.equal(withProfileId.subject, "Saturn Capricorn");
  assert.equal(withProfileId.profileId, undefined);

  const broadHistory = [
    { role: "user", content: "Tell me about my chart" },
    { role: "assistant", content: "Saturn organizes this chart from Capricorn." },
    { role: "user", content: "Tell me more" },
  ];
  const broad = route("Tell me more", broadHistory, null, birth);
  assert.equal(broad.primaryIntent, "CHART_ANALYSIS");
  assert.equal(broad.progressionEligible, true);
  assert.equal(broad.asked, "Tell me more");
  const typedAspect = route(
    "What does Venus opposite Saturn mean in my chart?",
    [],
    saturnState,
    birth,
  );
  assert.equal(typedAspect.primaryIntent, "ASPECT");
  assert.equal(typedAspect.clickedAspect.planet1, "venus");
  assert.equal(typedAspect.inheritedIntent, false);
}

module.exports = test;
