/**
 * One capability reading for a computed architecture.
 * Houses and angles exist only when that architecture says the birth time
 * is known. Outer planets exist only when the architecture is not traditional.
 * A placeholder Ascendant is not a capability.
 */

function unknownBirthTimeOf(source) {
  return !!(source && source.unknownBirthTime);
}

function chartCapabilities(source) {
  const usable = !!(source && source.ok);
  const unknown = unknownBirthTimeOf(source);
  const timed = usable && !unknown;
  const traditional =
    source && String(source.chartSystem || "").toLowerCase() === "traditional";
  return {
    chartSystem: traditional ? "traditional" : "modern",
    unknownBirthTime: unknown,
    canUseHouses: timed,
    canUseAscendant: timed,
    canUseMC: timed,
    canUseHouseRulers: timed,
    canUseAngularHouses: timed,
    canUseSect: timed,
    allowOuterPlanets: !traditional,
  };
}

module.exports = {
  chartCapabilities,
};
