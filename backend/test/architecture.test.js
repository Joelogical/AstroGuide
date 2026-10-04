const assert = require("assert");
const { buildChartArchitecture } = require("../chart_architecture");
const { chartCapabilities } = require("../chart_capabilities");
const { timedChart, unknownTimeChart, traditionalChart } = require("./fixtures");

function test() {
  const arch = buildChartArchitecture(timedChart());
  assert.equal(arch.ok, true);
  assert.equal(arch.planetConditions.saturn.dignity, "domicile");
  assert.equal(arch.planetConditions.mercury.retrograde, true);
  assert.equal(arch.chartRuler && arch.chartRuler.planet, "saturn");
  assert.ok(arch.configurations.tSquares.length >= 1);
  assert.equal(arch.planetConditions.saturn.houseClass, "angular");
  const opposition = arch.aspectsAnnotated.filter(function (item) {
    return item.aspect === "opposition";
  })[0];
  assert.ok(opposition);
  assert.equal(opposition.orb, 0.4);
  assert.equal(opposition.applying, false);
  assert.ok(arch.dispositors);
  const caps = chartCapabilities(arch);
  assert.equal(caps.canUseHouses, true);
  assert.equal(caps.canUseAscendant, true);
  assert.equal(caps.allowOuterPlanets, true);

  const unknown = buildChartArchitecture(unknownTimeChart());
  const unknownCaps = chartCapabilities(unknown);
  assert.equal(unknownCaps.canUseHouses, false);
  assert.equal(unknownCaps.canUseAscendant, false);
  assert.equal(unknownCaps.canUseMC, false);
  assert.equal(unknownCaps.canUseHouseRulers, false);
  assert.equal(unknown.chartRuler, null);
  assert.equal(unknown.angleAspects.length, 0);

  const traditional = buildChartArchitecture(traditionalChart());
  const traditionalCaps = chartCapabilities(traditional);
  assert.equal(traditionalCaps.chartSystem, "traditional");
  assert.equal(traditionalCaps.allowOuterPlanets, false);
  assert.equal(traditional.planetConditions.uranus, undefined);
}

module.exports = test;
