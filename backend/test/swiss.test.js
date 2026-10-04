const assert = require("assert");
const { calculateNatalChart } = require("../birth_chart_service");
const { buildChartArchitecture } = require("../chart_architecture");

function near(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 0.02,
    actual + " not near " + expected,
  );
}

async function test() {
  const chart = await calculateNatalChart({
    year: 2000,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    latitude: 51.5,
    longitude: 0,
    timezone: 0,
  });
  assert.equal(chart.planets.sun.sign, "Capricorn");
  near(chart.planets.sun.degree, 280.3689);
  assert.equal(chart.planets.sun.house, 10);
  assert.equal(chart.planets.sun.isRetrograde, false);
  assert.equal(chart.planets.moon.sign, "Scorpio");
  near(chart.planets.moon.degree, 223.3238);
  assert.equal(chart.planets.moon.house, 7);
  assert.equal(chart.planets.mercury.sign, "Capricorn");
  assert.equal(chart.planets.mercury.isRetrograde, false);
  assert.equal(chart.angles.ascendant.sign, "Aries");
  near(chart.angles.ascendant.degree, 24.2873);
  assert.equal(chart.angles.midheaven.sign, "Capricorn");
  near(chart.angles.midheaven.degree, 279.6111);
  assert.equal(chart.houses.length, 12);
  assert.equal(chart.houses[0].sign, "Aries");
  near(chart.houses[0].degree, 24.2873);
  assert.equal(chart.houses[9].number, 10);
  const sextile = chart.aspects.filter(function (item) {
    return item.planet1 === "sun" && item.planet2 === "moon";
  })[0];
  assert.equal(sextile.aspect, "sextile");
  near(sextile.orb, 2.9548);

  const arch = buildChartArchitecture(chart);
  assert.equal(arch.chartRuler.planet, "mars");
  assert.equal(arch.planetConditions.sun.house, 10);
  const annotated = arch.aspectsAnnotated.filter(function (item) {
    return (
      (item.planet1 === "sun" && item.planet2 === "moon") ||
      (item.planet1 === "moon" && item.planet2 === "sun")
    );
  })[0];
  assert.equal(annotated.aspect, "sextile");
  assert.equal(typeof annotated.applying, "boolean");
}

module.exports = test;
