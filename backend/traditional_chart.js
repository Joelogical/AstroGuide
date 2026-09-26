/**
 * Traditional chart system: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn
 * and classical rulerships only. Outer planets and modern asteroids are
 * omitted from architecture, ranking, and interpretation.
 */

const TRADITIONAL_PLANET_KEYS = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
];

const OUTER_PLANET_KEYS = ["uranus", "neptune", "pluto"];

const TRADITIONAL_SIGN_RULERS = {
  Aries: "mars",
  Taurus: "venus",
  Gemini: "mercury",
  Cancer: "moon",
  Leo: "sun",
  Virgo: "mercury",
  Libra: "venus",
  Scorpio: "mars",
  Sagittarius: "jupiter",
  Capricorn: "saturn",
  Aquarius: "saturn",
  Pisces: "jupiter",
};

function isTraditionalChart(chartOrRuntime) {
  const system =
    (chartOrRuntime && chartOrRuntime.chartSystem) ||
    (chartOrRuntime &&
      chartOrRuntime.birthChart &&
      chartOrRuntime.birthChart.chartSystem);
  return String(system || "").toLowerCase() === "traditional";
}

function isTraditionalPlanetKey(name) {
  return TRADITIONAL_PLANET_KEYS.includes(String(name || "").toLowerCase());
}

function isOuterPlanetKey(name) {
  return OUTER_PLANET_KEYS.includes(String(name || "").toLowerCase());
}

function isTraditionalAspect(aspect) {
  if (!aspect) return false;
  return (
    isTraditionalPlanetKey(aspect.planet1) &&
    isTraditionalPlanetKey(aspect.planet2)
  );
}

function applyTraditionalChartView(chart) {
  if (!chart || typeof chart !== "object") return chart;
  const planets = Object.assign({}, chart.planets || {});
  OUTER_PLANET_KEYS.forEach(function (key) {
    delete planets[key];
  });
  return Object.assign({}, chart, {
    chartSystem: "traditional",
    planets: planets,
    asteroids: {},
    aspects: (chart.aspects || []).filter(isTraditionalAspect),
    architecture: undefined,
    architectureTraditional: undefined,
  });
}

function modernOnlyBodyKeys(chart) {
  const keys = [];
  const planets = (chart && chart.planets) || {};
  OUTER_PLANET_KEYS.forEach(function (key) {
    if (planets[key] && (planets[key].sign || planets[key].degree != null)) {
      keys.push(key);
    }
  });
  const asteroids = (chart && chart.asteroids) || {};
  Object.keys(asteroids).forEach(function (key) {
    const body = asteroids[key];
    if (body && (body.sign || body.degree != null)) keys.push(key);
  });
  return keys;
}

function traditionalMissingBodyReply(message, chart) {
  if (!isTraditionalChart(chart)) return null;
  if (
    !/\b(uranus|neptune|pluto|chiron|ceres|pallas|juno|vesta)\b/i.test(
      String(message || ""),
    )
  ) {
    return null;
  }
  return (
    "This reading is using the traditional seven—Sun, Moon, Mercury, Venus, Mars, Jupiter, and Saturn. " +
    "Uranus, Neptune, Pluto, and the modern asteroids are not part of this chart. " +
    "Switch to Modern if you want those bodies included."
  );
}

function getTraditionalChartRules() {
  return (
    "TRADITIONAL CHART SYSTEM (EXCLUSIVE): This reading uses only the seven classical bodies: Sun, Moon, Mercury, Venus, Mars, Jupiter, and Saturn. " +
    "Uranus, Neptune, Pluto, Chiron, and the modern asteroids are not in this chart. Do not mention them, do not imply they are “also there,” and do not use them as rulers, dispositors, or aspect partners.\n\n" +
    "CLASSICAL RULERSHIPS ONLY: Aries→Mars, Taurus→Venus, Gemini→Mercury, Cancer→Moon, Leo→Sun, Virgo→Mercury, Libra→Venus, Scorpio→Mars (never Pluto), Sagittarius→Jupiter, Capricorn→Saturn, Aquarius→Saturn (never Uranus), Pisces→Jupiter (never Neptune). " +
    "Chart ruler, house rulers, and dispositor chains must stay on these rulers.\n\n" +
    "VOICE AND PREFERENCES STILL APPLY: Traditional mode only changes which planets are in the chart. It does not change language level or sensitivity, and it still does not predict events. Follow PROFILE MEMORY: beginner stays plain; advanced stays expert-analytical (classical dignity, reception, and house rulers used as working terms, not taught). Softer language and focus on strengths still bind. Do not sound archaic for its own sake.\n\n" +
    "If a question would normally pull an outer planet or asteroid, answer from the traditional planet that covers that life area (Mars for Scorpio intensity, Saturn for Aquarius distance and structure, Jupiter for Pisces faith and overflow)."
  );
}

module.exports = {
  TRADITIONAL_PLANET_KEYS,
  OUTER_PLANET_KEYS,
  TRADITIONAL_SIGN_RULERS,
  isTraditionalChart,
  isTraditionalPlanetKey,
  isOuterPlanetKey,
  isTraditionalAspect,
  applyTraditionalChartView,
  modernOnlyBodyKeys,
  traditionalMissingBodyReply,
  getTraditionalChartRules,
};
