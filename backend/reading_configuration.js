/**
 * Authoritative reading configuration.
 * Register, planetary framework, and optional bodies are independent.
 * Chart math consumes the framework and the active body set.
 * Register is presentation only and is not applied inside chart calculation.
 *
 * Rulership policy: both Modern and Traditional use the classical rulers
 * already computed in chart architecture (Aquarius→Saturn, Scorpio→Mars,
 * Pisces→Jupiter). Modern mode adds Uranus, Neptune, and Pluto as bodies.
 * It does not make them sign rulers.
 *
 * Asteroid policy: only chart.selectedAsteroids is enabled. A stored
 * position is not an enablement. Traditional mode is the seven classical
 * bodies, so it forces the active asteroid set to empty. That matches the
 * existing traditional chart view.
 *
 * Asteroid weight: they are supporting modifiers. Dominant-planet scores
 * ignore aspects that are not planet-to-planet. Placement ranking multiplies
 * an asteroid signal by ASTEROID_SUPPORTING_WEIGHT so extra asteroid aspects
 * do not crowd out the planetary architecture. Enabled asteroids may still
 * appear in their own condition list, and in a stellium or configuration
 * when the existing detector includes them.
 */

const { normalizeAsteroidList, ASTEROID_KEYS } = require("./chart_format");
const {
  isTraditionalChart,
  applyTraditionalChartView,
  OUTER_PLANET_KEYS,
  TRADITIONAL_PLANET_KEYS,
} = require("./traditional_chart");

const ASTEROID_SUPPORTING_WEIGHT = 0.5;

const BODY_LABELS = {
  uranus: "Uranus",
  neptune: "Neptune",
  pluto: "Pluto",
  chiron: "Chiron",
  ceres: "Ceres",
  pallas: "Pallas",
  juno: "Juno",
  vesta: "Vesta",
};

function registerOf(value) {
  return String(value || "").toLowerCase() === "advanced" ? "advanced" : "beginner";
}

function requestedAsteroids(chart) {
  if (!chart || !Array.isArray(chart.selectedAsteroids)) return [];
  return normalizeAsteroidList(chart.selectedAsteroids);
}

function readingConfiguration(input) {
  const source = input || {};
  const chart = source.chart || source.birthChart || source;
  const framework = isTraditionalChart(chart) ? "traditional" : "modern";
  const requested = requestedAsteroids(chart);
  const activeAsteroids = framework === "traditional" ? [] : requested.slice();
  const unknown = !!(chart && chart.unknownBirthTime);
  const timed = !unknown;
  return {
    register: registerOf(source.register || source.preferredMode),
    framework: framework,
    rulership: "classical",
    bodies: {
      classical: true,
      outerPlanets: framework === "modern",
      asteroids: activeAsteroids.slice(),
    },
    allowOuterPlanets: framework === "modern",
    allowAsteroids: activeAsteroids.length > 0,
    activeAsteroids: activeAsteroids,
    requestedAsteroids: requested,
    unknownBirthTime: unknown,
    canUseHouses: timed,
    canUseAscendant: timed,
    canUseMC: timed,
    canUseHouseRulers: timed,
    canUseAngularHouses: timed,
    canUseSect: timed,
  };
}

function aspectAllowed(aspect, allowed) {
  const left = String((aspect && aspect.planet1) || "").toLowerCase();
  const right = String((aspect && aspect.planet2) || "").toLowerCase();
  return allowed.has(left) && allowed.has(right);
}

/**
 * Chart view used for architecture, facts, and factual answers.
 * Does not change positions of bodies that remain active.
 */
function applyActiveBodyView(chart) {
  if (!chart || typeof chart !== "object") return chart;
  if (isTraditionalChart(chart)) {
    const view = applyTraditionalChartView(chart);
    view.selectedAsteroids = [];
    return view;
  }
  const active = requestedAsteroids(chart);
  const asteroids = {};
  active.forEach(function (key) {
    if (chart.asteroids && chart.asteroids[key]) asteroids[key] = chart.asteroids[key];
  });
  const allowed = new Set(TRADITIONAL_PLANET_KEYS.concat(OUTER_PLANET_KEYS, active));
  return Object.assign({}, chart, {
    chartSystem: "modern",
    asteroids: asteroids,
    selectedAsteroids: active,
    aspects: (chart.aspects || []).filter(function (aspect) {
      return aspectAllowed(aspect, allowed);
    }),
    architecture: undefined,
    architectureTraditional: undefined,
  });
}

function namesInMessage(message) {
  const found = String(message || "").toLowerCase().match(
    /\b(uranus|neptune|pluto|chiron|ceres|pallas|juno|vesta)\b/g,
  );
  if (!found) return [];
  return found.filter(function (name, index) {
    return found.indexOf(name) === index;
  });
}

function unavailableBodyReply(message, config) {
  const reading = config || readingConfiguration({});
  const names = namesInMessage(message);
  if (!names.length) return null;
  if (reading.framework === "traditional") {
    return (
      "This reading is using the traditional seven—Sun, Moon, Mercury, Venus, Mars, Jupiter, and Saturn. " +
      "Uranus, Neptune, Pluto, and the modern asteroids are not part of this chart. " +
      "Switch to Modern if you want those bodies included."
    );
  }
  const missing = names.filter(function (name) {
    if (OUTER_PLANET_KEYS.indexOf(name) !== -1) return !reading.allowOuterPlanets;
    if (ASTEROID_KEYS.indexOf(name) !== -1) {
      return reading.activeAsteroids.indexOf(name) === -1;
    }
    return false;
  });
  if (!missing.length) return null;
  const labels = missing.map(function (name) {
    return BODY_LABELS[name] || name;
  });
  if (labels.length === 1) {
    return labels[0] + " isn't included in this chart configuration.";
  }
  return (
    labels.slice(0, -1).join(", ") +
    " and " +
    labels[labels.length - 1] +
    " aren't included in this chart configuration."
  );
}

function formatActiveBodies(config) {
  const reading = config || readingConfiguration({});
  const asteroids = reading.activeAsteroids.length
    ? reading.activeAsteroids
        .map(function (name) {
          return BODY_LABELS[name] || name;
        })
        .join(", ")
    : "none";
  return (
    "Framework: " +
    reading.framework +
    ". Register does not change these bodies. " +
    "Rulership is the classical scheme already in the architecture (Aquarius→Saturn, Scorpio→Mars, Pisces→Jupiter). " +
    (reading.allowOuterPlanets
      ? "Uranus, Neptune, and Pluto are bodies in this chart, not sign rulers. "
      : "Uranus, Neptune, and Pluto are not in this chart. ") +
    "Active asteroids: " +
    asteroids +
    ". Asteroids are supporting modifiers with less weight than planets. Do not discuss a body that is not active."
  );
}

function isAsteroidName(name) {
  return ASTEROID_KEYS.indexOf(String(name || "").toLowerCase()) !== -1;
}

/**
 * The same reading setup the chat route uses.
 * Matches the frontend payload: birthChart plus chartSystem and profileMemory.preferredMode.
 * Register does not change the chart view. Framework and selectedAsteroids do.
 */
function resolveChatReading(body) {
  const source = body || {};
  const birthChart = source.birthChart;
  const chartSystem =
    String(
      source.chartSystem || (birthChart && birthChart.chartSystem) || "modern",
    ).toLowerCase() === "traditional"
      ? "traditional"
      : "modern";
  if (birthChart && typeof birthChart === "object") {
    birthChart.chartSystem = chartSystem;
  }
  const profileMemory = source.profileMemory || null;
  const readingConfig = readingConfiguration({
    chart: birthChart,
    register:
      profileMemory && profileMemory.preferredMode === "advanced"
        ? "advanced"
        : "beginner",
  });
  return {
    chartSystem: chartSystem,
    profileMemory: profileMemory,
    readingConfig: readingConfig,
    readingChart: birthChart ? applyActiveBodyView(birthChart) : birthChart,
  };
}

module.exports = {
  ASTEROID_SUPPORTING_WEIGHT,
  readingConfiguration,
  applyActiveBodyView,
  unavailableBodyReply,
  formatActiveBodies,
  isAsteroidName,
  resolveChatReading,
};
