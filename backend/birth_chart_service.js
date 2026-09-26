const {
  calculateBirthChartSwiss,
} = require("./swisseph_birth_chart");
const {
  calculateBirthChartAstrologyApi,
} = require("./astrology_api_birth_chart");
const { applyUnknownBirthTimeOverlay } = require("./chart_format");

async function calculateNatalChart(params) {
  const forced = String(process.env.CHART_ENGINE || "")
    .trim()
    .toLowerCase();

  function finish(chart, engine) {
    if (chart) chart.chartEngine = engine;
    if (chart && params && params.unknownBirthTime) {
      applyUnknownBirthTimeOverlay(chart);
    }
    return chart;
  }

  if (forced === "astrologyapi") {
    console.log("[CHART] Using AstrologyAPI.com (CHART_ENGINE=astrologyapi)");
    const chart = await calculateBirthChartAstrologyApi(params);
    return finish(chart, "astrologyapi");
  }

  try {
    const chart = calculateBirthChartSwiss(params);
    if (!chart || !chart.planets || !chart.planets.sun) {
      throw new Error("Swiss Ephemeris returned an incomplete chart");
    }
    console.log("[CHART] Calculated with Swiss Ephemeris");
    return finish(chart, "swisseph");
  } catch (err) {
    console.warn(
      "[CHART] Swiss Ephemeris failed, falling back to AstrologyAPI.com:",
      err && err.message,
    );
    const chart = await calculateBirthChartAstrologyApi(params);
    return finish(chart, "astrologyapi");
  }
}

module.exports = { calculateNatalChart };
