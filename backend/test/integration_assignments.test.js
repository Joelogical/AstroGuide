const assert = require("assert");
const { routeChatIntent, isEarlyCasualGate } = require("../intent_router");
const {
  validateConversationState,
  nextConversationState,
} = require("../conversation_state");
const { selectInterpretiveDepth } = require("../interpretive_depth");
const { ensureArchitecture } = require("../chart_architecture");
const { composeSystemContent, buildGenerationMessages } = require("../prompt_layers");
const { timedChart } = require("./fixtures");

function turn(birth, message, history, previous) {
  const validated = validateConversationState(previous, birth);
  const nextRoute = routeChatIntent({
    message: message,
    history: history || [],
    validatedState: validated,
  });
  const depth = selectInterpretiveDepth({
    message: message,
    route: nextRoute,
    architecture: ensureArchitecture(birth),
    chart: birth,
    previous: validated,
  });
  const state = nextConversationState(nextRoute, birth, validated, depth);
  return { route: nextRoute, depth: depth, state: state };
}

function historyFor(stored, message) {
  return stored.concat([{ role: "user", content: message }]);
}

function remember(stored, message) {
  const next = stored.concat([
    { role: "user", content: message },
    { role: "assistant", content: "Continued the assigned dimensions." },
  ]);
  return next.length > 10 ? next.slice(-10) : next;
}

function overlap(left, right) {
  return (left || []).filter(function (id) {
    return (right || []).indexOf(id) !== -1;
  });
}

function registerBeforeIntent(prompt) {
  const registerAt = prompt.indexOf("=== REGISTER ===");
  const intentAt = prompt.indexOf("=== ACTIVE INTENT ===");
  assert.ok(registerAt > 0);
  assert.ok(intentAt > registerAt);
}

function test() {
  const birth = timedChart();
  const opened = turn(birth, "Saturn Capricorn", [
    { role: "user", content: "Saturn Capricorn" },
  ], null);
  assert.equal(opened.route.primaryIntent, "PLACEMENT");
  assert.equal(opened.depth.subjectKey, "planet:saturn");
  const openingCovered = opened.state.coverage.covered.slice();
  assert.ok(openingCovered.indexOf("placement") !== -1);

  ["I disagree", "that's wrong", "I don't understand", "I disagree.", "That's wrong!"].forEach(
    function (message) {
      const repair = turn(
        birth,
        message,
        historyFor([], message),
        opened.state,
      );
      assert.equal(repair.route.questionForMode, "Saturn Capricorn", message);
      assert.equal(repair.route.asked, message, message);
      assert.equal(repair.route.primaryIntent, "PLACEMENT", message);
      assert.equal(repair.depth.subjectKey, "planet:saturn", message);
      assert.equal(repair.depth.turn, "clarify", message);
      assert.deepEqual(repair.depth.presented, [], message);
      assert.deepEqual(repair.state.coverage.covered, openingCovered, message);
      assert.equal(isEarlyCasualGate(message, historyFor([], message), opened.state), false);
    },
  );

  const continued = turn(
    birth,
    "Tell me more!",
    historyFor([{ role: "user", content: "Saturn Capricorn" }], "Tell me more!"),
    opened.state,
  );
  assert.equal(continued.route.questionForMode, "Saturn Capricorn");
  assert.equal(continued.route.asked, "Tell me more!");
  assert.equal(continued.depth.turn, "continue");
  assert.ok(continued.depth.presented.length >= 1);
  assert.deepEqual(overlap(continued.depth.presented, openingCovered), []);
  continued.depth.presented.forEach(function (id) {
    assert.ok(continued.state.coverage.covered.indexOf(id) !== -1);
  });

  const relationship = turn(
    birth,
    "How does that affect my relationships?",
    historyFor([], "How does that affect my relationships?"),
    opened.state,
  );
  assert.equal(relationship.route.asked, "How does that affect my relationships?");
  assert.equal(relationship.route.questionForMode, "Saturn Capricorn");
  assert.equal(relationship.route.primaryIntent, "PLACEMENT");
  assert.equal(relationship.depth.subjectKey, "planet:saturn");
  assert.equal(
    isEarlyCasualGate(
      "How does that affect my relationships?",
      historyFor([], "How does that affect my relationships?"),
      opened.state,
    ),
    false,
  );

  ["Sun square Ascendant", "Sun square ASC", "Venus conjunct MC", "Venus conjunction Midheaven"].forEach(
    function (message) {
      const aspect = turn(birth, message, [{ role: "user", content: message }], opened.state);
      assert.equal(aspect.route.primaryIntent, "ASPECT", message);
      assert.equal(aspect.route.aspectMode, true, message);
      assert.equal(isEarlyCasualGate(message, [{ role: "user", content: message }], null), false);
    },
  );

  let stored = [];
  let state = null;
  const script = ["Saturn Capricorn"].concat(new Array(8).fill("Tell me more"));
  script.forEach(function (message) {
    const step = turn(birth, message, historyFor(stored, message), state);
    state = step.state;
    stored = remember(stored, message);
  });
  assert.equal(
    stored.some(function (entry) {
      return entry.content === "Saturn Capricorn";
    }),
    false,
  );
  const afterCutoff = turn(
    birth,
    "Tell me more",
    historyFor(stored, "Tell me more"),
    state,
  );
  assert.equal(afterCutoff.route.questionForMode, "Saturn Capricorn");
  const priorText = (afterCutoff.route.priorConversation || [])
    .map(function (item) {
      return item.content;
    })
    .join("\n");
  assert.equal(priorText.indexOf("Saturn Capricorn"), -1);
  assert.ok(afterCutoff.depth.directive.indexOf("Current chart subject: Saturn") !== -1);
  assert.ok(afterCutoff.depth.directive.indexOf("planet:saturn") !== -1);

  function cutoffPrompt(mode) {
    return composeSystemContent({
      preferredMode: mode,
      question: afterCutoff.route.questionForMode,
      chartFactsOnly: "Sun in Capricorn.",
      architectureBlock: "Chart ruler: Saturn in Capricorn.",
      interpretiveDepth: afterCutoff.depth,
    });
  }
  const beginner = cutoffPrompt("beginner");
  const advanced = cutoffPrompt("advanced");
  registerBeforeIntent(beginner);
  registerBeforeIntent(advanced);
  assert.ok(beginner.indexOf("BEGINNER REGISTER") > 0);
  assert.equal(beginner.indexOf("ADVANCED MODE (expert analytical register"), -1);
  assert.ok(advanced.indexOf("ADVANCED MODE (expert analytical register") > 0);
  assert.equal(advanced.indexOf("BEGINNER REGISTER"), -1);
  assert.ok(beginner.indexOf("STYLE REQUESTS OUTRANK THIS REGISTER") > 0);
  assert.ok(advanced.indexOf("STYLE REQUESTS OUTRANK THIS REGISTER") > 0);
  assert.ok(beginner.indexOf("does not forecast") > 0);
  assert.ok(advanced.indexOf("does not forecast") > 0);
  [beginner, advanced].forEach(function (prompt) {
    const depthAt = prompt.indexOf("=== INTERPRETIVE DEPTH ===");
    const factsAt = prompt.indexOf("=== DETERMINISTIC CONTEXT ===");
    assert.ok(depthAt > prompt.indexOf("=== REGISTER ==="));
    assert.ok(depthAt < factsAt);
    assert.ok(prompt.indexOf("Subject wording: Saturn Capricorn.") > depthAt);
    assert.ok(prompt.indexOf("Subject wording: Saturn Capricorn.") < factsAt);
    assert.ok(prompt.indexOf("planet:saturn") > depthAt);
    assert.ok(prompt.indexOf("THE ENTIRE CHART INFORMS THIS READING.") > 0);
    assert.ok(prompt.indexOf("even when the original selection is no longer in the conversation history.") > depthAt);
  });
  const messages = buildGenerationMessages(
    beginner,
    afterCutoff.route.priorConversation,
    "Tell me more\n\n" + afterCutoff.depth.userNote,
  );
  const joined = messages
    .map(function (item) {
      return item.content;
    })
    .join("\n");
  assert.ok(joined.indexOf("Current chart subject: Saturn") !== -1);
  assert.ok(joined.indexOf("planet:saturn") !== -1);
  assert.equal(
    priorText.indexOf("Saturn Capricorn"),
    -1,
  );
}

module.exports = test;
