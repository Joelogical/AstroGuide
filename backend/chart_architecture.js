/**
 * Computed natal architecture: relationships and condition, not keyword banks.
 * Built once when a chart is created (and again for older saved charts) so
 * interpretations can start from one specific skeleton.
 */

const { ASTEROID_KEYS } = require("./chart_format");

const SIGN_RULERS = {
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

const DIGNITY = {
  sun: { domicile: ["Leo"], exaltation: ["Aries"], detriment: ["Aquarius"], fall: ["Libra"] },
  moon: { domicile: ["Cancer"], exaltation: ["Taurus"], detriment: ["Capricorn"], fall: ["Scorpio"] },
  mercury: {
    domicile: ["Gemini", "Virgo"],
    exaltation: ["Virgo"],
    detriment: ["Sagittarius", "Pisces"],
    fall: ["Pisces"],
  },
  venus: {
    domicile: ["Taurus", "Libra"],
    exaltation: ["Pisces"],
    detriment: ["Aries", "Scorpio"],
    fall: ["Virgo"],
  },
  mars: {
    domicile: ["Aries", "Scorpio"],
    exaltation: ["Capricorn"],
    detriment: ["Libra", "Taurus"],
    fall: ["Cancer"],
  },
  jupiter: {
    domicile: ["Sagittarius", "Pisces"],
    exaltation: ["Cancer"],
    detriment: ["Gemini", "Virgo"],
    fall: ["Capricorn"],
  },
  saturn: {
    domicile: ["Capricorn", "Aquarius"],
    exaltation: ["Libra"],
    detriment: ["Cancer", "Leo"],
    fall: ["Aries"],
  },
};

const MODAL_SIGNS = {
  Aries: "Cardinal",
  Cancer: "Cardinal",
  Libra: "Cardinal",
  Capricorn: "Cardinal",
  Taurus: "Fixed",
  Leo: "Fixed",
  Scorpio: "Fixed",
  Aquarius: "Fixed",
  Gemini: "Mutable",
  Virgo: "Mutable",
  Sagittarius: "Mutable",
  Pisces: "Mutable",
};

const ELEMENT_SIGNS = {
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

const MAJOR_ASPECTS = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
};

const ASPECT_ORBS = {
  conjunction: 8,
  sextile: 6,
  square: 8,
  trine: 8,
  opposition: 8,
  semisextile: 2.5,
  semisquare: 2,
  sesquiquadrate: 2,
  quincunx: 2.5,
};

const PLANET_KEYS = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
];

function titleCase(name) {
  if (!name) return "";
  return String(name).charAt(0).toUpperCase() + String(name).slice(1);
}

function normSign(sign) {
  if (!sign) return "";
  return String(sign).charAt(0).toUpperCase() + String(sign).slice(1).toLowerCase();
}

function normDeg(deg) {
  const n = Number(deg);
  if (!Number.isFinite(n)) return null;
  return ((n % 360) + 360) % 360;
}

function circularSep(a, b) {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

function houseClass(house) {
  const n = Number(house);
  if (!Number.isFinite(n) || n < 1 || n > 12) return null;
  if ([1, 4, 7, 10].includes(n)) return "angular";
  if ([2, 5, 8, 11].includes(n)) return "succedent";
  if ([3, 6, 9, 12].includes(n)) return "cadent";
  return null;
}

function isUnknownBirthTime(chartOrArch) {
  return !!(chartOrArch && chartOrArch.unknownBirthTime);
}

function getDignity(planet, sign) {
  const table = DIGNITY[String(planet || "").toLowerCase()];
  const s = normSign(sign);
  if (!table || !s) return "peregrine";
  if (table.domicile && table.domicile.includes(s)) return "domicile";
  if (table.exaltation && table.exaltation.includes(s)) return "exaltation";
  if (table.detriment && table.detriment.includes(s)) return "detriment";
  if (table.fall && table.fall.includes(s)) return "fall";
  return "peregrine";
}

function getChartRuler(ascendantSign) {
  return SIGN_RULERS[normSign(ascendantSign)] || "sun";
}

function isPlanetKey(name) {
  return PLANET_KEYS.includes(String(name || "").toLowerCase());
}

function isAsteroidKey(name) {
  return ASTEROID_KEYS.includes(String(name || "").toLowerCase());
}

function planetEntries(birthChart) {
  const planets = (birthChart && birthChart.planets) || {};
  return PLANET_KEYS.filter((k) => planets[k] && planets[k].sign).map((k) => [
    k,
    planets[k],
  ]);
}

function asteroidEntries(birthChart) {
  const bodies = (birthChart && birthChart.asteroids) || {};
  return ASTEROID_KEYS.filter(
    (k) => bodies[k] && (bodies[k].sign || bodies[k].degree != null),
  ).map((k) => [k, bodies[k]]);
}

function chartBodyMap(birthChart) {
  return Object.assign(
    {},
    (birthChart && birthChart.planets) || {},
    (birthChart && birthChart.asteroids) || {},
  );
}

function membersIncludeAsteroid(names) {
  return (names || []).some((n) => isAsteroidKey(n));
}

function isMajorAspectName(name) {
  return Object.prototype.hasOwnProperty.call(MAJOR_ASPECTS, String(name || "").toLowerCase());
}

function aspectTargetAngle(name) {
  const key = String(name || "").toLowerCase();
  if (MAJOR_ASPECTS[key] != null) return MAJOR_ASPECTS[key];
  const minors = {
    semisextile: 30,
    semisquare: 45,
    sesquiquadrate: 135,
    quincunx: 150,
  };
  return minors[key];
}

function isApplying(deg1, speed1, deg2, speed2, targetAngle) {
  if (targetAngle == null) return null;
  const a1 = normDeg(deg1);
  const a2 = normDeg(deg2);
  if (a1 == null || a2 == null) return null;
  const s1 = Number(speed1) || 0;
  const s2 = Number(speed2) || 0;
  const orbNow = Math.abs(circularSep(a1, a2) - targetAngle);
  const orbSoon = Math.abs(
    circularSep(a1 + s1 * 0.15, a2 + s2 * 0.15) - targetAngle,
  );
  if (Math.abs(orbSoon - orbNow) < 0.0001) return null;
  return orbSoon < orbNow;
}

function pairKey(a, b) {
  return [String(a).toLowerCase(), String(b).toLowerCase()].sort().join("|");
}

function otherEnd(aspect, planet) {
  const p = String(planet).toLowerCase();
  const a = String(aspect.planet1 || "").toLowerCase();
  const b = String(aspect.planet2 || "").toLowerCase();
  if (a === p) return b;
  if (b === p) return a;
  return null;
}

function lunarPhase(sunDeg, moonDeg) {
  const sun = normDeg(sunDeg);
  const moon = normDeg(moonDeg);
  if (sun == null || moon == null) return null;
  const elong = ((moon - sun) % 360 + 360) % 360;
  let name = "balsamic";
  if (elong < 22.5 || elong >= 337.5) name = "new";
  else if (elong < 67.5) name = "crescent";
  else if (elong < 112.5) name = "first quarter";
  else if (elong < 157.5) name = "gibbous";
  else if (elong < 202.5) name = "full";
  else if (elong < 247.5) name = "disseminating";
  else if (elong < 292.5) name = "last quarter";
  return { name, elongation: Math.round(elong * 10) / 10 };
}

function jonesPattern(longitudes) {
  const sorted = longitudes
    .map(normDeg)
    .filter((n) => n != null)
    .sort((a, b) => a - b);
  const n = sorted.length;
  if (n < 5) return { name: "insufficient data", occupiedSpan: null };
  const gaps = [];
  for (let i = 0; i < n; i++) {
    const next = i === n - 1 ? sorted[0] + 360 : sorted[i + 1];
    gaps.push(next - sorted[i]);
  }
  const maxGap = Math.max.apply(null, gaps);
  const occupied = 360 - maxGap;
  const bigGaps = gaps.filter((g) => g >= 60).length;
  let name = "splay";
  if (occupied <= 120) name = "bundle";
  else if (occupied <= 180) name = "bowl";
  else if (occupied <= 240 && maxGap >= 90) name = "locomotive";
  else if (bigGaps >= 2) name = "seesaw";
  else if (maxGap < 70) name = "splash";
  return { name, occupiedSpan: Math.round(occupied), largestEmpty: Math.round(maxGap) };
}

function findStelliums(entries) {
  const bySign = {};
  const byHouse = {};
  entries.forEach(([name, p]) => {
    const sign = normSign(p.sign);
    const house = Number(p.house);
    if (sign) {
      if (!bySign[sign]) bySign[sign] = [];
      bySign[sign].push(name);
    }
    if (house >= 1 && house <= 12) {
      if (!byHouse[house]) byHouse[house] = [];
      byHouse[house].push(name);
    }
  });
  const signs = Object.entries(bySign)
    .filter(([, list]) => list.length >= 3)
    .map(([sign, planets]) => ({ sign, planets, count: planets.length }));
  const houses = Object.entries(byHouse)
    .filter(([, list]) => list.length >= 3)
    .map(([house, planets]) => ({
      house: Number(house),
      planets,
      count: planets.length,
    }));
  return { signs, houses };
}

function findAngleAspects(birthChart, extraEntries) {
  const angles = (birthChart && birthChart.angles) || {};
  const points = [];
  if (angles.ascendant && angles.ascendant.degree != null) {
    points.push({ name: "ascendant", degree: angles.ascendant.degree });
  }
  if (angles.midheaven && angles.midheaven.degree != null) {
    points.push({ name: "midheaven", degree: angles.midheaven.degree });
  }
  const found = [];
  const bodies = planetEntries(birthChart).concat(extraEntries || []);
  bodies.forEach(([name, p]) => {
    const pd = normDeg(p.degree);
    if (pd == null) return;
    const orbCap = isAsteroidKey(name) ? 3 : null;
    points.forEach((pt) => {
      const ad = normDeg(pt.degree);
      if (ad == null) return;
      const sep = circularSep(pd, ad);
      for (const [aspectName, target] of Object.entries(MAJOR_ASPECTS)) {
        const orb = orbCap != null ? Math.min(ASPECT_ORBS[aspectName], orbCap) : ASPECT_ORBS[aspectName];
        const delta = Math.abs(sep - target);
        if (delta <= orb) {
          found.push({
            planet: name,
            angle: pt.name,
            aspect: aspectName,
            orb: Math.round(delta * 10) / 10,
            applying: isApplying(
              p.degree,
              p.speed,
              pt.degree,
              0,
              target,
            ),
          });
          break;
        }
      }
    });
  });
  return found;
}

function findConfigurations(aspects) {
  const majors = (aspects || []).filter((a) => isMajorAspectName(a.aspect));
  const byType = { opposition: [], square: [], trine: [], sextile: [], conjunction: [] };
  majors.forEach((a) => {
    const t = String(a.aspect).toLowerCase();
    if (byType[t]) byType[t].push(a);
  });
  const linked = (a, b, type) =>
    majors.some(
      (x) =>
        String(x.aspect).toLowerCase() === type &&
        pairKey(x.planet1, x.planet2) === pairKey(a, b),
    );

  const tSquares = [];
  byType.opposition.forEach((opp) => {
    const a = opp.planet1;
    const b = opp.planet2;
    const focals = new Set();
    majors.forEach((x) => {
      if (String(x.aspect).toLowerCase() !== "square") return;
      const otherA = otherEnd(x, a);
      const otherB = otherEnd(x, b);
      if (otherA && linked(otherA, b, "square")) focals.add(otherA);
      if (otherB && linked(otherB, a, "square")) focals.add(otherB);
    });
    focals.forEach((focal) => {
      if (focal === a || focal === b) return;
      tSquares.push({
        type: "t-square",
        opposition: [a, b],
        focal,
        includesAsteroid: membersIncludeAsteroid([a, b, focal]),
      });
    });
  });

  const grandTrines = [];
  const seenTrine = new Set();
  byType.trine.forEach((t1) => {
    const a = t1.planet1;
    const b = t1.planet2;
    byType.trine.forEach((t2) => {
      const c = otherEnd(t2, a);
      if (!c || c === b) return;
      if (!linked(b, c, "trine")) return;
      const key = [a, b, c].map((x) => String(x).toLowerCase()).sort().join("|");
      if (seenTrine.has(key)) return;
      seenTrine.add(key);
      grandTrines.push({
        type: "grand trine",
        planets: [a, b, c],
        includesAsteroid: membersIncludeAsteroid([a, b, c]),
      });
    });
  });

  const bodyNames = new Set();
  majors.forEach((a) => {
    if (a.planet1) bodyNames.add(String(a.planet1).toLowerCase());
    if (a.planet2) bodyNames.add(String(a.planet2).toLowerCase());
  });
  const kites = [];
  grandTrines.forEach((gt) => {
    bodyNames.forEach((extra) => {
      if (gt.planets.some((p) => String(p).toLowerCase() === extra)) return;
      const opposed = gt.planets.find((p) => linked(extra, p, "opposition"));
      if (!opposed) return;
      const others = gt.planets.filter((p) => p !== opposed);
      if (others.every((p) => linked(extra, p, "sextile"))) {
        kites.push({
          type: "kite",
          grandTrine: gt.planets,
          focus: extra,
          opposed,
          includesAsteroid: membersIncludeAsteroid(gt.planets.concat([extra])),
        });
      }
    });
  });

  const yods = [];
  const minors = (aspects || []).filter(
    (a) => String(a.aspect).toLowerCase() === "quincunx",
  );
  const sextiles = byType.sextile;
  sextiles.forEach((s) => {
    const a = s.planet1;
    const b = s.planet2;
    const apexes = new Set();
    minors.forEach((q) => {
      const other = otherEnd(q, a);
      if (other && other !== b) {
        const hitsB = minors.some((q2) => otherEnd(q2, b) === other);
        if (hitsB) apexes.add(other);
      }
    });
    apexes.forEach((apex) => {
      yods.push({
        type: "yod",
        sextile: [a, b],
        apex,
        includesAsteroid: membersIncludeAsteroid([a, b, apex]),
      });
    });
  });

  return { tSquares, grandTrines, kites, yods };
}

function dispositorData(entries, extraEntries) {
  const planets = {};
  entries.forEach(([k, p]) => {
    planets[k] = p;
  });
  const chains = {};
  const immediateCount = {};
  PLANET_KEYS.forEach((k) => {
    immediateCount[k] = 0;
  });

  (extraEntries || []).forEach(([, p]) => {
    const ruler = SIGN_RULERS[normSign(p.sign)];
    if (ruler) immediateCount[ruler] = (immediateCount[ruler] || 0) + 1;
  });

  entries.forEach(([name, p]) => {
    const ruler = SIGN_RULERS[normSign(p.sign)];
    if (ruler && ruler !== name) {
      immediateCount[ruler] = (immediateCount[ruler] || 0) + 1;
    }
    const chain = [name];
    const seen = new Set([name]);
    let current = name;
    let type = "open";
    let final = null;
    for (let i = 0; i < 12; i++) {
      const cur = planets[current];
      const next = cur ? SIGN_RULERS[normSign(cur.sign)] : null;
      if (!next) break;
      if (next === current) {
        type = "final";
        final = current;
        break;
      }
      chain.push(next);
      if (seen.has(next)) {
        type = "cycle";
        break;
      }
      seen.add(next);
      current = next;
      if (planets[current] && SIGN_RULERS[normSign(planets[current].sign)] === current) {
        type = "final";
        final = current;
        break;
      }
    }
    chains[name] = { chain, type, final };
  });

  const hubs = Object.entries(immediateCount)
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([planet, count]) => ({ planet, count }));

  const finals = Object.values(chains)
    .filter((c) => c.type === "final" && c.final)
    .map((c) => c.final);
  const finalCounts = {};
  finals.forEach((p) => {
    finalCounts[p] = (finalCounts[p] || 0) + 1;
  });
  const finalDispositor =
    Object.keys(finalCounts).length === 1 ? Object.keys(finalCounts)[0] : null;

  const mutualReceptions = [];
  const names = entries.map(([k]) => k);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i];
      const b = names[j];
      const sa = normSign(planets[a].sign);
      const sb = normSign(planets[b].sign);
      if (SIGN_RULERS[sa] === b && SIGN_RULERS[sb] === a) {
        mutualReceptions.push({ planets: [a, b], signs: [sa, sb] });
      }
    }
  }

  return { chains, hubs, finalDispositor, mutualReceptions };
}

function scoreDominants(entries, birthChart, stelliums, hubs, annotatedAspects) {
  const unknownTime = isUnknownBirthTime(birthChart);
  const ruler = unknownTime
    ? null
    : getChartRuler(
        birthChart.angles && birthChart.angles.ascendant
          ? birthChart.angles.ascendant.sign
          : "",
      );
  const stelliumMembers = new Set();
  (stelliums.signs || []).forEach((s) => s.planets.forEach((p) => stelliumMembers.add(p)));
  if (!unknownTime) {
    (stelliums.houses || []).forEach((s) => s.planets.forEach((p) => stelliumMembers.add(p)));
  }
  const hubSet = new Set((hubs || []).map((h) => h.planet));
  const housePlanetCount = {};
  entries.forEach(([, p]) => {
    const h = Number(p.house);
    if (h) housePlanetCount[h] = (housePlanetCount[h] || 0) + 1;
  });
  const housesRuledWithWeight = {};
  PLANET_KEYS.forEach((k) => {
    housesRuledWithWeight[k] = 0;
  });
  const houses = unknownTime
    ? []
    : Array.isArray(birthChart.houses)
      ? birthChart.houses
      : [];
  houses.forEach((house) => {
    const r = SIGN_RULERS[normSign(house.sign)];
    if (!r) return;
    const n = Number(house.number);
    const occupied = housePlanetCount[n] || 0;
    const angular = houseClass(n) === "angular";
    if (occupied || angular) housesRuledWithWeight[r] += 1;
  });

  const scores = entries.map(([name, p]) => {
    let score = 0;
    const reasons = [];
    if (!unknownTime && name === ruler) {
      score += 5;
      reasons.push("chart ruler +5");
    }
    if (!unknownTime && houseClass(p.house) === "angular") {
      score += 4;
      reasons.push("angular +4");
    }
    if (stelliumMembers.has(name)) {
      score += 3;
      reasons.push("stellium +3");
    }
    if (hubSet.has(name)) {
      score += 3;
      reasons.push("dispositor hub +3");
    }
    if (name === "sun" || name === "moon") {
      score += 2;
      reasons.push("luminary +2");
    }
    if (!unknownTime && (housesRuledWithWeight[name] || 0) >= 2) {
      score += 2;
      reasons.push("rules multiple weighted houses +2");
    }
    const majors = annotatedAspects.filter(
      (a) =>
        isMajorAspectName(a.aspect) &&
        (a.planet1 === name || a.planet2 === name) &&
        isPlanetKey(a.planet1) &&
        isPlanetKey(a.planet2),
    );
    const close = majors.filter((a) => Number(a.orb) <= 4).length;
    const closePts = Math.min(4, close);
    if (closePts) {
      score += closePts;
      reasons.push(`close major aspects +${closePts}`);
    }
    const dignity = getDignity(name, p.sign);
    if (dignity === "domicile" || dignity === "exaltation") {
      score += 2;
      reasons.push(`${dignity} +2`);
    } else if (dignity === "detriment" || dignity === "fall") {
      score -= 2;
      reasons.push(`${dignity} -2`);
    }
    if (majors.length >= 5) {
      score += 1;
      reasons.push("highly networked +1");
    }
    return { planet: name, score, dignity, reasons, majorAspectCount: majors.length };
  });

  scores.sort((a, b) => b.score - a.score);
  return scores;
}

function collectRepeatingThemes(arch) {
  const themes = [];
  function add(theme, evidence) {
    if (!evidence.length) return;
    themes.push({ theme, count: evidence.length, evidence });
  }

  if (arch.elements && arch.elements.dominantCount >= 4) {
    add(`${arch.elements.dominant} temperament`, [
      `${arch.elements.dominantCount} planets in ${arch.elements.dominant}`,
    ]);
  }
  if (arch.modalities && arch.modalities.dominantCount >= 4) {
    add(`${arch.modalities.dominant} pace`, [
      `${arch.modalities.dominantCount} planets in ${arch.modalities.dominant}`,
    ]);
  }
  if (arch.singletons && arch.singletons.elements.length) {
    arch.singletons.elements.forEach((s) => {
      add(`singleton ${s.element}`, [`only ${s.planet} in ${s.element}`]);
    });
  }
  (arch.stelliums.signs || []).forEach((s) => {
    add(`concentrated ${s.sign}`, [`${s.count} planets in ${s.sign}: ${s.planets.join(", ")}`]);
  });
  if (!isUnknownBirthTime(arch)) {
    (arch.stelliums.houses || []).forEach((s) => {
      add(`concentrated house ${s.house}`, [
        `${s.count} planets in house ${s.house}: ${s.planets.join(", ")}`,
      ]);
    });
  }
  if (!isUnknownBirthTime(arch) && arch.chartRuler) {
    const ev = [
      `ruler ${arch.chartRuler.planet} in ${arch.chartRuler.sign} house ${arch.chartRuler.house} (${arch.chartRuler.dignity}, ${arch.chartRuler.houseClass})`,
    ];
    if (arch.chartRuler.aspects && arch.chartRuler.aspects.length) {
      ev.push(
        `ruler aspects: ${arch.chartRuler.aspects
          .slice(0, 4)
          .map((a) => `${a.aspect} ${a.other}`)
          .join(", ")}`,
      );
    }
    const rulerDom = (arch.dominantPlanets || []).find(
      (d) => d.planet === arch.chartRuler.planet,
    );
    if (rulerDom && rulerDom.score >= 8) ev.push("ruler also ranks as a dominant planet");
    add("life direction via chart ruler", ev);
  }
  if (!isUnknownBirthTime(arch) && arch.shape && arch.shape.hemispheres) {
    const h = arch.shape.hemispheres;
    if (h.eastern >= 7) add("self-directed emphasis", [`${h.eastern} planets in the eastern hemisphere`]);
    if (h.western >= 7) add("other-directed emphasis", [`${h.western} planets in the western hemisphere`]);
    if (h.southern >= 7) add("public / outer-world emphasis", [`${h.southern} planets above the horizon`]);
    if (h.northern >= 7) add("private / inner-world emphasis", [`${h.northern} planets below the horizon`]);
  }
  (arch.configurations.tSquares || []).forEach((t) => {
    add("focal tension (T-square)", [
      `${t.focal} squares the ${t.opposition.join("–")} opposition`,
    ]);
  });
  (arch.configurations.grandTrines || []).forEach((g) => {
    add("closed easy circuit (grand trine)", [g.planets.join(", ")]);
  });
  if (arch.lunarPhase) {
    add(`lunar phase ${arch.lunarPhase.name}`, [
      `Sun–Moon elongation ${arch.lunarPhase.elongation}°`,
    ]);
  }
  if (!isUnknownBirthTime(arch) && arch.sect) {
    add(`${arch.sect} chart`, [
      arch.sect === "day" ? "Sun above the horizon" : "Sun below the horizon",
    ]);
  }
  if (arch.network && arch.network.unaspected.length) {
    add("unaspected planet", arch.network.unaspected.map((p) => `${p} has no major aspects`));
  }
  if (arch.dispositors && arch.dispositors.finalDispositor) {
    add("final dispositor", [
      `${arch.dispositors.finalDispositor} ends the rulership chains`,
    ]);
  }

  const astCond = arch.asteroidConditions || {};
  const rulerPlanet = arch.chartRuler && arch.chartRuler.planet;
  Object.entries(astCond).forEach(([name, c]) => {
    const coreHits = (c.majorAspects || []).filter((a) => {
      const other = String(a.other || "").toLowerCase();
      return other === "sun" || other === "moon" || other === rulerPlanet;
    });
    if (coreHits.length) {
      add(`asteroid ${name} tied to core`, [
        coreHits
          .map((a) => `${name} ${a.aspect} ${a.other}${a.orb != null ? ` (${a.orb}°)` : ""}`)
          .join(", "),
      ]);
    }
    if (!isUnknownBirthTime(arch) && c.houseClass === "angular") {
      add("asteroid on an angle", [`${name} in house ${c.house}`]);
    }
  });
  (isUnknownBirthTime(arch) ? [] : arch.angleAspects || []).forEach((a) => {
    if (isAsteroidKey(a.planet)) {
      add("asteroid to ASC/MC", [
        `${a.planet} ${a.aspect} ${a.angle} (${a.orb}°)`,
      ]);
    }
  });

  return themes.filter((t) => t.count >= 1).sort((a, b) => b.count - a.count);
}

function annotateAspects(birthChart) {
  const bodies = chartBodyMap(birthChart);
  return (Array.isArray(birthChart.aspects) ? birthChart.aspects : []).map((a) => {
    const p1 = bodies[a.planet1] || {};
    const p2 = bodies[a.planet2] || {};
    const target = aspectTargetAngle(a.aspect);
    return {
      planet1: a.planet1,
      planet2: a.planet2,
      aspect: a.aspect,
      orb: a.orb != null ? Math.round(Number(a.orb) * 10) / 10 : null,
      applying: isApplying(p1.degree, p1.speed, p2.degree, p2.speed, target),
      major: isMajorAspectName(a.aspect),
    };
  });
}

function buildPlanetConditions(entries, annotatedAspects) {
  const conditions = {};
  entries.forEach(([name, p]) => {
    const majors = annotatedAspects.filter(
      (a) =>
        a.major &&
        (a.planet1 === name || a.planet2 === name),
    );
    conditions[name] = {
      sign: normSign(p.sign),
      house: Number(p.house) || null,
      houseClass: houseClass(p.house),
      element: p.element || ELEMENT_SIGNS[normSign(p.sign)] || null,
      modality: MODAL_SIGNS[normSign(p.sign)] || null,
      dignity: isAsteroidKey(name) ? null : getDignity(name, p.sign),
      kind: isAsteroidKey(name) ? "asteroid" : "planet",
      retrograde: !!p.isRetrograde,
      degree: p.degree != null ? Math.round(Number(p.degree) * 100) / 100 : null,
      majorAspects: majors.map((a) => ({
        aspect: a.aspect,
        other: otherEnd(a, name),
        orb: a.orb,
        applying: a.applying,
      })),
    };
  });
  return conditions;
}

function buildHouseChains(birthChart, conditions, occupantEntries) {
  if (isUnknownBirthTime(birthChart)) return [];
  const houses = Array.isArray(birthChart.houses) ? birthChart.houses : [];
  const occupants = occupantEntries || [];
  return houses
    .filter((h) => h && h.sign)
    .map((h) => {
      const ruler = SIGN_RULERS[normSign(h.sign)] || null;
      const rc = ruler && conditions[ruler] ? conditions[ruler] : null;
      const houseNum = Number(h.number);
      return {
        house: houseNum,
        sign: normSign(h.sign),
        ruler,
        rulerSign: rc ? rc.sign : null,
        rulerHouse: rc ? rc.house : null,
        rulerDignity: rc ? rc.dignity : null,
        rulerHouseClass: rc ? rc.houseClass : null,
        rulerRetrograde: rc ? rc.retrograde : null,
        rulerAspects: rc ? rc.majorAspects.slice(0, 5) : [],
        occupants: occupants
          .filter(([, p]) => Number(p.house) === houseNum)
          .map(([name]) => name),
      };
    });
}

function buildShape(entries) {
  const hemispheres = { eastern: 0, western: 0, northern: 0, southern: 0 };
  const quadrants = { q1: 0, q2: 0, q3: 0, q4: 0 };
  entries.forEach(([, p]) => {
    const h = Number(p.house);
    if (!h) return;
    if ([10, 11, 12, 1, 2, 3].includes(h)) hemispheres.eastern += 1;
    if ([4, 5, 6, 7, 8, 9].includes(h)) hemispheres.western += 1;
    if (h >= 1 && h <= 6) hemispheres.northern += 1;
    if (h >= 7 && h <= 12) hemispheres.southern += 1;
    if (h >= 1 && h <= 3) quadrants.q1 += 1;
    else if (h <= 6) quadrants.q2 += 1;
    else if (h <= 9) quadrants.q3 += 1;
    else if (h <= 12) quadrants.q4 += 1;
  });
  const longitudes = entries.map(([, p]) => p.degree);
  return {
    hemispheres,
    quadrants,
    jones: jonesPattern(longitudes),
  };
}

function countElementsAndModes(entries) {
  const elements = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  const modalities = { Cardinal: 0, Fixed: 0, Mutable: 0 };
  entries.forEach(([, p]) => {
    const el = p.element || ELEMENT_SIGNS[normSign(p.sign)];
    const mo = MODAL_SIGNS[normSign(p.sign)];
    if (elements[el] != null) elements[el] += 1;
    if (modalities[mo] != null) modalities[mo] += 1;
  });
  const elSorted = Object.entries(elements).sort((a, b) => b[1] - a[1]);
  const moSorted = Object.entries(modalities).sort((a, b) => b[1] - a[1]);
  const singletonEls = elSorted
    .filter(([, n]) => n === 1)
    .map(([element]) => element);
  const singletonElements = [];
  if (singletonEls.length) {
    // filled later when we know which planet
  }
  return {
    elements: {
      distribution: elements,
      dominant: elSorted[0] && elSorted[0][1] > 0 ? elSorted[0][0] : null,
      dominantCount: elSorted[0] ? elSorted[0][1] : 0,
      lacking: elSorted[elSorted.length - 1] ? elSorted[elSorted.length - 1][0] : null,
    },
    modalities: {
      distribution: modalities,
      dominant: moSorted[0] && moSorted[0][1] > 0 ? moSorted[0][0] : null,
      dominantCount: moSorted[0] ? moSorted[0][1] : 0,
    },
    singletonElementNames: singletonEls,
    singletonModalityNames: moSorted.filter(([, n]) => n === 1).map(([m]) => m),
  };
}

function buildChartArchitecture(birthChart) {
  if (!birthChart || typeof birthChart !== "object") {
    return { ok: false, reason: "no chart" };
  }
  const entries = planetEntries(birthChart);
  const astEntries = asteroidEntries(birthChart);
  const combinedEntries = entries.concat(astEntries);
  const annotatedAspects = annotateAspects(birthChart);
  const conditions = buildPlanetConditions(entries, annotatedAspects);
  const asteroidConditions = buildPlanetConditions(astEntries, annotatedAspects);
  const stelliums = findStelliums(combinedEntries);
  const dispositors = dispositorData(entries, astEntries);
  const dominantPlanets = scoreDominants(
    entries,
    birthChart,
    stelliums,
    dispositors.hubs,
    annotatedAspects,
  );
  const counts = countElementsAndModes(entries);
  const singletons = { elements: [], modalities: [] };
  counts.singletonElementNames.forEach((el) => {
    const hit = entries.find(([, p]) => (p.element || ELEMENT_SIGNS[normSign(p.sign)]) === el);
    if (hit) singletons.elements.push({ element: el, planet: hit[0] });
  });
  counts.singletonModalityNames.forEach((mo) => {
    const hit = entries.find(([, p]) => MODAL_SIGNS[normSign(p.sign)] === mo);
    if (hit) singletons.modalities.push({ modality: mo, planet: hit[0] });
  });

  const majorNet = {};
  PLANET_KEYS.forEach((k) => {
    majorNet[k] = 0;
  });
  annotatedAspects.forEach((a) => {
    if (!a.major) return;
    const a1 = String(a.planet1 || "").toLowerCase();
    const a2 = String(a.planet2 || "").toLowerCase();
    if (!isPlanetKey(a1) || !isPlanetKey(a2)) return;
    if (majorNet[a.planet1] != null) majorNet[a.planet1] += 1;
    if (majorNet[a.planet2] != null) majorNet[a.planet2] += 1;
  });
  const present = entries.map(([k]) => k);
  const unaspected = present.filter((k) => (majorNet[k] || 0) === 0);
  const mostNetworked = present
    .slice()
    .sort((a, b) => (majorNet[b] || 0) - (majorNet[a] || 0))
    .filter((k) => majorNet[k] > 0)
    .slice(0, 3)
    .map((k) => ({ planet: k, count: majorNet[k] }));

  const unknownBirthTime = isUnknownBirthTime(birthChart);
  const rulerName = unknownBirthTime
    ? null
    : getChartRuler(
        birthChart.angles && birthChart.angles.ascendant
          ? birthChart.angles.ascendant.sign
          : "",
      );
  const rulerCond = rulerName ? conditions[rulerName] || null : null;
  const chartRuler =
    unknownBirthTime || !rulerName
      ? null
      : rulerCond
        ? {
            planet: rulerName,
            sign: rulerCond.sign,
            house: rulerCond.house,
            houseClass: rulerCond.houseClass,
            dignity: rulerCond.dignity,
            retrograde: rulerCond.retrograde,
            aspects: rulerCond.majorAspects,
          }
        : { planet: rulerName };

  const sun = birthChart.planets && birthChart.planets.sun;
  const moon = birthChart.planets && birthChart.planets.moon;
  const sunHouse = sun ? Number(sun.house) : null;
  const sect = unknownBirthTime
    ? null
    : sunHouse >= 7 && sunHouse <= 12
      ? "day"
      : sunHouse >= 1 && sunHouse <= 6
        ? "night"
        : null;

  const architecture = {
    ok: true,
    unknownBirthTime,
    chartRuler,
    planetConditions: conditions,
    dominantPlanets: dominantPlanets.slice(0, 5),
    houseChains: buildHouseChains(birthChart, conditions, combinedEntries),
    dispositors: {
      hubs: dispositors.hubs,
      finalDispositor: dispositors.finalDispositor,
      mutualReceptions: dispositors.mutualReceptions,
      chains: dispositors.chains,
    },
    lunarPhase: sun && moon ? lunarPhase(sun.degree, moon.degree) : null,
    sect,
    elements: counts.elements,
    modalities: counts.modalities,
    singletons,
    stelliums,
    shape: unknownBirthTime
      ? { hemispheres: null, quadrants: null, jones: buildShape(entries).jones }
      : buildShape(entries),
    configurations: findConfigurations(birthChart.aspects),
    angleAspects: unknownBirthTime
      ? []
      : findAngleAspects(birthChart, astEntries),
    network: { unaspected, mostNetworked },
    aspectsAnnotated: annotatedAspects,
    points: birthChart.points || null,
    asteroids: birthChart.asteroids || {},
    asteroidConditions,
    asteroidNetwork: astEntries.map(([name]) => {
      const majors = annotatedAspects.filter(
        (a) =>
          a.major &&
          (a.planet1 === name || a.planet2 === name),
      );
      return {
        asteroid: name,
        count: majors.length,
        links: majors.map((a) => ({
          aspect: a.aspect,
          other: otherEnd(a, name),
          orb: a.orb,
          applying: a.applying,
        })),
      };
    }),
    selectedAsteroids: Array.isArray(birthChart.selectedAsteroids)
      ? birthChart.selectedAsteroids
      : astEntries.map(([k]) => k),
  };
  architecture.repeatingThemes = collectRepeatingThemes(architecture);
  architecture.thesisClaims = buildThesisClaims(architecture);
  architecture.thesis = (architecture.thesisClaims || []).join(" ");
  return architecture;
}

const PHASE_PLAIN = {
  new: "You often start quietly and figure the plan out as you go, instead of announcing it first",
  crescent: "You commit once you can see a real shape, not at the first spark of an idea",
  "first quarter":
    "You often act while a situation is still unresolved, rather than waiting until you feel sure",
  gibbous: "You spend a lot of energy refining what you already started",
  full: "You understand yourself more clearly through other people and visible situations",
  disseminating: "You tend to share what you have learned rather than keep it to yourself",
  "last quarter":
    "You question old setups and start closing chapters before the next one is obvious",
  balsamic:
    "You need time to finish and let go of a chapter before a new one feels real",
};

const SIGN_TONE = {
  aries: "starting fast and competing",
  taurus: "wanting steadiness and comfort",
  gemini: "talk, variety, and staying mentally busy",
  cancer: "protecting home, family, and feeling",
  leo: "being seen and putting heart into what you do",
  virgo: "fixing details and making things useful",
  libra: "keeping the peace and weighing both sides",
  scorpio: "going all-in and needing real honesty",
  sagittarius: "wanting room, meaning, and a bigger view",
  capricorn: "taking the long road and building status slowly",
  aquarius: "staying independent and thinking for the group",
  pisces: "feeling a lot and looking for meaning under the surface",
};

const PLANET_CLAIM = {
  sun: "being recognized and having a clear sense of self",
  moon: "feeling emotionally safe and knowing how to comfort yourself",
  mercury: "thinking, talking, and making sense of things",
  venus: "what you care about and how you get close to people",
  mars: "motivation and how you go after what you want",
  jupiter: "growth, hope, and wanting more room",
  saturn: "patience, hard work, and building things that last",
  uranus: "needing freedom and resisting a fixed script",
  neptune: "sensitivity, ideals, and wanting things to feel meaningful",
  pluto: "going deep and not staying on the surface",
  chiron: "an old tender spot that became a way you help or teach",
  ceres: "how you nourish, protect, and need to be cared for",
  pallas: "pattern-seeing, strategy, and creative problem-solving",
  juno: "what you need in order to stay committed to someone",
  vesta: "the work or cause you keep the fire for",
};

const HOUSE_CLAIM = {
  1: "how you come across and start things",
  2: "money, skills, and what makes you feel secure",
  3: "everyday talk, siblings, and short-range life",
  4: "home, family, and private life",
  5: "creativity, dating, and taking a risk for joy",
  6: "routines, health, and the work you actually do",
  7: "close one-to-one relationships",
  8: "shared money, trust, and intense closeness",
  9: "beliefs, study, and the bigger picture",
  10: "career, reputation, and how the public sees you",
  11: "friends, groups, future plans, and where you belong",
  12: "private time, rest, and what stays behind the scenes",
};

/**
 * Internal locked claims. Not shown to the user as-is.
 */
function buildThesisClaims(architecture) {
  if (!architecture || !architecture.ok) return [];
  const claims = [];
  const unknownTime = isUnknownBirthTime(architecture);
  const r = unknownTime ? null : architecture.chartRuler;
  const drive = r && r.planet ? PLANET_CLAIM[r.planet] || r.planet : null;
  const arena = r ? HOUSE_CLAIM[r.house] || "a major area of life" : null;

  if (unknownTime) {
    const top = (architecture.dominantPlanets || [])[0];
    if (top && PLANET_CLAIM[top.planet]) {
      let c = "The through-line is " + PLANET_CLAIM[top.planet] + ".";
      if (top.dignity === "domicile" || top.dignity === "exaltation") {
        c += " Other people can usually see this in you without you having to explain it.";
      } else if (top.dignity === "detriment" || top.dignity === "fall") {
        c += " This is real, but it often feels awkward or takes extra work.";
      }
      claims.push(c);
    }
  } else if (drive && arena) {
    let c = "The through-line is " + drive + ", and it shows up most in " + arena + ".";
    if (r.dignity === "domicile" || r.dignity === "exaltation") {
      c += " Other people can usually see this in you without you having to explain it.";
    } else if (r.dignity === "detriment" || r.dignity === "fall") {
      c += " This is real, but it often feels awkward or takes extra work.";
    }
    if (r.retrograde) {
      c += " You tend to redo the same effort in cycles instead of finishing in one straight run.";
    }
    claims.push(c);
  }

  const tsqs =
    (architecture.configurations && architecture.configurations.tSquares) || [];
  const tsq = tsqs.find((t) => !t.includesAsteroid) || tsqs[0];
  const focal = tsq && tsq.focal ? PLANET_CLAIM[tsq.focal] || tsq.focal : null;
  if (focal && drive) {
    claims.push(
      "In " +
        (arena || "daily life") +
        ", that through-line keeps colliding with " +
        focal +
        ": you want both, and neither side fully wins.",
    );
  } else if (unknownTime && focal) {
    claims.push(
      "That through-line keeps colliding with " +
        focal +
        ": you want both, and neither side fully wins.",
    );
  } else {
    const extra = (architecture.dominantPlanets || [])
      .map((d) => d.planet)
      .filter((p) => !r || p !== r.planet)[0];
    if (extra && drive) {
      claims.push(
        "Alongside that, " +
          (PLANET_CLAIM[extra] || extra) +
          " keeps showing up, so this is not only a story about " +
          drive +
          ".",
      );
    }
  }

  if (architecture.lunarPhase && PHASE_PLAIN[architecture.lunarPhase.name]) {
    claims.push(PHASE_PLAIN[architecture.lunarPhase.name] + ".");
  }

  if (unknownTime) {
    const stSign =
      architecture.stelliums &&
      architecture.stelliums.signs &&
      architecture.stelliums.signs[0];
    const tone = stSign && SIGN_TONE[String(stSign.sign || "").toLowerCase()];
    if (tone) {
      claims.push("A lot of different parts of your life share the same tone: " + tone + ".");
    }
  } else if (architecture.sect === "night") {
    claims.push(
      "Even when your days look busy, a lot of what actually matters to you happens in private: feelings, doubts, and the story you tell yourself.",
    );
  } else if (architecture.sect === "day") {
    claims.push(
      "A lot of this plays out in visible effort and the outside world, not only in private.",
    );
  } else {
    const stSign =
      architecture.stelliums &&
      architecture.stelliums.signs &&
      architecture.stelliums.signs[0];
    const tone = stSign && SIGN_TONE[String(stSign.sign || "").toLowerCase()];
    if (tone) {
      claims.push("A lot of different parts of your life share the same tone: " + tone + ".");
    }
  }

  const astCond = architecture.asteroidConditions || {};
  Object.entries(astCond).forEach(([name, c]) => {
    if (claims.length >= 4) return;
    (c.majorAspects || []).some((a) => {
      if (String(a.aspect || "").toLowerCase() !== "conjunction") return false;
      if (a.orb != null && Number(a.orb) > 3) return false;
      const other = String(a.other || "").toLowerCase();
      if (other !== "sun" && other !== "moon" && !(r && r.planet === other)) {
        return false;
      }
      claims.push(
        (PLANET_CLAIM[name] || name) +
          " sits right on " +
          (PLANET_CLAIM[other] || other) +
          ", so that theme is not optional in this life.",
      );
      return true;
    });
  });

  return claims.slice(0, 4);
}

/**
 * Locked claims for the model only. Never send this block to the user as-is.
 * @param {object} architecture
 * @param {{ portrait?: boolean }} [options] - portrait=true is the first whole-self turn
 */
function formatLockedClaimsForModel(architecture, options) {
  const claims = (architecture && architecture.thesisClaims) || [];
  if (!claims.length) return "";
  const portrait = !!(options && options.portrait);
  const lines = [
    "--- INTERNAL CLAIMS (program only; never paste, quote, or echo this block) ---",
  ];
  if (portrait) {
    lines.push(
      "Cover these points in everyday language. Each sentence must name a real-life habit, need, or tension (work, closeness, timing, privacy, stress).",
    );
    lines.push(
      "If a point would sound like a riddle, translate it into a concrete example. Do not mention charts, houses, planets, phases, or sect.",
    );
  } else {
    lines.push(
      "Keep later answers consistent with these themes. When the user asks about one part of life, show how the through-line shows up there. Do not paste this block.",
    );
  }
  claims.forEach(function (c, i) {
    lines.push(i + 1 + ". " + c);
  });
  lines.push("--- END INTERNAL CLAIMS ---");
  return lines.join("\n");
}

function buildChartThesis(architecture) {
  return buildThesisClaims(architecture).join(" ");
}

function ensureArchitecture(birthChart) {
  if (!birthChart || typeof birthChart !== "object") return null;
  const arch = birthChart.architecture;
  const hasAsteroids =
    birthChart.asteroids && Object.keys(birthChart.asteroids).length > 0;
  const archKnowsAsteroids = arch && arch.asteroidConditions;
  const timeFlagMatch =
    !!arch && !!arch.unknownBirthTime === !!birthChart.unknownBirthTime;
  if (
    arch &&
    arch.ok &&
    timeFlagMatch &&
    (!hasAsteroids || archKnowsAsteroids)
  ) {
    return arch;
  }
  birthChart.architecture = buildChartArchitecture(birthChart);
  return birthChart.architecture;
}

function formatArchitectureForAI(architecture) {
  if (!architecture || !architecture.ok) return "";
  const unknownTime = isUnknownBirthTime(architecture);
  const lines = [];
  lines.push("Use this computed architecture as the skeleton of the reading.");
  lines.push("Individual placements refine it; they do not replace it.");
  lines.push("");
  if (unknownTime) {
    lines.push(
      "BIRTH TIME UNKNOWN: Houses, house occupants, house rulers, chart ruler, sect, hemispheres, quadrants, and ASC/MC aspects are not valid. The wheel may show 0° Aries rising as a display placeholder only. Interpret from planetary signs, dignity, aspects, elements, modalities, sign stelliums, and configurations. The Moon's exact degree is approximate. Mention the missing birth time only when the question actually needs houses or rising sign; then say so briefly and continue with what is known.",
    );
    lines.push("");
  }

  if (!unknownTime && architecture.chartRuler && architecture.chartRuler.sign) {
    const r = architecture.chartRuler;
    lines.push(
      `Chart ruler: ${titleCase(r.planet)} in ${r.sign}, house ${r.house} (${r.houseClass}, ${r.dignity}${r.retrograde ? ", retrograde" : ""}).`,
    );
    if (r.aspects && r.aspects.length) {
      lines.push(
        `  Ruler aspects: ${r.aspects
          .map(
            (a) =>
              `${a.aspect} ${titleCase(a.other)} (${a.orb}°${a.applying === true ? ", applying" : a.applying === false ? ", separating" : ""})`,
          )
          .join("; ")}.`,
      );
    }
  }

  if (architecture.dominantPlanets && architecture.dominantPlanets.length) {
    lines.push(
      "Dominant planets (scored): " +
        architecture.dominantPlanets
          .slice(0, 3)
          .map((d) => `${titleCase(d.planet)} ${d.score}`)
          .join(", ") +
        ".",
    );
  }

  if (architecture.lunarPhase) {
    lines.push(
      `Lunar phase: ${architecture.lunarPhase.name} (Sun–Moon ${architecture.lunarPhase.elongation}°).`,
    );
  }
  if (!unknownTime && architecture.sect) {
    lines.push(`Sect: ${architecture.sect} chart.`);
  }

  const el = architecture.elements;
  if (el && el.dominant) {
    const dist = Object.entries(el.distribution)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    lines.push(
      `Element (planets only): ${dist}. Dominant ${el.dominant} (${el.dominantCount}); least ${el.lacking}.`,
    );
  }
  const mo = architecture.modalities;
  if (mo && mo.dominant) {
    const dist = Object.entries(mo.distribution)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    lines.push(`Modality (planets only): ${dist}. Dominant ${mo.dominant}.`);
  }

  if (architecture.shape) {
    const h = unknownTime ? null : architecture.shape.hemispheres;
    const q = unknownTime ? null : architecture.shape.quadrants;
    const j = architecture.shape.jones;
    if (h) {
      lines.push(
        `Hemispheres: east ${h.eastern} / west ${h.western}; below horizon ${h.northern} / above ${h.southern}.`,
      );
    }
    if (q) {
      lines.push(
        `Quadrants: Q1 ${q.q1}, Q2 ${q.q2}, Q3 ${q.q3}, Q4 ${q.q4}.`,
      );
    }
    if (j && j.name) {
      lines.push(
        `Chart shape: ${j.name}${j.occupiedSpan != null ? ` (occupied ~${j.occupiedSpan}°)` : ""}.`,
      );
    }
  }

  const st = architecture.stelliums;
  if (
    st &&
    ((st.signs && st.signs.length) ||
      (!unknownTime && st.houses && st.houses.length))
  ) {
    const bits = [];
    (st.signs || []).forEach((s) =>
      bits.push(`${s.sign} (${s.planets.join(", ")})`),
    );
    if (!unknownTime) {
      (st.houses || []).forEach((s) =>
        bits.push(`house ${s.house} (${s.planets.join(", ")})`),
      );
    }
    lines.push("Stelliums: " + bits.join("; ") + ".");
  } else {
    lines.push("Stelliums: none.");
  }

  if (architecture.singletons) {
    const sBits = [];
    architecture.singletons.elements.forEach((s) =>
      sBits.push(`${titleCase(s.planet)} only ${s.element}`),
    );
    architecture.singletons.modalities.forEach((s) =>
      sBits.push(`${titleCase(s.planet)} only ${s.modality}`),
    );
    if (sBits.length) lines.push("Singletons: " + sBits.join("; ") + ".");
  }

  const cfg = architecture.configurations || {};
  const cfgBits = [];
  const cfgNote = (item) => (item && item.includesAsteroid ? " (includes asteroid)" : "");
  (cfg.tSquares || []).forEach((t) =>
    cfgBits.push(
      `T-square focal ${titleCase(t.focal)} vs ${t.opposition.map(titleCase).join("–")}${cfgNote(t)}`,
    ),
  );
  (cfg.grandTrines || []).forEach((g) =>
    cfgBits.push(`grand trine ${g.planets.map(titleCase).join(", ")}${cfgNote(g)}`),
  );
  (cfg.kites || []).forEach((k) =>
    cfgBits.push(`kite focus ${titleCase(k.focus)}${cfgNote(k)}`),
  );
  (cfg.yods || []).forEach((y) =>
    cfgBits.push(`yod apex ${titleCase(y.apex)}${cfgNote(y)}`),
  );
  lines.push(
    "Aspect configurations: " + (cfgBits.length ? cfgBits.join("; ") : "none detected") + ".",
  );

  if (architecture.network) {
    if (architecture.network.mostNetworked.length) {
      lines.push(
        "Most networked: " +
          architecture.network.mostNetworked
            .map((n) => `${titleCase(n.planet)} (${n.count})`)
            .join(", ") +
          ".",
      );
    }
    if (architecture.network.unaspected.length) {
      lines.push(
        "Unaspected (no major aspects): " +
          architecture.network.unaspected.map(titleCase).join(", ") +
          ".",
      );
    }
  }

  if (!unknownTime && architecture.angleAspects && architecture.angleAspects.length) {
    lines.push(
      "Aspects to ASC/MC: " +
        architecture.angleAspects
          .map(
            (a) =>
              `${titleCase(a.planet)} ${a.aspect} ${a.angle} (${a.orb}°)`,
          )
          .join("; ") +
          ".",
    );
  } else if (!unknownTime) {
    lines.push("Aspects to ASC/MC: none within major orbs.");
  }

  const d = architecture.dispositors;
  if (d) {
    if (d.finalDispositor) {
      lines.push(`Final dispositor: ${titleCase(d.finalDispositor)}.`);
    }
    if (d.hubs && d.hubs.length) {
      lines.push(
        "Dispositor hubs: " +
          d.hubs.map((h) => `${titleCase(h.planet)} (${h.count})`).join(", ") +
          ".",
      );
    }
    if (d.mutualReceptions && d.mutualReceptions.length) {
      lines.push(
        "Mutual receptions: " +
          d.mutualReceptions
            .map((m) => m.planets.map(titleCase).join("–"))
            .join(", ") +
          ".",
      );
    }
  }

  if (!unknownTime && architecture.houseChains && architecture.houseChains.length) {
    lines.push("House rulership chains (house → ruler → ruler placement):");
    architecture.houseChains.forEach((c) => {
      if (!c.ruler) return;
      const sitting =
        c.occupants && c.occupants.length
          ? `; occupants: ${c.occupants.map(titleCase).join(", ")}`
          : "";
      lines.push(
        `  ${c.house} ${c.sign} → ${titleCase(c.ruler)} in ${c.rulerSign || "?"} house ${c.rulerHouse || "?"} (${c.rulerDignity || "?"}${c.rulerRetrograde ? ", R" : ""})${sitting}.`,
      );
    });
  }

  if (architecture.planetConditions) {
    lines.push("Planet condition:");
    Object.entries(architecture.planetConditions).forEach(([name, c]) => {
      const houseBit = unknownTime
        ? ""
        : ` house ${c.house} ${c.houseClass || ""}`;
      lines.push(
        `  ${titleCase(name)}: ${c.sign}${houseBit}${c.dignity ? " " + c.dignity : ""}${c.retrograde ? " retrograde" : ""}; majors: ${
          c.majorAspects.length
            ? c.majorAspects
                .map(
                  (a) =>
                    `${a.aspect} ${titleCase(a.other)}${a.applying === true ? " applying" : a.applying === false ? " separating" : ""}`,
                )
                .join(", ")
            : "none"
        }.`,
      );
    });
  }

  if (architecture.repeatingThemes && architecture.repeatingThemes.length) {
    lines.push("Repeating themes (keep these as the through-line):");
    architecture.repeatingThemes.slice(0, 8).forEach((t) => {
      lines.push(`  ${t.theme}: ${t.evidence.join(" | ")}`);
    });
  }

  if (architecture.points && architecture.points.northNode) {
    const nn = architecture.points.northNode;
    lines.push(
      unknownTime
        ? `North Node (if using): ${nn.sign || "?"}.`
        : `North Node (if using): ${nn.sign || "?"} house ${nn.house || "?"}.`,
    );
  }

  const astCond = architecture.asteroidConditions || {};
  const astNames = Object.keys(astCond);
  if (astNames.length) {
    lines.push(
      "Asteroid condition (user enabled; supporting color only, not equal to Sun/Moon/ruler):",
    );
    astNames.forEach((name) => {
      const c = astCond[name];
      if (!c) return;
      const houseBit = unknownTime
        ? ""
        : ` house ${c.house || "?"} ${c.houseClass || ""}`;
      lines.push(
        `  ${titleCase(name)}: ${c.sign || "?"}${houseBit}${c.retrograde ? " retrograde" : ""}; majors: ${
          c.majorAspects && c.majorAspects.length
            ? c.majorAspects
                .map(
                  (a) =>
                    `${a.aspect} ${titleCase(a.other)}${a.orb != null ? ` ${a.orb}°` : ""}${a.applying === true ? " applying" : a.applying === false ? " separating" : ""}`,
                )
                .join(", ")
            : "none"
        }.`,
      );
    });
    const coreLinks = [];
    const rulerPlanet = architecture.chartRuler && architecture.chartRuler.planet;
    astNames.forEach((name) => {
      const c = astCond[name];
      (c.majorAspects || []).forEach((a) => {
        const other = String(a.other || "").toLowerCase();
        if (other === "sun" || other === "moon" || other === rulerPlanet) {
          coreLinks.push(
            `${titleCase(name)} ${a.aspect} ${titleCase(a.other)}${a.orb != null ? ` (${a.orb}°)` : ""}`,
          );
        }
      });
    });
    if (coreLinks.length) {
      lines.push("Asteroids tied to Sun/Moon/ruler: " + coreLinks.join("; ") + ".");
    }
  }

  return lines.join("\n");
}

const LIFE_TOPICS = {
  career: {
    id: "career",
    label: "work, reputation, and how you are seen",
    houses: [10, 6, 2],
  },
  relationships: {
    id: "relationships",
    label: "closeness and one-to-one bonds",
    houses: [7, 5, 8],
  },
  money: {
    id: "money",
    label: "money, resources, and feeling resourced",
    houses: [2, 8, 11],
  },
  home: {
    id: "home",
    label: "home, family, and private life",
    houses: [4, 3, 12],
  },
  health: {
    id: "health",
    label: "routines, health, and the work you actually do",
    houses: [6, 1, 8],
  },
  friends: {
    id: "friends",
    label: "friends, groups, and where you belong",
    houses: [11, 7],
  },
  growth: {
    id: "growth",
    label: "beliefs, study, and the bigger picture",
    houses: [9, 12, 5],
  },
};

function isPlacementQuestion(message) {
  const t = String(message || "").toLowerCase();
  return (
    /\b(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|ceres|pallas|juno|vesta|ascendant|rising|midheaven|north node)\b/.test(
      t,
    ) &&
    /\b(in|square|trine|opposite|opposition|conjunct|conjunction|sextile|quincunx|house|sign)\b/.test(
      t,
    )
  );
}

function detectLifeTopic(message) {
  const t = String(message || "").toLowerCase();
  if (!t.trim() || isPlacementQuestion(t)) return null;
  const tests = [
    {
      id: "relationships",
      re: /\b(relationships?|love life|romantic|partner|marriage|married|dating|romance|boyfriend|girlfriend|spouse|closeness|one-to-one)\b/,
    },
    {
      id: "career",
      re: /\b(career|profession|vocation|job|my work|at work|workplace|public image|ambition)\b/,
    },
    {
      id: "money",
      re: /\b(money|finances?|financial|income|wealth|salary|earn)\b/,
    },
    {
      id: "home",
      re: /\b(home life|family|parents?|childhood home|roots|my home|private life)\b/,
    },
    {
      id: "friends",
      re: /\b(friends?|friendships?|social circle|community)\b/,
    },
    {
      id: "health",
      re: /\b(health|wellness|daily routine|burnout)\b/,
    },
    {
      id: "growth",
      re: /\b(purpose|beliefs?|spiritual|meaning of life|philosophy)\b/,
    },
  ];
  for (let i = 0; i < tests.length; i++) {
    if (tests[i].re.test(t)) return LIFE_TOPICS[tests[i].id];
  }
  return null;
}

const ASPECT_PLAIN = {
  conjunction: "these two needs sit on top of each other",
  opposition: "these two needs face each other",
  square: "these two needs rub and create heat",
  trine: "these two needs support each other without much effort",
  sextile: "these two needs can cooperate if you put them to use",
  quincunx: "these two needs keep missing each other and need adjusting",
  semisquare: "there is a low-grade scrape between these two needs",
  sesquiquadrate: "there is a restless scrape between these two needs",
};

function normalizeAspectName(name) {
  const t = String(name || "").toLowerCase();
  if (t === "conjunct") return "conjunction";
  if (t === "opposite") return "opposition";
  return t;
}

function parseClickedAspect(message) {
  const t = String(message || "").toLowerCase();
  const planets =
    "sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|ceres|pallas|juno|vesta";
  const aspects =
    "conjunction|conjunct|square|trine|opposition|opposite|sextile|quincunx|semisquare|sesquiquadrate";
  let m = t.match(
    new RegExp(
      "\\b(" + planets + ")\\s+(" + aspects + ")\\s+(?:to |with )?(" + planets + ")\\b",
    ),
  );
  if (!m) {
    m = t.match(
      new RegExp(
        "\\b(" +
          aspects +
          ")\\s+between\\s+(" +
          planets +
          ")\\s+and\\s+(" +
          planets +
          ")\\b",
      ),
    );
    if (m) return { planet1: m[2], aspect: normalizeAspectName(m[1]), planet2: m[3] };
    return null;
  }
  return { planet1: m[1], aspect: normalizeAspectName(m[2]), planet2: m[3] };
}

function samePlanetPair(a, b, x, y) {
  const A = String(a || "").toLowerCase();
  const B = String(b || "").toLowerCase();
  const X = String(x || "").toLowerCase();
  const Y = String(y || "").toLowerCase();
  return (A === X && B === Y) || (A === Y && B === X);
}

function lensPlacement(architecture, name) {
  const cond =
    (architecture.planetConditions && architecture.planetConditions[name]) ||
    (architecture.asteroidConditions && architecture.asteroidConditions[name]);
  if (cond && cond.house) return cond;
  const ast = architecture.asteroids && architecture.asteroids[name];
  if (ast) {
    return {
      house: Number(ast.house) || null,
      retrograde: !!ast.isRetrograde,
      dignity: "",
      majorAspects: [],
    };
  }
  return cond || {};
}

function formatAspectLensForModel(architecture, clicked, birthChart) {
  if (!clicked || !architecture || !architecture.ok) return "";
  const p1 = clicked.planet1;
  const p2 = clicked.planet2;
  const aspect = normalizeAspectName(clicked.aspect);
  const c1 = lensPlacement(architecture, p1);
  const c2 = lensPlacement(architecture, p2);
  const lines = [
    "--- ASPECT LENS (computed; answer the click through this) ---",
    "Clicked: " +
      titleCase(p1) +
      " " +
      aspect +
      " " +
      titleCase(p2) +
      ".",
    "In life: " +
      (PLANET_CLAIM[p1] || p1) +
      " / " +
      (PLANET_CLAIM[p2] || p2) +
      " — " +
      (ASPECT_PLAIN[aspect] || "these two needs are linked") +
      ".",
    architecture.unknownBirthTime
      ? titleCase(p1) +
        " is in " +
        (c1.sign || "its sign") +
        (c1.dignity ? " (" + c1.dignity + ")" : "") +
        (c1.retrograde ? ", in cycles" : "") +
        "."
      : titleCase(p1) +
        " shows up most in " +
        (HOUSE_CLAIM[c1.house] || "daily life") +
        (c1.dignity ? " (" + c1.dignity + ")" : "") +
        (c1.retrograde ? ", in cycles" : "") +
        ".",
    architecture.unknownBirthTime
      ? titleCase(p2) +
        " is in " +
        (c2.sign || "its sign") +
        (c2.dignity ? " (" + c2.dignity + ")" : "") +
        (c2.retrograde ? ", in cycles" : "") +
        "."
      : titleCase(p2) +
        " shows up most in " +
        (HOUSE_CLAIM[c2.house] || "daily life") +
        (c2.dignity ? " (" + c2.dignity + ")" : "") +
        (c2.retrograde ? ", in cycles" : "") +
        ".",
  ];
  if (architecture.unknownBirthTime) {
    lines.push(
      "Birth time is unknown: do not apply houses, house rulers, or ASC/MC aspects to this pair.",
    );
  }
  const links = [];
  const r = architecture.chartRuler;
  if (r && r.planet && (r.planet === p1 || r.planet === p2)) {
    links.push(titleCase(r.planet) + " is the chart through-line");
  }
  const tsqs =
    (architecture.configurations && architecture.configurations.tSquares) || [];
  tsqs.forEach(function (t) {
    const members = [t.focal].concat(t.opposition || []);
    if (members.indexOf(p1) !== -1 || members.indexOf(p2) !== -1) {
      links.push(
        "this pair sits in a three-way stress with " +
          (PLANET_CLAIM[t.focal] || t.focal) +
          " as the sore spot",
      );
    }
  });
  const doms = (architecture.dominantPlanets || []).map(function (d) {
    return d.planet;
  });
  if (doms.indexOf(p1) !== -1) links.push(titleCase(p1) + " is a main driver");
  if (doms.indexOf(p2) !== -1) links.push(titleCase(p2) + " is a main driver");
  if (links.length) {
    lines.push("Tie to the through-line: " + links.join("; ") + ".");
  }
  const neighbors = [];
  (c1.majorAspects || []).forEach(function (a) {
    if (!samePlanetPair(p1, a.other, p1, p2)) {
      neighbors.push(titleCase(p1) + " " + a.aspect + " " + titleCase(a.other));
    }
  });
  (c2.majorAspects || []).forEach(function (a) {
    if (!samePlanetPair(p2, a.other, p1, p2)) {
      neighbors.push(titleCase(p2) + " " + a.aspect + " " + titleCase(a.other));
    }
  });
  if (neighbors.length) {
    lines.push("Nearby connections (do not tour them): " + neighbors.slice(0, 4).join("; ") + ".");
  }
  lines.push("--- END ASPECT LENS ---");
  return lines.join("\n");
}

function formatTopicLensForModel(architecture, topic, birthChart) {
  if (!topic || !architecture || !architecture.ok) return "";
  if (architecture.unknownBirthTime) {
    const lines = [
      "--- TOPIC LENS (computed; answer the question through this) ---",
      "Life area: " + topic.label + ".",
      "Birth time is unknown. Do not use houses, house rulers, house occupants, or the displayed 0° Aries Ascendant.",
      "Answer from planetary signs, dignity, aspects, and dominant planets only.",
    ];
    (architecture.dominantPlanets || []).slice(0, 3).forEach(function (d, i) {
      const cond =
        (architecture.planetConditions && architecture.planetConditions[d.planet]) ||
        {};
      lines.push(
        (i === 0 ? "Main thread: " : "Also: ") +
          titleCase(d.planet) +
          " in " +
          (cond.sign || "?") +
          (cond.dignity ? " (" + cond.dignity + ")" : "") +
          ".",
      );
    });
    lines.push("--- END TOPIC LENS ---");
    return lines.join("\n");
  }
  const wanted = topic.houses || [];
  const chains = (architecture.houseChains || [])
    .filter((c) => wanted.indexOf(c.house) !== -1)
    .sort(function (a, b) {
      return wanted.indexOf(a.house) - wanted.indexOf(b.house);
    });
  const lines = [
    "--- TOPIC LENS (computed; answer the question through this) ---",
    "Life area: " + topic.label + ".",
  ];
  chains.forEach(function (c, i) {
    const role = i === 0 ? "Main thread" : "Also";
    lines.push(
      role +
        ": house " +
        c.house +
        " " +
        (c.sign || "?") +
        " is run by " +
        titleCase(c.ruler || "unknown") +
        " in " +
        (c.rulerSign || "?") +
        " house " +
        (c.rulerHouse || "?") +
        " (" +
        (c.rulerDignity || "?") +
        (c.rulerRetrograde ? ", retrograde" : "") +
        ").",
    );
  });
  const sitting = [];
  chains.forEach(function (c) {
    (c.occupants || []).forEach(function (name) {
      sitting.push(titleCase(name) + " in house " + c.house);
    });
  });
  if (!sitting.length && birthChart && birthChart.planets) {
    Object.entries(birthChart.planets).forEach(function ([name, p]) {
      if (p && wanted.indexOf(Number(p.house)) !== -1) {
        sitting.push(titleCase(name) + " in house " + p.house);
      }
    });
    const extraAsteroids = (architecture && architecture.asteroids) || {};
    Object.entries(extraAsteroids).forEach(function ([name, p]) {
      if (p && wanted.indexOf(Number(p.house)) !== -1) {
        sitting.push(titleCase(name) + " in house " + p.house);
      }
    });
  }
  if (sitting.length) {
    lines.push("Bodies sitting in this area: " + sitting.join("; ") + ".");
  }
  const astCond = architecture.asteroidConditions || {};
  const topicAst = [];
  Object.entries(astCond).forEach(function ([name, c]) {
    if (wanted.indexOf(Number(c.house)) !== -1) {
      const links = (c.majorAspects || [])
        .slice(0, 3)
        .map(function (a) {
          return a.aspect + " " + titleCase(a.other);
        });
      topicAst.push(
        titleCase(name) +
          " in house " +
          c.house +
          (links.length ? " (" + links.join(", ") + ")" : ""),
      );
    }
  });
  if (topicAst.length) {
    lines.push(
      "Enabled asteroids in this area (supporting): " + topicAst.join("; ") + ".",
    );
  }
  lines.push("--- END TOPIC LENS ---");
  return lines.join("\n");
}

module.exports = {
  buildChartArchitecture,
  ensureArchitecture,
  formatArchitectureForAI,
  buildChartThesis,
  buildThesisClaims,
  formatLockedClaimsForModel,
  detectLifeTopic,
  formatTopicLensForModel,
  parseClickedAspect,
  formatAspectLensForModel,
  LIFE_TOPICS,
  getChartRuler,
  getDignity,
};
