const assert = require("assert");
const { chartKeyFromChart: serverChartKey } = require("../conversation_state");
const {
  chartKeyFromChart,
  withChartSystem,
  profileSaveDecision,
  applyProfileIdentitySave,
  inFlightWriteTarget,
  clearedConversationPatch,
} = require("../../frontend/profile_lifecycle");

function chart(date, extra) {
  return Object.assign(
    {
      chartSystem: "modern",
      unknownBirthTime: false,
      birthData: {
        date: date || "1990-01-15",
        time: "14:30",
        location: { latitude: 40.7, longitude: -74, timezone: -5 },
      },
      planets: { sun: { sign: "Capricorn", degree: 280 } },
    },
    extra || {},
  );
}

function profileWith(chartData, extra) {
  return Object.assign(
    {
      id: "profile-a",
      name: "Ada",
      chartSystem: "modern",
      conversationHistory: [{ role: "user", content: "Mars square Ascendant" }],
      routingState: {
        subject: "Mars square Ascendant",
        intent: "ASPECT",
        aspect: { planet1: "mars", aspect: "square", planet2: "ascendant" },
      },
      pendingFollowUps: ["Tell me more about that square"],
      chartSummary: { text: "old summary" },
      memory: { preferredMode: "advanced" },
      birthChartData: chartData,
    },
    extra || {},
  );
}

function test() {
  const birth = chart();
  const sameBirth = chart("1990-01-15", {
    planets: { sun: { sign: "Capricorn", degree: 281.2 } },
  });
  const moved = chart("1985-06-01");
  const rounded = chart("1990-01-15", {
    birthData: {
      date: "1990-01-15",
      time: "14:30",
      location: { latitude: "40.70", longitude: "-74.0", timezone: "-5" },
    },
  });
  assert.equal(chartKeyFromChart(birth), serverChartKey(birth));
  assert.equal(chartKeyFromChart(sameBirth), serverChartKey(sameBirth));
  assert.equal(chartKeyFromChart(birth), chartKeyFromChart(rounded));
  assert.equal(chartKeyFromChart(birth), serverChartKey(rounded));
  assert.notEqual(chartKeyFromChart(birth), chartKeyFromChart(moved));

  const traditional = withChartSystem(birth, "traditional");
  const unknown = Object.assign({}, birth, { unknownBirthTime: true });
  assert.equal(chartKeyFromChart(traditional), serverChartKey(traditional));
  assert.equal(chartKeyFromChart(unknown), serverChartKey(unknown));
  assert.notEqual(chartKeyFromChart(birth), chartKeyFromChart(traditional));
  assert.notEqual(chartKeyFromChart(birth), chartKeyFromChart(unknown));
  assert.equal(chartKeyFromChart(null), "");
  assert.equal(serverChartKey(null), "");

  const kept = applyProfileIdentitySave(
    profileWith(birth),
    birth,
    sameBirth,
    "modern",
  );
  assert.equal(kept.decision.identityChanged, false);
  assert.equal(kept.decision.preserveRoutingState, true);
  assert.equal(kept.decision.clearHistory, false);
  assert.equal(kept.profile.routingState.intent, "ASPECT");
  assert.equal(kept.profile.conversationHistory.length, 1);
  assert.deepEqual(kept.profile.pendingFollowUps, [
    "Tell me more about that square",
  ]);
  assert.equal(kept.profile.chartSummary.text, "old summary");
  assert.equal(kept.profile.memory.preferredMode, "advanced");
  assert.equal(kept.profile.name, "Ada");

  const cleared = applyProfileIdentitySave(
    profileWith(birth),
    birth,
    moved,
    "modern",
  );
  assert.equal(cleared.decision.identityChanged, true);
  assert.equal(cleared.decision.preserveRoutingState, false);
  assert.deepEqual(cleared.profile.conversationHistory, []);
  assert.equal(cleared.profile.routingState, null);
  assert.deepEqual(cleared.profile.pendingFollowUps, []);
  assert.equal(cleared.profile.chartSummary, null);
  assert.equal(cleared.profile.memory.preferredMode, "advanced");

  const systemChange = profileSaveDecision(
    withChartSystem(birth, "modern"),
    withChartSystem(birth, "traditional"),
  );
  assert.equal(systemChange.identityChanged, true);
  assert.equal(systemChange.clearRoutingState, true);
  assert.equal(systemChange.clearPendingFollowUps, true);

  const nameOnly = profileSaveDecision(birth, sameBirth);
  assert.equal(nameOnly.identityChanged, false);
  assert.equal(nameOnly.preserveRoutingState, true);

  assert.deepEqual(clearedConversationPatch(), {
    conversationHistory: [],
    routingState: null,
    pendingFollowUps: [],
  });

  const base = {
    profileId: "profile-a",
    profileExists: true,
    generation: 2,
    currentGeneration: 2,
    requestChartKey: chartKeyFromChart(birth),
    profileChartKey: chartKeyFromChart(birth),
  };
  const staying = inFlightWriteTarget(
    Object.assign({}, base, { activeProfileId: "profile-a" }),
  );
  assert.equal(staying.write, true);
  assert.equal(staying.render, true);

  const switched = inFlightWriteTarget(
    Object.assign({}, base, { activeProfileId: "profile-b" }),
  );
  assert.equal(switched.write, true);
  assert.equal(switched.render, false);

  const staleGeneration = inFlightWriteTarget(
    Object.assign({}, base, {
      activeProfileId: "profile-a",
      currentGeneration: 3,
    }),
  );
  assert.equal(staleGeneration.write, false);
  assert.equal(staleGeneration.render, false);

  const newChart = inFlightWriteTarget(
    Object.assign({}, base, {
      activeProfileId: "profile-a",
      profileChartKey: chartKeyFromChart(moved),
    }),
  );
  assert.equal(newChart.write, false);
  assert.equal(newChart.render, false);

  const deleted = inFlightWriteTarget(
    Object.assign({}, base, {
      profileExists: false,
      activeProfileId: "profile-a",
    }),
  );
  assert.equal(deleted.write, false);
  assert.equal(deleted.render, false);
}

module.exports = test;
