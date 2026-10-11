const assert = require("assert");
const { routeChatIntent } = require("../intent_router");
const {
  validateConversationState,
  conversationStateFromRoute,
  nextConversationState,
  chartKeyFromChart,
} = require("../conversation_state");
const { selectInterpretiveDepth } = require("../interpretive_depth");
const { ensureArchitecture } = require("../chart_architecture");
const { composeSystemContent, buildGenerationMessages } = require("../prompt_layers");
const { timedChart, unknownTimeChart, traditionalChart } = require("./fixtures");

function route(message, history, state, birthChart) {
  const validated = validateConversationState(state, birthChart);
  return routeChatIntent({
    message: message,
    history: history || [],
    validatedState: validated,
  });
}

function turn(birth, message, history, previous) {
  const validated = validateConversationState(previous, birth);
  const nextRoute = route(message, history, previous, birth);
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

function test() {
  const birth = timedChart();
  const arch = ensureArchitecture(birth);
  assert.ok(arch && arch.ok);

  const opened = turn(birth, "Saturn Capricorn", [
    { role: "user", content: "Saturn Capricorn" },
  ], null);
  assert.equal(opened.route.primaryIntent, "PLACEMENT");
  assert.equal(opened.depth.turn, "initial");
  assert.equal(opened.depth.subjectKey, "planet:saturn");
  assert.equal(opened.depth.presented[0], "placement");
  assert.ok(opened.depth.presented.indexOf("angularity") !== -1);
  assert.ok(opened.depth.presented.indexOf("house") !== -1);
  assert.equal(opened.depth.presented.length, 3);
  assert.equal(opened.depth.presented.indexOf("aspects"), -1);
  assert.equal(opened.depth.presented.indexOf("configuration"), -1);
  assert.ok(opened.depth.directive.indexOf("90–150") !== -1);
  assert.ok(opened.depth.directive.indexOf("THE ENTIRE CHART INFORMS THIS READING.") !== -1);
  assert.equal(opened.state.coverage.subjectKey, "planet:saturn");
  assert.deepEqual(opened.state.coverage.covered, opened.depth.covered);

  const aspects = turn(
    birth,
    "Tell me about Saturn's aspects",
    [{ role: "user", content: "Tell me about Saturn's aspects" }],
    null,
  );
  assert.equal(aspects.depth.turn, "specific");
  assert.deepEqual(aspects.depth.presented, ["aspects"]);
  assert.equal(aspects.depth.presented.indexOf("house"), -1);

  const direct = turn(
    birth,
    "why is my saturn difficult?",
    [{ role: "user", content: "why is my saturn difficult?" }],
    null,
  );
  assert.equal(direct.depth.turn, "specific");
  assert.deepEqual(direct.depth.presented, ["placement"]);

  const clarified = turn(
    birth,
    "why is that difficult?",
    historyFor([], "why is that difficult?"),
    opened.state,
  );
  assert.equal(clarified.route.questionForMode, "Saturn Capricorn");
  assert.equal(clarified.depth.turn, "clarify");
  assert.deepEqual(clarified.depth.presented, []);
  assert.deepEqual(clarified.state.coverage.covered, opened.state.coverage.covered);
  assert.ok(clarified.depth.directive.indexOf("clarification or repetition") !== -1);

  const repeated = turn(
    birth,
    "say that again",
    historyFor([], "say that again"),
    opened.state,
  );
  assert.equal(repeated.depth.turn, "clarify");
  assert.deepEqual(repeated.state.coverage.covered, opened.state.coverage.covered);

  const continued = turn(
    birth,
    "Tell me more",
    historyFor([{ role: "user", content: "Saturn Capricorn" }], "Tell me more"),
    opened.state,
  );
  assert.equal(continued.depth.turn, "continue");
  assert.ok(continued.depth.presented.length >= 1 && continued.depth.presented.length <= 2);
  assert.deepEqual(overlap(continued.depth.presented, opened.depth.covered), []);
  assert.ok(continued.depth.directive.indexOf("140–220") !== -1);
  assert.ok(continued.depth.directive.indexOf("Do not restate") !== -1);
  continued.depth.presented.forEach(function (id) {
    assert.ok(continued.state.coverage.covered.indexOf(id) !== -1);
  });

  const career = turn(
    birth,
    "How does Saturn show up in my career?",
    historyFor([], "How does Saturn show up in my career?"),
    opened.state,
  );
  assert.equal(career.depth.turn, "specific");
  assert.deepEqual(career.depth.presented, ["life_area"]);
  assert.deepEqual(overlap(career.depth.presented, ["aspects", "configuration"]), []);

  const venus = turn(
    birth,
    "Tell me about Venus",
    [{ role: "user", content: "Tell me about Venus" }],
    opened.state,
  );
  assert.equal(venus.depth.subjectKey, "planet:venus");
  assert.equal(venus.depth.turn, "initial");
  assert.deepEqual(venus.depth.alreadyCovered, []);
  assert.notEqual(venus.state.coverage.subjectKey, opened.state.coverage.subjectKey);

  const missing = turn(
    birth,
    "Mars square Saturn",
    [{ role: "user", content: "Mars square Saturn" }],
    null,
  );
  assert.equal(missing.route.primaryIntent, "ASPECT");
  assert.equal(missing.depth.turn, "absent");
  assert.deepEqual(missing.depth.presented, []);
  assert.ok(missing.depth.directive.indexOf("not in the computed aspect list") !== -1);
  assert.deepEqual(missing.state.coverage.covered, []);

  const sunSquare = turn(
    birth,
    "Sun square Mars",
    [{ role: "user", content: "Sun square Mars" }],
    null,
  );
  assert.equal(sunSquare.depth.turn, "initial");
  assert.equal(sunSquare.depth.subjectKey, "aspect:mars|square|sun");
  assert.ok(sunSquare.depth.presented.indexOf("contact") !== -1);
  assert.ok(sunSquare.depth.presented.indexOf("configuration") !== -1);
  assert.ok(sunSquare.depth.presented.length <= 3);

  const reversed = turn(
    birth,
    "Mars square Sun",
    historyFor([], "Mars square Sun"),
    sunSquare.state,
  );
  assert.equal(reversed.depth.subjectKey, sunSquare.depth.subjectKey);
  assert.notEqual(reversed.depth.turn, "initial");
  assert.deepEqual(overlap(reversed.depth.presented, sunSquare.depth.covered), []);

  const unknown = turn(
    unknownTimeChart(),
    "Saturn",
    [{ role: "user", content: "Saturn" }],
    null,
  );
  assert.equal(unknown.depth.presented.indexOf("house"), -1);
  assert.equal(unknown.depth.presented.indexOf("life_area"), -1);
  assert.ok(unknown.depth.presented.indexOf("placement") !== -1);

  const unknownHouseAsk = turn(
    unknownTimeChart(),
    "Tell me about Saturn's house",
    [{ role: "user", content: "Tell me about Saturn's house" }],
    null,
  );
  assert.equal(unknownHouseAsk.depth.turn, "specific");
  assert.deepEqual(unknownHouseAsk.depth.presented, []);
  assert.ok(/birth time is unknown/i.test(unknownHouseAsk.depth.directive));
  assert.equal(unknownHouseAsk.depth.presented.indexOf("aspects"), -1);

  const unknownHouse = turn(
    unknownTimeChart(),
    "10th house",
    [{ role: "user", content: "10th house" }],
    null,
  );
  assert.equal(unknownHouse.depth.turn, "absent");
  assert.ok(/birth time is unknown/i.test(unknownHouse.depth.directive));
  assert.deepEqual(unknownHouse.state.coverage.covered, []);

  const outer = turn(
    traditionalChart(),
    "Uranus",
    [{ role: "user", content: "Uranus" }],
    null,
  );
  assert.equal(outer.depth.applicable, false);
  assert.equal(outer.state.coverage, undefined);

  const house = turn(
    birth,
    "10th house",
    [{ role: "user", content: "10th house" }],
    null,
  );
  assert.equal(house.depth.kind, "house");
  assert.equal(house.depth.subjectKey, "house:10");
  assert.equal(house.depth.turn, "initial");
  assert.equal(house.depth.presented[0], "topics");
  assert.equal(house.depth.presented.indexOf("ruler"), -1);
  assert.ok(house.depth.presented.length <= 3);

  const angle = turn(
    birth,
    "Ascendant",
    [{ role: "user", content: "Ascendant" }],
    null,
  );
  assert.equal(angle.depth.kind, "angle");
  assert.equal(angle.depth.subjectKey, "angle:ascendant");
  assert.ok(angle.depth.presented.indexOf("sign") !== -1);

  let stored = [];
  let state = null;
  let sawInitial = false;
  const script = ["Saturn Capricorn"].concat(new Array(8).fill("Tell me more"));
  script.forEach(function (message) {
    const step = turn(birth, message, historyFor(stored, message), state);
    if (step.depth.turn === "initial") {
      assert.equal(sawInitial, false);
      sawInitial = true;
    }
    if (step.depth.turn === "continue") {
      assert.deepEqual(overlap(step.depth.presented, step.depth.alreadyCovered), []);
    }
    state = step.state;
    stored = remember(stored, message);
  });
  assert.equal(
    stored.some(function (entry) {
      return entry.content === "Saturn Capricorn";
    }),
    false,
  );
  assert.equal(state.coverage.subjectKey, "planet:saturn");
  assert.ok(state.coverage.covered.indexOf("placement") !== -1);
  const afterCutoff = turn(birth, "Tell me more", historyFor(stored, "Tell me more"), state);
  assert.equal(afterCutoff.route.questionForMode, "Saturn Capricorn");
  assert.ok(afterCutoff.depth.userNote.indexOf("Saturn") !== -1);
  assert.ok(afterCutoff.depth.directive.indexOf("Saturn") !== -1);
  assert.ok(afterCutoff.depth.directive.indexOf("planet:saturn") !== -1);
  const priorText = (afterCutoff.route.priorConversation || []).map(function (item) {
    return item.content;
  }).join("\n");
  assert.equal(priorText.indexOf("Saturn Capricorn"), -1);
  const messages = buildGenerationMessages(
    "system",
    afterCutoff.route.priorConversation,
    "Tell me more\n\n" + afterCutoff.depth.userNote,
  );
  const joined = messages.map(function (item) {
    return item.content;
  }).join("\n");
  assert.ok(joined.indexOf("Current chart subject: Saturn") !== -1);
  assert.ok(joined.indexOf("planet:saturn") !== -1);

  let guard = 0;
  let cursor = opened.state;
  let lastCovered = cursor.coverage.covered.length;
  while (guard < 8) {
    const step = turn(birth, "Tell me more", historyFor([], "Tell me more"), cursor);
    if (step.depth.turn === "deepen") {
      assert.deepEqual(step.depth.presented, []);
      assert.equal(step.state.coverage.covered.length, lastCovered);
      assert.ok(step.depth.directive.indexOf("Do not restate the earlier reading") !== -1);
      break;
    }
    assert.ok(step.state.coverage.covered.length >= lastCovered);
    lastCovered = step.state.coverage.covered.length;
    cursor = step.state;
    guard += 1;
  }
  assert.ok(guard < 8);

  const forged = validateConversationState(
    {
      subject: "Saturn Capricorn",
      intent: "PLACEMENT",
      aspect: null,
      chartKey: chartKeyFromChart(birth),
      coverage: {
        subjectKey: "planet:saturn",
        kind: "planet",
        covered: ["placement", "not-a-dimension"],
      },
    },
    birth,
  );
  assert.equal(forged.subject, "Saturn Capricorn");
  assert.equal(forged.coverage, undefined);

  const staleAspect = validateConversationState(
    {
      subject: "Venus",
      intent: "PLACEMENT",
      aspect: null,
      chartKey: chartKeyFromChart(birth),
      coverage: {
        subjectKey: "planet:venus",
        kind: "planet",
        covered: ["placement", "aspects"],
      },
    },
    birth,
  );
  assert.equal(staleAspect.subject, "Venus");
  assert.deepEqual(staleAspect.coverage.covered, ["placement"]);

  const other = timedChart();
  other.birthData = {
    date: "1985-06-01",
    time: "14:30",
    location: { latitude: 40.7, longitude: -74, timezone: -5 },
  };
  assert.equal(validateConversationState(opened.state, other), null);

  const roundTrip = validateConversationState(
    JSON.parse(JSON.stringify(opened.state)),
    birth,
  );
  assert.deepEqual(roundTrip.coverage, opened.state.coverage);
  assert.equal(roundTrip.subject, "Saturn Capricorn");

  const prompt = composeSystemContent({
    preferredMode: "beginner",
    question: "Tell me more",
    aspectMode: true,
    aspectLens: "--- ASPECT LENS ---\nClicked: Sun square Mars.\n--- END ASPECT LENS ---",
    architectureBlock: "Chart ruler: Saturn in Capricorn.",
    chartFactsOnly: "Sun in Capricorn.",
    interpretiveDepth: sunSquare.depth,
  });
  assert.ok(prompt.indexOf("=== REGISTER ===") > 0);
  assert.ok(prompt.indexOf("BEGINNER REGISTER") > 0);
  assert.equal(prompt.indexOf("ADVANCED MODE (expert analytical register"), -1);
  assert.ok(prompt.indexOf("=== REGISTER ===") < prompt.indexOf("=== ACTIVE INTENT ==="));
  assert.ok(prompt.indexOf("=== INTERPRETIVE DEPTH ===") > 0);
  assert.ok(prompt.indexOf("Current chart subject: Sun square Mars") > 0);
  assert.ok(prompt.indexOf("CHART ARCHITECTURE") > 0);
  assert.ok(prompt.indexOf("ASPECT LENS") > 0);
  assert.ok(prompt.indexOf("CLICKED ASPECT") > 0);
  assert.ok(
    prompt.indexOf("=== INTERPRETIVE DEPTH ===") < prompt.indexOf("=== DETERMINISTIC CONTEXT ==="),
  );
  assert.ok(prompt.indexOf("Sun in Capricorn.") > prompt.indexOf("=== INTERPRETIVE DEPTH ==="));

  const saved = conversationStateFromRoute(opened.route, birth);
  assert.equal(saved.coverage, undefined);
  assert.equal(nextConversationState(opened.route, birth, saved, opened.depth).coverage.subjectKey, "planet:saturn");
}

module.exports = test;
