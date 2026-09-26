const {
  calculateBirthChartSwiss,
} = require("./swisseph_birth_chart");
const {
  calculateBirthChartAstrologyApi,
} = require("./astrology_api_birth_chart");

async function calculateNatalChart(params) {
  const forced = String(process.env.CHART_ENGINE || "")
    .trim()
    .toLowerCase();

  if (forced === "astrologyapi") {
    console.log("[CHART] Using AstrologyAPI.com (CHART_ENGINE=astrologyapi)");
    const chart = await calculateBirthChartAstrologyApi(params);
    chart.chartEngine = "astrologyapi";
    return chart;
  }

  try {
    const chart = calculateBirthChartSwiss(params);
    if (!chart || !chart.planets || !chart.planets.sun) {
      throw new Error("Swiss Ephemeris returned an incomplete chart");
    }
    console.log("[CHART] Calculated with Swiss Ephemeris");
    chart.chartEngine = "swisseph";
    return chart;
  } catch (err) {
    console.warn(
      "[CHART] Swiss Ephemeris failed, falling back to AstrologyAPI.com:",
      err && err.message,
    );
    const chart = await calculateBirthChartAstrologyApi(params);
    chart.chartEngine = "astrologyapi";
    return chart;
  }
}

module.exports = { calculateNatalChart };
