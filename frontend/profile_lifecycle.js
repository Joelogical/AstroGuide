/**
 * Profile identity and in-flight write rules.
 * chartKeyFromChart must stay in sync with backend/conversation_state.js.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    Object.keys(api).forEach(function (key) {
      root[key] = api[key];
    });
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function identityPart(value) {
    if (value == null) return "";
    const text = String(value).trim();
    if (!text) return "";
    const number = Number(text);
    if (Number.isFinite(number)) return String(number);
    return text;
  }

  function chartKeyFromChart(chart) {
    if (!chart || typeof chart !== "object") return "";
    const birth =
      chart.birthData && typeof chart.birthData === "object" ? chart.birthData : {};
    const location =
      birth.location && typeof birth.location === "object" ? birth.location : {};
    const system =
      String(chart.chartSystem || "modern").toLowerCase() === "traditional"
        ? "traditional"
        : "modern";
    const unknown =
      chart.unknownBirthTime || birth.unknownBirthTime ? "unknown-time" : "known-time";
    return [
      system,
      unknown,
      identityPart(birth.date),
      identityPart(birth.time),
      identityPart(location.latitude),
      identityPart(location.longitude),
      identityPart(location.timezone),
    ].join("|");
  }

  function withChartSystem(chart, system) {
    if (!chart || typeof chart !== "object") return null;
    const copy = Object.assign({}, chart);
    const requested = system == null ? copy.chartSystem : system;
    copy.chartSystem =
      String(requested || "modern").toLowerCase() === "traditional"
        ? "traditional"
        : "modern";
    return copy;
  }

  function profileSaveDecision(previousChart, nextChart) {
    const identityChanged =
      chartKeyFromChart(previousChart) !== chartKeyFromChart(nextChart);
    return {
      identityChanged: identityChanged,
      clearHistory: identityChanged,
      clearRoutingState: identityChanged,
      clearPendingFollowUps: identityChanged,
      clearChartSummary: identityChanged,
      preserveRoutingState: !identityChanged,
    };
  }

  /**
   * Apply a profile save to chart identity fields.
   * Name and other non-chart fields stay on the caller.
   * Routing, history, and follow-up chips stay when the chart key is unchanged.
   */
  function applyProfileIdentitySave(profile, previousChart, nextChart, nextSystem) {
    const source = profile && typeof profile === "object" ? profile : {};
    const decision = profileSaveDecision(
      withChartSystem(previousChart, source.chartSystem),
      withChartSystem(nextChart, nextSystem),
    );
    const next = Object.assign({}, source);
    next.chartSystem =
      String(nextSystem || "modern").toLowerCase() === "traditional"
        ? "traditional"
        : "modern";
    next.birthChartData = nextChart;
    if (decision.identityChanged) {
      next.conversationHistory = [];
      next.routingState = null;
      next.pendingFollowUps = [];
      next.chartSummary = null;
    }
    return { profile: next, decision: decision };
  }

  function inFlightWriteTarget(request) {
    const profileExists = !!(request && request.profileExists);
    const generationOk =
      !!request && request.currentGeneration === request.generation;
    const requestKey =
      request && request.requestChartKey ? String(request.requestChartKey) : "";
    const profileKey =
      request && request.profileChartKey ? String(request.profileChartKey) : "";
    const chartOk = !requestKey || requestKey === profileKey;
    const write = profileExists && generationOk && chartOk;
    const render =
      write && !!request && request.activeProfileId === request.profileId;
    return { write: write, render: render };
  }

  function clearedConversationPatch() {
    return {
      conversationHistory: [],
      routingState: null,
      pendingFollowUps: [],
    };
  }

  return {
    chartKeyFromChart: chartKeyFromChart,
    withChartSystem: withChartSystem,
    profileSaveDecision: profileSaveDecision,
    applyProfileIdentitySave: applyProfileIdentitySave,
    inFlightWriteTarget: inFlightWriteTarget,
    clearedConversationPatch: clearedConversationPatch,
  };
});
