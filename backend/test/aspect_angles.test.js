const assert = require("assert");
const {
  parseClickedAspect,
  formatAspectLensForModel,
  ensureArchitecture,
} = require("../chart_architecture");
const { routeChatIntent } = require("../intent_router");
const {
  validateConversationState,
  conversationStateFromRoute,
  nextConversationState,
} = require("../conversation_state");
const { timedChart, unknownTimeChart } = require("./fixtures");

function birthChart() {
  const next = timedChart();
  next.birthData = {
    date: "1990-01-15",
    time: "14:30",
    location: { latitude: 40.7, longitude: -74, timezone: -5 },
  };
  return next;
}

function route(message, history, state, chart) {
  return routeChatIntent({
    message: message,
    history: history || [],
    validatedState: validateConversationState(state, chart || birthChart()),
  });
}

function lensLines(lens, label) {
  return String(lens || "")
    .split("\n")
    .filter(function (line) {
      return line.indexOf(label + " ") === 0 || line.indexOf(label + " is") === 0;
    });
}

function test() {
  assert.deepEqual(parseClickedAspect("Mars square Saturn"), {
    planet1: "mars",
    aspect: "square",
    planet2: "saturn",
  });

  ["Sun square Ascendant", "Sun square ASC", "Sun square AC", "Sun square asc"].forEach(
    function (text) {
      assert.deepEqual(
        parseClickedAspect(text),
        { planet1: "sun", aspect: "square", planet2: "ascendant" },
        text,
      );
    },
  );
  ["Venus conjunction Midheaven", "Venus conjunct MC", "Venus conjunction mc"].forEach(
    function (text) {
      assert.deepEqual(
        parseClickedAspect(text),
        { planet1: "venus", aspect: "conjunction", planet2: "midheaven" },
        text,
      );
    },
  );
  assert.deepEqual(parseClickedAspect("AC trine Moon"), {
    planet1: "ascendant",
    aspect: "trine",
    planet2: "moon",
  });
  assert.deepEqual(parseClickedAspect("square between the Moon and the MC"), {
    planet1: "moon",
    aspect: "square",
    planet2: "midheaven",
  });
  assert.equal(parseClickedAspect("Tell me about my Ascendant"), null);

  const birth = birthChart();
  ["Sun square Ascendant", "Sun square ASC", "Sun square AC"].forEach(function (text) {
    const routed = route(text, [{ role: "user", content: text }], null, birth);
    assert.equal(routed.primaryIntent, "ASPECT", text);
    assert.equal(routed.aspectMode, true, text);
    assert.equal(routed.chartMode, false, text);
    assert.equal(routed.clickedAspect.planet1, "sun", text);
    assert.equal(routed.clickedAspect.aspect, "square", text);
    assert.equal(routed.clickedAspect.planet2, "ascendant", text);
  });
  assert.notEqual(route("Tell me about my Ascendant").primaryIntent, "ASPECT");

  const priorPlacement = conversationStateFromRoute(
    route("Tell me about Saturn", [], null, birth),
    birth,
  );
  const fromPlacement = route("Sun square Ascendant", [], priorPlacement, birth);
  assert.equal(fromPlacement.primaryIntent, "ASPECT");
  assert.equal(fromPlacement.inheritedIntent, false);
  assert.equal(fromPlacement.clickedAspect.planet2, "ascendant");

  const arch = ensureArchitecture(birth);
  const angleLens = formatAspectLensForModel(
    arch,
    { planet1: "mars", aspect: "square", planet2: "ascendant" },
    birth,
  );
  assert.ok(angleLens.indexOf("Clicked: Mars square Ascendant.") > 0);
  const ascLines = lensLines(angleLens, "Ascendant");
  assert.ok(ascLines.length >= 1);
  ascLines.forEach(function (line) {
    assert.equal(line.indexOf("shows up most"), -1, line);
    assert.ok(line.indexOf("is an angle") > 0, line);
  });
  assert.ok(angleLens.indexOf("in Capricorn") > 0);
  assert.ok(angleLens.indexOf("how you meet the world and start things") > 0);
  assert.ok(angleLens.indexOf("Mars shows up most in") > 0);
  assert.equal(angleLens.indexOf("Ascendant is a main driver"), -1);
  assert.equal(angleLens.indexOf("/ ascendant"), -1);
  assert.equal(angleLens.indexOf("daily life"), -1);

  const mcLens = formatAspectLensForModel(
    arch,
    { planet1: "venus", aspect: "conjunction", planet2: "mc" },
    birth,
  );
  assert.ok(mcLens.indexOf("Clicked: Venus conjunction Midheaven.") > 0);
  const mcLines = lensLines(mcLens, "Midheaven");
  assert.ok(mcLines.length >= 1);
  mcLines.forEach(function (line) {
    assert.equal(line.indexOf("shows up most"), -1, line);
    assert.ok(line.indexOf("is an angle") > 0, line);
  });
  assert.ok(mcLens.indexOf("in Libra") > 0);
  assert.ok(mcLens.indexOf("career, reputation, and how the public sees you") > 0);
  assert.ok(mcLens.indexOf("Venus shows up most in") > 0);
  assert.equal(mcLens.indexOf("Midheaven is a main driver"), -1);

  const bothAngles = formatAspectLensForModel(
    arch,
    { planet1: "ac", aspect: "square", planet2: "mc" },
    birth,
  );
  assert.equal(bothAngles.indexOf("shows up most"), -1);
  assert.ok(bothAngles.indexOf("Ascendant is an angle") > 0);
  assert.ok(bothAngles.indexOf("Midheaven is an angle") > 0);

  const planetLens = formatAspectLensForModel(
    arch,
    { planet1: "mars", aspect: "square", planet2: "saturn" },
    birth,
  );
  assert.equal(planetLens.indexOf("is an angle"), -1);
  assert.ok(planetLens.indexOf("Mars shows up most in") > 0);
  assert.ok(planetLens.indexOf("Saturn shows up most in") > 0);

  const unknown = unknownTimeChart();
  const unknownLens = formatAspectLensForModel(
    ensureArchitecture(unknown),
    parseClickedAspect("Sun square Ascendant"),
    unknown,
  );
  const unknownAngle = lensLines(unknownLens, "Ascendant").join("\n");
  assert.ok(unknownAngle.indexOf("Birth time is unknown") > 0);
  assert.equal(unknownAngle.indexOf("Capricorn"), -1);
  assert.equal(unknownAngle.indexOf("shows up most"), -1);
  assert.ok(unknownLens.indexOf("Sun is in") > 0);

  const click = "Mars square Ascendant";
  const first = route(click, [{ role: "user", content: click }], null, birth);
  let state = conversationStateFromRoute(first, birth);
  assert.equal(state.intent, "ASPECT");
  assert.equal(state.aspect.planet2, "ascendant");
  const immediate = route(
    "Tell me more",
    [
      { role: "user", content: click },
      { role: "assistant", content: "Mars squares the Ascendant." },
      { role: "user", content: "Tell me more" },
    ],
    state,
    birth,
  );
  assert.equal(immediate.primaryIntent, "ASPECT");
  assert.equal(immediate.asked, "Tell me more");
  assert.equal(immediate.questionForMode, click);
  assert.equal(immediate.clickedAspect.planet1, "mars");
  assert.equal(immediate.clickedAspect.planet2, "ascendant");
  const immediateLens = formatAspectLensForModel(
    arch,
    immediate.clickedAspect,
    birth,
  );
  assert.ok(immediateLens.indexOf("Ascendant is an angle") > 0);
  assert.ok(immediateLens.indexOf("Mars shows up most in") > 0);

  let stored = [
    { role: "user", content: click },
    { role: "assistant", content: "Mars squares the Ascendant." },
  ];
  for (let i = 0; i < 6; i++) {
    stored.push({ role: "user", content: "Tell me more" });
    stored.push({ role: "assistant", content: "Still that angle contact." });
  }
  stored = stored.slice(-10);
  assert.equal(
    stored.some(function (entry) {
      return entry.content === click;
    }),
    false,
  );
  const followed = route(
    "why is that difficult?",
    stored.concat([{ role: "user", content: "why is that difficult?" }]),
    state,
    birth,
  );
  assert.equal(followed.primaryIntent, "ASPECT");
  assert.equal(followed.asked, "why is that difficult?");
  assert.equal(followed.questionForMode, click);
  assert.equal(followed.clickedAspect.aspect, "square");
  assert.equal(followed.clickedAspect.planet2, "ascendant");
  const followedLens = formatAspectLensForModel(arch, followed.clickedAspect, birth);
  assert.ok(followedLens.indexOf("Ascendant is an angle") > 0);
  assert.equal(followedLens.indexOf("Ascendant shows up most"), -1);
  state = nextConversationState(followed, birth, state);
  assert.equal(state.intent, "ASPECT");
  assert.equal(state.subject, click);
  assert.equal(state.aspect.planet2, "ascendant");
}

module.exports = test;
