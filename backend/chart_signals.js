/**
 * Chart signal ranking and weighting
 * Scores signals by: essential strength, house relevance, aspect orb, repetition, relevance to question.
 * Returns only the highest-value points so the model gives 3 strongest reasons, 2 biggest caveats, timing context—not 25 scattered facts.
 */

const { getAspectStyle } = require("./astrology_rules");

function getChartRuler(ascendantSign) {
  const rulers = {
    Aries: "mars", Taurus: "venus", Gemini: "mercury", Cancer: "moon", Leo: "sun",
    Virgo: "mercury", Libra: "venus", Scorpio: "mars", Sagittarius: "jupiter",
    Capricorn: "saturn", Aquarius: "saturn", Pisces: "jupiter",
  };
  return rulers[ascendantSign] || "sun";
}

// Essential dignity multipliers (planet in sign -> strength)
// Domicile = 1.25, Exaltation = 1.2, Detriment = 0.85, Fall = 0.8, Peregrine = 1.0
const DIGNITY = {
  sun:    { Leo: 1.25, Aries: 1.2, Aquarius: 0.85, Libra: 0.8 },
  moon:   { Cancer: 1.25, Taurus: 1.2, Capricorn: 0.85, Scorpio: 0.8 },
  mercury:{ Gemini: 1.25, Virgo: 1.25, Sagittarius: 0.85, Pisces: 0.85, Virgo: 1.25 },
  venus:  { Taurus: 1.25, Libra: 1.25, Pisces: 1.2, Aries: 0.85, Scorpio: 0.85, Virgo: 0.8 },
  mars:   { Aries: 1.25, Scorpio: 1.25, Capricorn: 1.2, Libra: 0.85, Taurus: 0.85, Cancer: 0.8 },
  jupiter:{ Sagittarius: 1.25, Pisces: 1.25, Cancer: 1.2, Gemini: 0.85, Virgo: 0.85, Capricorn: 0.8 },
  saturn: { Capricorn: 1.25, Aquarius: 1.25, Libra: 1.2, Cancer: 0.85, Leo: 0.85, Aries: 0.8 },
  uranus: { Aquarius: 1.2, Scorpio: 1.1, Leo: 0.9, Taurus: 0.9 },
  neptune:{ Pisces: 1.2, Cancer: 1.1, Virgo: 0.9, Capricorn: 0.9 },
  pluto:  { Scorpio: 1.2, Aries: 1.0, Taurus: 0.9, Leo: 0.9 },
};

function getEssentialStrength(planetName, sign) {
  if (!sign) return 1.0;
  const key = planetName.toLowerCase();
  const signKey = sign.charAt(0).toUpperCase() + sign.slice(1).toLowerCase();
  const map = DIGNITY[key];
  if (!map) return 1.0;
  return map[signKey] || 1.0;
}

// Angular (1,4,7,10) = strongest; Succedent (2,5,8,11); Cadent (3,6,9,12)
const HOUSE_STRENGTH = {
  1: 1.25, 2: 1.1, 3: 1.0, 4: 1.25, 5: 1.1, 6: 1.0,
  7: 1.25, 8: 1.1, 9: 1.0, 10: 1.25, 11: 1.1, 12: 1.0,
};

function getHouseRelevance(houseNumber) {
  if (houseNumber == null || houseNumber === undefined) return 1.0;
  const n = Number(houseNumber);
  return HOUSE_STRENGTH[n] != null ? HOUSE_STRENGTH[n] : 1.0;
}

// Tighter orb = stronger aspect
function getOrbStrength(orb) {
  if (orb == null || typeof orb !== "number") return 1.0;
  if (orb <= 1) return 1.3;
  if (orb <= 2.5) return 1.2;
  if (orb <= 4) return 1.1;
  if (orb <= 6) return 1.0;
  return 0.9;
}

// Planet importance for weighting (luminaries + chart ruler matter more)
function getPlanetImportance(planetName, chartRuler) {
  const p = planetName.toLowerCase();
  if (p === "sun" || p === "moon") return 1.3;
  if (chartRuler && p === chartRuler.toLowerCase()) return 1.25;
  if (["mercury", "venus", "mars"].includes(p)) return 1.1;
  return 1.0;
}

/**
 * Build and score all chart signals, then return only the top-ranked ones.
 * @param {object} birthChart - Birth chart with planets, houses, aspects, angles
 * @param {string} userMessage - Optional; used for relevance-to-question boosting
 * @param {object} transits - Optional; current transits for timing context
 * @returns {{ prioritizedBlock: string, topStrengths: string[], topCaveats: string[], timingContext: string }}
 */
function getPrioritizedChartPoints(birthChart, userMessage = "", transits = null) {
  const signals = [];
  const chartRuler = birthChart.angles?.ascendant?.sign
    ? getChartRuler(birthChart.angles.ascendant.sign)
    : null;

  // ---- Planets in sign/house ----
  const planets = birthChart.planets || {};
  for (const [name, data] of Object.entries(planets)) {
    if (!data || data.sign == null) continue;
    const essential = getEssentialStrength(name, data.sign);
    const houseRel = getHouseRelevance(data.house);
    const importance = getPlanetImportance(name, chartRuler);
    const score = essential * houseRel * importance;
    const isChallenging = essential < 1;
    signals.push({
      type: "placement",
      text: `${name.charAt(0).toUpperCase() + name.slice(1)} in ${data.sign} (House ${data.house || "?"})`,
      score,
      category: isChallenging ? "caveat" : "strength",
      planet: name,
    });
  }

  // ---- Aspects ----
  const aspects = birthChart.aspects || [];
  const styleByTension = { high: "challenging", low: "harmonious", medium: "mixed", neutral: "neutral" };
  for (const a of aspects) {
    const style = getAspectStyle(a.aspect);
    const orbStrength = getOrbStrength(a.orb);
    const aspectBase = (style.strength || 0.5) * 1.2;
    const score = orbStrength * aspectBase;
    const category = style.tension === "high" ? "caveat" : "strength";
    const p1 = (a.planet1 || "").charAt(0).toUpperCase() + (a.planet1 || "").slice(1);
    const p2 = (a.planet2 || "").charAt(0).toUpperCase() + (a.planet2 || "").slice(1);
    const orbStr = a.orb != null ? ` (${Number(a.orb).toFixed(1)}° orb)` : "";
    signals.push({
      type: "aspect",
      text: `${p1} ${a.aspect} ${p2}${orbStr}`,
      score,
      category,
      planet: [a.planet1, a.planet2],
    });
  }

  // ---- Angles ----
  const angles = birthChart.angles || {};
  if (angles.ascendant?.sign) {
    signals.push({
      type: "angle",
      text: `Ascendant in ${angles.ascendant.sign}`,
      score: 1.25,
      category: "strength",
      planet: "ascendant",
    });
  }
  if (angles.midheaven?.sign) {
    signals.push({
      type: "angle",
      text: `Midheaven in ${angles.midheaven.sign}`,
      score: 1.2,
      category: "strength",
      planet: "midheaven",
    });
  }

  // ---- Repetition: boost signals that share a planet ----
  const planetCount = {};
  signals.forEach((s) => {
    const planetsInSignal = Array.isArray(s.planet) ? s.planet : [s.planet];
    planetsInSignal.forEach((p) => {
      if (p) planetCount[p] = (planetCount[p] || 0) + 1;
    });
  });
  signals.forEach((s) => {
    const planetsInSignal = Array.isArray(s.planet) ? s.planet : [s.planet];
    let repBonus = 1.0;
    planetsInSignal.forEach((p) => {
      if (planetCount[p] >= 2) repBonus += 0.08;
    });
    s.score *= repBonus;
  });

  // ---- Relevance to question (simple keyword boost) ----
  const lowerMsg = (userMessage || "").toLowerCase();
  const topicBoost = {
    career: ["midheaven", "saturn", "capricorn", "10th"],
    love: ["venus", "mars", "moon", "libra", "7th"],
    money: ["jupiter", "saturn", "2nd", "8th"],
    communication: ["mercury", "3rd"],
    family: ["moon", "cancer", "4th"],
    identity: ["sun", "ascendant", "1st"],
  };
  signals.forEach((s) => {
    let boost = 1.0;
    for (const [topic, keywords] of Object.entries(topicBoost)) {
      if (lowerMsg.includes(topic) && keywords.some((k) => s.text.toLowerCase().includes(k))) {
        boost = 1.15;
        break;
      }
    }
    s.score *= boost;
  });

  // ---- Split and sort ----
  const strengths = signals.filter((s) => s.category === "strength").sort((a, b) => b.score - a.score);
  const caveats = signals.filter((s) => s.category === "caveat").sort((a, b) => b.score - a.score);

  const topStrengths = strengths.slice(0, 5).map((s) => s.text);
  const topCaveats = caveats.slice(0, 4).map((s) => s.text);

  const prioritizedBlock = [
    "--- PRIORITIZED CHART POINTS (use these first; do not list 25 scattered facts) ---",
    "",
    "TOP STRENGTHS (emphasize these as the main reasons something is likely):",
    ...topStrengths.map((t, i) => `${i + 1}. ${t}`),
    "",
    "TOP CAVEATS (mention these as the main cautions or tensions):",
    ...topCaveats.map((t, i) => `${i + 1}. ${t}`),
    "",
    "--- END PRIORITIZED CHART POINTS ---",
  ].join("\n");

  return {
    prioritizedBlock,
    topStrengths,
    topCaveats,
  };
}

module.exports = {
  getPrioritizedChartPoints,
  getEssentialStrength,
  getHouseRelevance,
  getOrbStrength,
};
