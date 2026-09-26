// Shared natal-chart formatting used by Swiss Ephemeris and the AstrologyAPI backup.

const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

const ELEMENTS = {
  Aries: "Fire",
  Leo: "Fire",
  Sagittarius: "Fire",
  Taurus: "Earth",
  Virgo: "Earth",
  Capricorn: "Earth",
  Gemini: "Air",
  Libra: "Air",
  Aquarius: "Air",
  Cancer: "Water",
  Scorpio: "Water",
  Pisces: "Water",
};

function normalizeDegree(degree) {
  return ((Number(degree) % 360) + 360) % 360;
}

function getSignFromDegree(degree) {
  const normalizedDegree = normalizeDegree(degree);
  return SIGNS[Math.floor(normalizedDegree / 30)] || "Unknown";
}

function getElementFromSign(sign) {
  return ELEMENTS[sign] || "Unknown";
}

function houseForLongitude(longitude, cusps) {
  const lon = normalizeDegree(longitude);
  for (let i = 0; i < 12; i++) {
    const start = normalizeDegree(cusps[i]);
    const end = normalizeDegree(cusps[(i + 1) % 12]);
    if (start < end) {
      if (lon >= start && lon < end) return i + 1;
    } else if (lon >= start || lon < end) {
      return i + 1;
    }
  }
  return 1;
}

const ASTEROID_KEYS = ["chiron", "ceres", "pallas", "juno", "vesta"];

function normalizeAsteroidList(list) {
  if (!Array.isArray(list)) return [];
  return [
    ...new Set(
      list
        .map((s) => String(s || "").toLowerCase().trim())
        .filter((k) => ASTEROID_KEYS.includes(k)),
    ),
  ];
}

function calculateAspects(planets, options) {
  const aspects = [];
  const major = {
    conjunction: { angle: 0, orb: 8 },
    sextile: { angle: 60, orb: 6 },
    square: { angle: 90, orb: 8 },
    trine: { angle: 120, orb: 8 },
    opposition: { angle: 180, orb: 8 },
  };
  const minor = {
    semisextile: { angle: 30, orb: 2.5 },
    semisquare: { angle: 45, orb: 2 },
    sesquiquadrate: { angle: 135, orb: 2 },
    quincunx: { angle: 150, orb: 2.5 },
  };
  const aspectOrbs = { ...major, ...minor };
  const planetNames = Object.keys(planets);
  const tightKeys = new Set(
    ((options && options.tightOrbKeys) || []).map((k) =>
      String(k).toLowerCase(),
    ),
  );
  const tightOrb = (options && Number(options.tightOrb)) || 3;

  for (let i = 0; i < planetNames.length; i++) {
    for (let j = i + 1; j < planetNames.length; j++) {
      const planet1 = planetNames[i];
      const planet2 = planetNames[j];
      const angle1 = planets[planet1];
      const angle2 = planets[planet2];
      let angle = Math.abs(angle1 - angle2);
      if (angle > 180) angle = 360 - angle;

      for (const [aspectName, { angle: targetAngle, orb }] of Object.entries(
        aspectOrbs,
      )) {
        const pairOrb =
          tightKeys.has(planet1) || tightKeys.has(planet2)
            ? Math.min(orb, tightOrb)
            : orb;
        if (Math.abs(angle - targetAngle) <= pairOrb) {
          aspects.push({
            planet1,
            planet2,
            aspect: aspectName,
            angle: Math.abs(angle1 - angle2),
            orb: Math.abs(angle - targetAngle),
          });
          break;
        }
      }
    }
  }
  return aspects;
}

function decorateAspects(aspects, planetByName) {
  return aspects.map((aspect) => {
    const p1 = planetByName[aspect.planet1];
    const p2 = planetByName[aspect.planet2];
    return {
      ...aspect,
      planet1Sign: p1 && p1.sign,
      planet2Sign: p2 && p2.sign,
      planet1Element: getElementFromSign(p1 && p1.sign),
      planet2Element: getElementFromSign(p2 && p2.sign),
    };
  });
}

module.exports = {
  SIGNS,
  ASTEROID_KEYS,
  normalizeAsteroidList,
  getSignFromDegree,
  getElementFromSign,
  houseForLongitude,
  normalizeDegree,
  calculateAspects,
  decorateAspects,
};
