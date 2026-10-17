/**
 * Progressive depth for a planet, house, angle, or aspect.
 * Coverage is the set of dimension ids this selector assigns.
 * It is not read from assistant prose. The model is told those ids;
 * the stored record is the assignment.
 *
 * The full architecture stays in the prompt. This module only chooses
 * which supported dimensions to present.
 */

const { ensureArchitecture } = require("./chart_architecture");
const { chartCapabilities } = require("./chart_capabilities");

const PLANET_WORD =
  "sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|ceres|pallas|juno|vesta";
const OUTERS = { uranus: true, neptune: true, pluto: true };

const DIMENSIONS = {
  planet: [
    "placement",
    "house",
    "aspects",
    "dispositor",
    "angularity",
    "configuration",
    "life_area",
  ],
  house: ["topics", "occupants", "ruler", "ruler_aspects", "axis", "angularity"],
  angle: ["sign", "ruler", "aspects", "occupants", "life_area"],
  aspect: [
    "contact",
    "ends",
    "houses",
    "configuration",
    "dispositor",
    "angularity",
    "life_area",
  ],
};

const HOUSE_TOPICS = {
  1: "identity and beginnings",
  2: "money, skills, and security",
  3: "everyday communication and the immediate environment",
  4: "home, family, and private life",
  5: "creativity, pleasure, and what a person risks for joy",
  6: "work, health, and daily obligation",
  7: "one-to-one relationships",
  8: "shared resources, trust, and deep entanglement",
  9: "belief, study, and the wider horizon",
  10: "career, reputation, and public role",
  11: "friends, groups, and future aims",
  12: "solitude, endings, and what stays private",
};

const ANGLE_HOUSE = {
  ascendant: 1,
  "imum coeli": 4,
  descendant: 7,
  midheaven: 10,
};

const OPEN_DEPTH_RE =
  /^(?:please\s+)?(?:tell me more|say more|go deeper|go on|keep going|what else(?: stands out| do you see)?|anything else|and|can you (?:say|go) more)$/;

const CLARIFY_RE =
  /^(?:please\s+)?(?:why(?:\s+is that(?:\s+.*)?)?|why do i(?:\s+.*)?|how come(?:\s+.*)?|what do you mean(?:\s+by that)?|explain(?:\s+that)?|say that again|repeat(?:\s+that)?|can you (?:explain|clarify|repeat)(?:\s+that)?)$/;

const CUE_RULES = [
  {
    re: /\b(t-?squares?|grand trines?|yods?|kites?|stelliums?|configurations?)\b/,
    id: {
      planet: "configuration",
      house: "configuration",
      angle: "configuration",
      aspect: "configuration",
    },
  },
  {
    re: /\b(angular|on the angles?|ascendant|midheaven)\b/,
    id: {
      planet: "angularity",
      house: "angularity",
      angle: "aspects",
      aspect: "angularity",
    },
  },
  {
    re: /\bruler'?s aspects?\b|\baspects? (?:of|to) (?:the |its )?ruler\b/,
    id: { house: "ruler_aspects" },
  },
  {
    re: /\b(aspects?|conjunctions?|conjunct|squares?|trines?|oppositions?|sextiles?|quincunxes?)\b/,
    id: {
      planet: "aspects",
      house: "ruler_aspects",
      angle: "aspects",
      aspect: "contact",
    },
  },
  {
    re: /\b(dispositors?|rulership chains?|mutual reception)\b/,
    id: { planet: "dispositor", house: "ruler", angle: "ruler", aspect: "dispositor" },
  },
  {
    re: /\brulers?\b/,
    id: { planet: "dispositor", house: "ruler", angle: "ruler", aspect: "dispositor" },
  },
  {
    re: /\b(occupants?|who is in|planets in)\b/,
    id: { house: "occupants", angle: "occupants" },
  },
  {
    re: /\bhouses?\b/,
    id: { planet: "house", aspect: "houses", angle: "occupants", house: "topics" },
  },
  {
    re: /\b\d{1,2}(?:st|nd|rd|th)\b/,
    labelIncidental: true,
    id: { planet: "house", aspect: "houses" },
  },
  {
    re: /\b(career|job|relationships?|love life|money|finances?|family|home|friends?|health|purpose)\b/,
    id: {
      planet: "life_area",
      house: "topics",
      angle: "life_area",
      aspect: "life_area",
    },
  },
  {
    re: /\b(dignit(?:y|ies)|retrograde|exalt(?:ed|ation)?|detriment|fall|domicile|peregrine)\b/,
    id: { planet: "placement", aspect: "ends" },
  },
  {
    re: /\b(orbs?|applying|separating)\b/,
    id: { aspect: "contact", planet: "aspects" },
  },
  {
    re: /\b(opposite house|house axis)\b/,
    id: { house: "axis" },
  },
  {
    re: /\b(rising sign|sign on the)\b/,
    id: { angle: "sign" },
  },
];

function normalizeAsk(message) {
  return String(message || "")
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/[“”"]/g, "")
    .replace(/[!?.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(name) {
  const text = String(name || "");
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeAspectName(name) {
  const text = String(name || "").toLowerCase();
  if (text === "conjunct") return "conjunction";
  if (text === "opposite") return "opposition";
  return text;
}

function ordinal(n) {
  const value = Number(n);
  const teen = value % 100;
  if (teen >= 11 && teen <= 13) return value + "th";
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[value % 10] || "th";
  return value + suffix;
}

function kindFromKey(key) {
  if (!key) return "";
  if (key.indexOf("planet:") === 0) return "planet";
  if (key.indexOf("house:") === 0) return "house";
  if (key.indexOf("angle:") === 0) return "angle";
  if (key.indexOf("aspect:") === 0) return "aspect";
  return "";
}

function aspectStorageKey(aspect) {
  if (!aspect) return "";
  const left = String(aspect.planet1 || "").toLowerCase();
  const right = String(aspect.planet2 || "").toLowerCase();
  const name = normalizeAspectName(aspect.aspect);
  if (!left || !right || !name || left === right) return "";
  const planets = [left, right].sort();
  return "aspect:" + planets[0] + "|" + name + "|" + planets[1];
}

function describePlacement(text) {
  const source = normalizeAsk(text);
  if (!source) return null;
  const planet = source.match(new RegExp("\\b(" + PLANET_WORD + ")\\b"));
  if (planet) {
    return { kind: "planet", key: "planet:" + planet[1], planet: planet[1] };
  }
  const house = source.match(
    /\b(\d{1,2})(?:st|nd|rd|th)\s+house\b|\bhouse\s+(\d{1,2})\b/,
  );
  if (house) {
    const number = Number(house[1] || house[2]);
    if (number >= 1 && number <= 12) {
      return { kind: "house", key: "house:" + number, house: number };
    }
  }
  const angles = [
    ["ascendant", /\b(ascendant|rising(?:\s+sign)?)\b/],
    ["midheaven", /\b(midheaven|\bmc\b)\b/],
    ["descendant", /\bdescendant\b/],
    ["imum coeli", /\b(imum coeli|\bic\b)\b/],
  ];
  for (let i = 0; i < angles.length; i++) {
    if (angles[i][1].test(source)) {
      const angle = angles[i][0];
      const slug = angle.replace(/\s+/g, "-");
      return { kind: "angle", key: "angle:" + slug, angle: angle };
    }
  }
  return null;
}

function subjectKeyFromState(state) {
  if (!state) return "";
  if (state.intent === "ASPECT") return aspectStorageKey(state.aspect);
  if (state.intent === "PLACEMENT") {
    const described = describePlacement(state.subject);
    return described ? described.key : "";
  }
  return "";
}

function conditionOf(arch, name) {
  const key = String(name || "").toLowerCase();
  if (arch && arch.planetConditions && arch.planetConditions[key]) {
    return arch.planetConditions[key];
  }
  if (arch && arch.asteroidConditions && arch.asteroidConditions[key]) {
    return arch.asteroidConditions[key];
  }
  return null;
}

function bodyAllowed(arch, name) {
  const key = String(name || "").toLowerCase();
  const caps = chartCapabilities(arch);
  if (!caps.allowOuterPlanets && OUTERS[key]) return false;
  return !!conditionOf(arch, key);
}

function samePair(a, b, x, y) {
  const leftA = String(a || "").toLowerCase();
  const leftB = String(b || "").toLowerCase();
  const rightA = String(x || "").toLowerCase();
  const rightB = String(y || "").toLowerCase();
  return (
    (leftA === rightA && leftB === rightB) || (leftA === rightB && leftB === rightA)
  );
}

function findContact(arch, planet1, planet2, aspectName) {
  const want = normalizeAspectName(aspectName);
  const list = (arch && arch.aspectsAnnotated) || [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item) continue;
    if (normalizeAspectName(item.aspect) !== want) continue;
    if (samePair(item.planet1, item.planet2, planet1, planet2)) return item;
  }
  return null;
}

function houseChain(arch, number) {
  const chains = (arch && arch.houseChains) || [];
  for (let i = 0; i < chains.length; i++) {
    if (chains[i] && Number(chains[i].house) === Number(number)) return chains[i];
  }
  return null;
}

function occupantsOf(arch, number) {
  const chain = houseChain(arch, number);
  if (chain && Array.isArray(chain.occupants) && chain.occupants.length) {
    return chain.occupants.slice();
  }
  const found = [];
  const conditions = (arch && arch.planetConditions) || {};
  Object.keys(conditions).forEach(function (name) {
    if (!bodyAllowed(arch, name)) return;
    if (Number(conditions[name].house) === Number(number)) found.push(name);
  });
  const asteroids = (arch && arch.asteroidConditions) || {};
  Object.keys(asteroids).forEach(function (name) {
    if (Number(asteroids[name].house) === Number(number)) found.push(name);
  });
  return found;
}

function angleSign(angle, arch, chart) {
  const caps = chartCapabilities(arch);
  if (!caps.canUseAscendant && (angle === "ascendant" || angle === "descendant")) {
    return "";
  }
  if (!caps.canUseMC && (angle === "midheaven" || angle === "imum coeli")) {
    return "";
  }
  const angles = (chart && chart.angles) || {};
  if (angle === "ascendant" && angles.ascendant && angles.ascendant.sign) {
    return String(angles.ascendant.sign);
  }
  if (angle === "midheaven" && angles.midheaven && angles.midheaven.sign) {
    return String(angles.midheaven.sign);
  }
  const chain = houseChain(arch, ANGLE_HOUSE[angle]);
  return chain && chain.sign ? String(chain.sign) : "";
}

function bindAspect(aspect, arch) {
  const key = aspectStorageKey(aspect);
  if (!key || !arch || !arch.ok) return null;
  const planet1 = String(aspect.planet1 || "").toLowerCase();
  const planet2 = String(aspect.planet2 || "").toLowerCase();
  if (!bodyAllowed(arch, planet1) || !bodyAllowed(arch, planet2)) return null;
  const aspectName = normalizeAspectName(aspect.aspect);
  return {
    kind: "aspect",
    key: key,
    label: titleCase(planet1) + " " + aspectName + " " + titleCase(planet2),
    planets: [planet1, planet2],
    aspectName: aspectName,
    contact: findContact(arch, planet1, planet2, aspectName),
  };
}

function bindPlacement(text, arch, chart) {
  const described = describePlacement(text);
  if (!described || !arch || !arch.ok) return null;
  const caps = chartCapabilities(arch);
  if (described.kind === "planet") {
    if (!bodyAllowed(arch, described.planet)) return null;
    return {
      kind: "planet",
      key: described.key,
      label: titleCase(described.planet),
      planet: described.planet,
      condition: conditionOf(arch, described.planet),
    };
  }
  if (described.kind === "house") {
    return {
      kind: "house",
      key: described.key,
      label: ordinal(described.house) + " house",
      house: described.house,
      blocked: caps.canUseHouses ? "" : "unknown-time",
    };
  }
  if (described.kind === "angle") {
    return {
      kind: "angle",
      key: described.key,
      label: titleCase(described.angle),
      angle: described.angle,
      house: ANGLE_HOUSE[described.angle],
      blocked: caps.canUseHouses ? "" : "unknown-time",
    };
  }
  return null;
}

function identityForState(state, arch, chart) {
  if (!state || !arch || !arch.ok) return null;
  if (state.intent === "ASPECT") return bindAspect(state.aspect, arch);
  if (state.intent === "PLACEMENT") return bindPlacement(state.subject, arch, chart);
  return null;
}

function identityForRoute(route, arch, chart) {
  if (!route || !arch || !arch.ok) return null;
  if (route.primaryIntent === "ASPECT") return bindAspect(route.clickedAspect, arch);
  if (route.primaryIntent === "PLACEMENT") {
    return bindPlacement(route.questionForMode || route.asked, arch, chart);
  }
  return null;
}

function orbScore(orb) {
  const value = Number(orb);
  if (!Number.isFinite(value)) return 4;
  if (value <= 1) return 9;
  if (value <= 2) return 8;
  if (value <= 3) return 7;
  if (value <= 4) return 6;
  return 4;
}

function houseScore(houseClass) {
  if (houseClass === "angular") return 8;
  if (houseClass === "succedent") return 5;
  return 4;
}

function applyingPhrase(value) {
  if (value === true) return ", applying";
  if (value === false) return ", separating";
  return "";
}

function contactPhrase(item, leftName) {
  const other = titleCase(item.other || item.planet || "");
  const orb =
    item.orb != null && Number.isFinite(Number(item.orb)) ? item.orb + "°" : "";
  return (
    titleCase(leftName || item.planet || "") +
    " " +
    item.aspect +
    (other ? " " + other : "") +
    (orb ? " (orb " + orb + applyingPhrase(item.applying) + ")" : "")
  );
}

function tightest(list) {
  return (list || [])
    .filter(function (item) {
      return item && item.aspect;
    })
    .slice()
    .sort(function (a, b) {
      return Number(a.orb) - Number(b.orb);
    });
}

function placementLine(name, condition) {
  if (!condition || !condition.sign) return "";
  const dignity =
    condition.dignity && condition.dignity !== "peregrine"
      ? " (" + condition.dignity + ")"
      : condition.dignity === "peregrine"
        ? " (peregrine)"
        : "";
  const retro = condition.retrograde ? ", retrograde" : "";
  return titleCase(name) + " in " + condition.sign + dignity + retro + ".";
}

function dispositorFacts(arch, name) {
  const disp = (arch && arch.dispositors) || {};
  const record = disp.chains && disp.chains[name];
  if (!record || !Array.isArray(record.chain) || !record.chain.length) return null;
  const lines = [
    "Dispositor chain: " + record.chain.map(titleCase).join(" → ") + ".",
  ];
  if (disp.finalDispositor === name) {
    lines.push(titleCase(name) + " is the final dispositor.");
  }
  const hub = (disp.hubs || []).filter(function (item) {
    return item && item.planet === name;
  })[0];
  if (hub) lines.push(titleCase(name) + " is a dispositor hub (" + hub.count + ").");
  const receptions = (disp.mutualReceptions || []).filter(function (item) {
    return item && (item.planets || []).indexOf(name) !== -1;
  });
  receptions.forEach(function (item) {
    lines.push("Mutual reception: " + item.planets.map(titleCase).join("–") + ".");
  });
  let score = 4;
  if (receptions.length) score = 8;
  else if (hub || disp.finalDispositor === name) score = 7;
  else if (record.chain.length > 1) score = 6;
  else if (record.type === "final") score = 5;
  return { score: score, evidence: lines.join(" ") };
}

function memberList(names) {
  return (names || [])
    .filter(Boolean)
    .map(function (name) {
      return String(name).toLowerCase();
    });
}

function configurationFacts(arch, name) {
  const caps = chartCapabilities(arch);
  const hits = [];
  let strong = false;
  const cfg = (arch && arch.configurations) || {};
  (cfg.tSquares || []).forEach(function (item) {
    const members = memberList([item.focal].concat(item.opposition || []));
    if (members.indexOf(name) === -1) return;
    strong = true;
    hits.push(
      "T-square with focal " +
        titleCase(item.focal) +
        " and opposition " +
        (item.opposition || []).map(titleCase).join("–"),
    );
  });
  (cfg.grandTrines || []).forEach(function (item) {
    const members = memberList(item.planets);
    if (members.indexOf(name) === -1) return;
    strong = true;
    hits.push("Grand trine: " + (item.planets || []).map(titleCase).join(", "));
  });
  (cfg.kites || []).forEach(function (item) {
    const members = memberList((item.grandTrine || []).concat([item.focus]));
    if (members.indexOf(name) === -1) return;
    strong = true;
    hits.push(
      "Kite focus " +
        titleCase(item.focus) +
        " with grand trine " +
        (item.grandTrine || []).map(titleCase).join(", "),
    );
  });
  (cfg.yods || []).forEach(function (item) {
    const members = memberList((item.sextile || []).concat([item.apex]));
    if (members.indexOf(name) === -1) return;
    strong = true;
    hits.push(
      "Yod apex " +
        titleCase(item.apex) +
        " with sextile " +
        (item.sextile || []).map(titleCase).join("–"),
    );
  });
  const stelliums = (arch && arch.stelliums) || {};
  (stelliums.signs || []).forEach(function (item) {
    const members = memberList(item.planets);
    if (members.indexOf(name) === -1) return;
    hits.push(
      item.sign + " stellium: " + (item.planets || []).map(titleCase).join(", "),
    );
  });
  if (caps.canUseHouses) {
    (stelliums.houses || []).forEach(function (item) {
      const members = memberList(item.planets);
      if (members.indexOf(name) === -1) return;
      hits.push(
        "House " +
          item.house +
          " stellium: " +
          (item.planets || []).map(titleCase).join(", "),
      );
    });
  }
  if (!hits.length) return null;
  return {
    score: strong ? 8 : 6,
    evidence: hits.slice(0, 2).join(". ") + ".",
  };
}

function pairConfigurations(arch, planet1, planet2) {
  const cfg = (arch && arch.configurations) || {};
  const hits = [];
  function both(members) {
    const list = memberList(members);
    return list.indexOf(planet1) !== -1 && list.indexOf(planet2) !== -1;
  }
  (cfg.tSquares || []).forEach(function (item) {
    const members = [item.focal].concat(item.opposition || []);
    if (!both(members)) return;
    hits.push(
      "This contact sits in the T-square with focal " +
        titleCase(item.focal) +
        " and opposition " +
        (item.opposition || []).map(titleCase).join("–"),
    );
  });
  (cfg.grandTrines || []).forEach(function (item) {
    if (!both(item.planets)) return;
    hits.push(
      "This contact sits in the grand trine of " +
        (item.planets || []).map(titleCase).join(", "),
    );
  });
  (cfg.kites || []).forEach(function (item) {
    const members = (item.grandTrine || []).concat([item.focus]);
    if (!both(members)) return;
    hits.push("This contact sits in the kite focused on " + titleCase(item.focus));
  });
  (cfg.yods || []).forEach(function (item) {
    const members = (item.sextile || []).concat([item.apex]);
    if (!both(members)) return;
    hits.push("This contact sits in the yod with apex " + titleCase(item.apex));
  });
  if (!hits.length) return null;
  return { score: 8, evidence: hits.slice(0, 2).join(". ") + "." };
}

function angleContacts(arch, planet) {
  return ((arch && arch.angleAspects) || []).filter(function (item) {
    return item && String(item.planet || "").toLowerCase() === planet;
  });
}

function dim(id, role, order, score, evidence) {
  if (!evidence) return null;
  return { id: id, role: role, order: order, score: score, evidence: evidence };
}

function planetDimensions(identity, arch) {
  const caps = chartCapabilities(arch);
  const name = identity.planet;
  const condition = identity.condition || {};
  const list = [];
  const placement = placementLine(name, condition);
  const center = dim("placement", "center", 0, 10, placement);
  if (center) list.push(center);
  if (caps.canUseHouses && condition.house) {
    list.push(
      dim(
        "house",
        "support",
        1,
        houseScore(condition.houseClass),
        titleCase(name) +
          " is in house " +
          condition.house +
          (condition.houseClass ? " (" + condition.houseClass + ")" : "") +
          ".",
      ),
    );
  }
  const majors = tightest(condition.majorAspects);
  if (majors.length) {
    list.push(
      dim(
        "aspects",
        "support",
        2,
        orbScore(majors[0].orb),
        "Significant contacts: " +
          majors
            .slice(0, 2)
            .map(function (item) {
              return contactPhrase(item, name);
            })
            .join("; ") +
          ".",
      ),
    );
  }
  const ruler = dispositorFacts(arch, name);
  if (ruler) {
    list.push(dim("dispositor", "support", 3, ruler.score, ruler.evidence));
  }
  const angles = tightest(angleContacts(arch, name));
  if (caps.canUseHouses && angles.length) {
    list.push(
      dim(
        "angularity",
        "support",
        4,
        Math.max(6, orbScore(angles[0].orb)),
        "Angle contacts: " +
          angles
            .slice(0, 2)
            .map(function (item) {
              return contactPhrase(
                {
                  aspect: item.aspect,
                  other: item.angle,
                  orb: item.orb,
                  applying: item.applying,
                },
                name,
              );
            })
            .join("; ") +
          ".",
      ),
    );
  }
  const configs = configurationFacts(arch, name);
  if (configs) {
    list.push(dim("configuration", "support", 5, configs.score, configs.evidence));
  }
  if (caps.canUseHouses && condition.house && HOUSE_TOPICS[condition.house]) {
    list.push(
      dim(
        "life_area",
        "support",
        6,
        4,
        "House " +
          condition.house +
          " applies to " +
          HOUSE_TOPICS[condition.house] +
          ".",
      ),
    );
  }
  return list.filter(Boolean);
}

function houseDimensions(identity, arch) {
  const number = identity.house;
  const chain = houseChain(arch, number);
  const occupants = occupantsOf(arch, number);
  const list = [];
  const sign = chain && chain.sign ? " Cusp sign: " + chain.sign + "." : "";
  list.push(
    dim(
      "topics",
      "center",
      0,
      10,
      "House " +
        number +
        " applies to " +
        (HOUSE_TOPICS[number] || "the life of that house") +
        "." +
        sign,
    ),
  );
  if (occupants.length) {
    list.push(
      dim(
        "occupants",
        "support",
        1,
        occupants.length >= 2 ? 8 : 6,
        "Occupants of house " + number + ": " + occupants.map(titleCase).join(", ") + ".",
      ),
    );
  }
  if (chain && chain.ruler) {
    const where = [];
    if (chain.rulerSign) where.push(chain.rulerSign);
    if (chain.rulerHouse) where.push("house " + chain.rulerHouse);
    if (chain.rulerDignity) where.push(chain.rulerDignity);
    list.push(
      dim(
        "ruler",
        "support",
        2,
        7,
        "House " +
          number +
          " is ruled by " +
          titleCase(chain.ruler) +
          (where.length ? " (" + where.join(", ") + ")" : "") +
          ".",
      ),
    );
  }
  const rulerAspects = tightest((chain && chain.rulerAspects) || []);
  if (chain && chain.ruler && rulerAspects.length) {
    list.push(
      dim(
        "ruler_aspects",
        "support",
        3,
        orbScore(rulerAspects[0].orb),
        "Aspects of the ruler " +
          titleCase(chain.ruler) +
          ": " +
          rulerAspects
            .slice(0, 2)
            .map(function (item) {
              return contactPhrase(item, chain.ruler);
            })
            .join("; ") +
          ".",
      ),
    );
  }
  const opposite = number > 6 ? number - 6 : number + 6;
  const oppositeChain = houseChain(arch, opposite);
  const oppositeOccupants = occupantsOf(arch, opposite);
  if (oppositeChain || oppositeOccupants.length) {
    const extra = oppositeOccupants.length
      ? " Occupants there: " + oppositeOccupants.map(titleCase).join(", ") + "."
      : "";
    const signNote =
      oppositeChain && oppositeChain.sign ? " Cusp: " + oppositeChain.sign + "." : "";
    list.push(
      dim(
        "axis",
        "support",
        4,
        number === 1 || number === 4 || number === 7 || number === 10 ? 6 : 4,
        "House " + number + " faces house " + opposite + "." + signNote + extra,
      ),
    );
  }
  if (number === 1 || number === 4 || number === 7 || number === 10) {
    list.push(
      dim("angularity", "support", 5, 6, "House " + number + " is angular."),
    );
  }
  return list.filter(Boolean);
}

function angleDimensions(identity, arch, chart) {
  const number = identity.house;
  const chain = houseChain(arch, number);
  const sign = angleSign(identity.angle, arch, chart);
  const list = [];
  if (sign) {
    list.push(
      dim(
        "sign",
        "center",
        0,
        10,
        "The " + identity.label + " is " + sign + ".",
      ),
    );
  }
  if (chain && chain.ruler) {
    const where = [];
    if (chain.rulerSign) where.push(chain.rulerSign);
    if (chain.rulerHouse) where.push("house " + chain.rulerHouse);
    if (chain.rulerDignity) where.push(chain.rulerDignity);
    list.push(
      dim(
        "ruler",
        "support",
        1,
        7,
        "The " +
          identity.label +
          " is ruled by " +
          titleCase(chain.ruler) +
          (where.length ? " (" + where.join(", ") + ")" : "") +
          ".",
      ),
    );
  }
  const wantedAngle = identity.angle === "ascendant" || identity.angle === "midheaven"
    ? identity.angle
    : "";
  const contacts = wantedAngle
    ? ((arch && arch.angleAspects) || []).filter(function (item) {
        return item && item.angle === wantedAngle;
      })
    : [];
  if (contacts.length) {
    const ordered = tightest(contacts);
    list.push(
      dim(
        "aspects",
        "support",
        2,
        orbScore(ordered[0].orb),
        "Contacts to the " +
          identity.label +
          ": " +
          ordered
            .slice(0, 2)
            .map(function (item) {
              return contactPhrase(
                {
                  aspect: item.aspect,
                  other: item.angle,
                  orb: item.orb,
                  applying: item.applying,
                  planet: item.planet,
                },
                item.planet,
              );
            })
            .join("; ") +
          ".",
      ),
    );
  }
  const occupants = occupantsOf(arch, number);
  if (occupants.length) {
    list.push(
      dim(
        "occupants",
        "support",
        3,
        occupants.length >= 2 ? 8 : 6,
        "Bodies in house " + number + ": " + occupants.map(titleCase).join(", ") + ".",
      ),
    );
  }
  if (HOUSE_TOPICS[number]) {
    list.push(
      dim(
        "life_area",
        "support",
        4,
        4,
        "The " + identity.label + " applies to " + HOUSE_TOPICS[number] + ".",
      ),
    );
  }
  return list.filter(Boolean);
}

function aspectDimensions(identity, arch) {
  const caps = chartCapabilities(arch);
  const left = conditionOf(arch, identity.planets[0]) || {};
  const right = conditionOf(arch, identity.planets[1]) || {};
  const list = [];
  if (identity.contact) {
    const orb =
      identity.contact.orb != null && Number.isFinite(Number(identity.contact.orb))
        ? "orb " + identity.contact.orb + "°" + applyingPhrase(identity.contact.applying)
        : "";
    list.push(
      dim(
        "contact",
        "center",
        0,
        10,
        identity.label + (orb ? ", " + orb : "") + ".",
      ),
    );
  }
  const ends = [placementLine(identity.planets[0], left), placementLine(identity.planets[1], right)]
    .filter(Boolean)
    .join(" ");
  if (ends) list.push(dim("ends", "support", 1, 7, ends));
  if (caps.canUseHouses && (left.house || right.house)) {
    const bits = [];
    if (left.house) {
      bits.push(titleCase(identity.planets[0]) + " is in house " + left.house);
    }
    if (right.house) {
      bits.push(titleCase(identity.planets[1]) + " is in house " + right.house);
    }
    const angular =
      left.houseClass === "angular" || right.houseClass === "angular";
    list.push(dim("houses", "support", 2, angular ? 7 : 5, bits.join(". ") + "."));
  }
  const configs = pairConfigurations(arch, identity.planets[0], identity.planets[1]);
  if (configs) {
    list.push(dim("configuration", "support", 3, configs.score, configs.evidence));
  }
  const leftRule = dispositorFacts(arch, identity.planets[0]);
  const rightRule = dispositorFacts(arch, identity.planets[1]);
  if (leftRule || rightRule) {
    const score = Math.max(leftRule ? leftRule.score : 0, rightRule ? rightRule.score : 0);
    list.push(
      dim(
        "dispositor",
        "support",
        4,
        score,
        [leftRule && leftRule.evidence, rightRule && rightRule.evidence]
          .filter(Boolean)
          .join(" "),
      ),
    );
  }
  if (caps.canUseHouses) {
    const angles = angleContacts(arch, identity.planets[0]).concat(
      angleContacts(arch, identity.planets[1]),
    );
    if (angles.length) {
      const ordered = tightest(angles);
      list.push(
        dim(
          "angularity",
          "support",
          5,
          Math.max(6, orbScore(ordered[0].orb)),
          "Angle contacts: " +
            ordered
              .slice(0, 2)
              .map(function (item) {
                return contactPhrase(
                  {
                    aspect: item.aspect,
                    other: item.angle,
                    orb: item.orb,
                    applying: item.applying,
                  },
                  item.planet,
                );
              })
              .join("; ") +
            ".",
        ),
      );
    }
  }
  if (caps.canUseHouses && (left.house || right.house)) {
    const topics = [];
    if (left.house && HOUSE_TOPICS[left.house]) {
      topics.push("house " + left.house + " (" + HOUSE_TOPICS[left.house] + ")");
    }
    if (right.house && HOUSE_TOPICS[right.house] && right.house !== left.house) {
      topics.push("house " + right.house + " (" + HOUSE_TOPICS[right.house] + ")");
    }
    if (topics.length) {
      list.push(
        dim(
          "life_area",
          "support",
          6,
          4,
          "The contact applies through " + topics.join(" and ") + ".",
        ),
      );
    }
  }
  return list.filter(Boolean);
}

function availableDimensions(identity, arch, chart) {
  if (!identity || identity.blocked) return [];
  if (identity.kind === "planet") return planetDimensions(identity, arch);
  if (identity.kind === "house") return houseDimensions(identity, arch);
  if (identity.kind === "angle") return angleDimensions(identity, arch, chart);
  if (identity.kind === "aspect") {
    if (!identity.contact) return [];
    return aspectDimensions(identity, arch);
  }
  return [];
}

function rankedSupports(catalog, covered) {
  return catalog
    .filter(function (item) {
      return item.role === "support" && covered.indexOf(item.id) === -1;
    })
    .sort(function (a, b) {
      return b.score - a.score || a.order - b.order;
    });
}

function takeStrongPair(list) {
  if (!list.length) return [];
  const chosen = [list[0].id];
  if (list[1] && list[1].score >= 6) chosen.push(list[1].id);
  return chosen;
}

function initialSelection(catalog) {
  const centers = catalog.filter(function (item) {
    return item.role === "center";
  });
  const covered = centers.map(function (item) {
    return item.id;
  });
  return covered.concat(takeStrongPair(rankedSupports(catalog, covered)));
}

function continuationSelection(catalog, covered) {
  const center = catalog.filter(function (item) {
    return item.role === "center" && covered.indexOf(item.id) === -1;
  })[0];
  if (center) {
    const rest = rankedSupports(catalog, covered.concat([center.id]));
    const chosen = [center.id];
    if (rest.length) chosen.push(rest[0].id);
    return chosen;
  }
  return takeStrongPair(rankedSupports(catalog, covered));
}

function residue(message, identity) {
  let text = normalizeAsk(message);
  if (!identity) return text;
  if (identity.kind === "planet") {
    text = text.replace(new RegExp("\\b" + identity.planet + "\\b", "g"), " ");
  } else if (identity.kind === "house") {
    text = text.replace(/\b\d{1,2}(?:st|nd|rd|th)\s+house\b/g, " ");
    text = text.replace(/\bhouse\s+\d{1,2}\b/g, " ");
  } else if (identity.kind === "angle") {
    text = text.replace(
      /\b(ascendant|midheaven|descendant|imum coeli|rising(?:\s+sign)?|\bmc\b|\bic\b)\b/g,
      " ",
    );
  } else if (identity.kind === "aspect") {
    (identity.planets || []).forEach(function (planet) {
      text = text.replace(new RegExp("\\b" + planet + "\\b", "g"), " ");
    });
    text = text.replace(
      new RegExp("\\b(" + identity.aspectName + "|conjunct|opposite)\\b", "g"),
      " ",
    );
  }
  return text.replace(/\s+/g, " ").trim();
}

function isLabelLike(message) {
  const text = normalizeAsk(message);
  if (!text) return false;
  if (/^(what|which|how|does|do|is|are|why|where|when)\b/.test(text)) return false;
  return true;
}

function requestedDimension(kind, text, labelLike) {
  for (let i = 0; i < CUE_RULES.length; i++) {
    const rule = CUE_RULES[i];
    if (rule.labelIncidental && labelLike) continue;
    if (!rule.re.test(text)) continue;
    if (rule.id[kind]) return rule.id[kind];
  }
  return "";
}

function unique(list) {
  const out = [];
  (list || []).forEach(function (id) {
    if (out.indexOf(id) === -1) out.push(id);
  });
  return out;
}

function priorCovered(previous, identity) {
  if (!previous || !previous.coverage || !identity) return [];
  if (previous.coverage.subjectKey !== identity.key) return [];
  if (previous.coverage.kind !== identity.kind) return [];
  if (!Array.isArray(previous.coverage.covered)) return [];
  return previous.coverage.covered.slice();
}

function evidenceFor(catalog, ids) {
  return ids
    .map(function (id) {
      const found = catalog.filter(function (item) {
        return item.id === id;
      })[0];
      return found ? "- " + id + ": " + found.evidence : "";
    })
    .filter(Boolean);
}

function lengthLine(turn) {
  if (turn === "initial") {
    return "Length guideline: about 90–150 words. This is a guideline, not a hard limit.";
  }
  if (turn === "continue" || turn === "deepen") {
    return "Length guideline: about 140–220 words. This is a guideline, not a hard limit.";
  }
  if (turn === "specific") {
    return "Answer directly. Let the complexity of the question set the length. Do not pad the answer into a chart tour.";
  }
  if (turn === "clarify") {
    return "Restate or clarify at the length the question needs. Repeating the point is appropriate.";
  }
  return "Keep the reply short and exact.";
}

function unavailableReason(id, arch) {
  const caps = chartCapabilities(arch);
  const needsTime =
    id === "house" ||
    id === "houses" ||
    id === "life_area" ||
    id === "occupants" ||
    id === "ruler" ||
    id === "ruler_aspects" ||
    id === "axis" ||
    id === "angularity" ||
    id === "topics" ||
    id === "sign";
  if (needsTime && !caps.canUseHouses) {
    return "The current question asks about " +
      id +
      ". Birth time is unknown, so houses and angles are not available. Say that.";
  }
  if (id === "aspects" || id === "contact") {
    return "The current question asks about " +
      id +
      ". The computed chart does not list that contact. Say that it is not present.";
  }
  return "The current question asks about " +
    id +
    ", and this chart does not support that dimension for the subject. Say so.";
}

function buildDirective(spec) {
  const lines = [
    "THE ENTIRE CHART INFORMS THIS READING.",
    "The architecture and chart facts stay in context. Use them to understand the subject. Present only the dimensions assigned for this turn. Another chart factor may appear only when the assigned dimension cannot be explained without it. Do not survey the chart.",
    "Current chart subject: " + spec.label + " (" + spec.subjectKey + ").",
    "Subject wording: " + spec.subjectText + ".",
    "Current question: " + spec.question + ".",
    "The current chart subject and the current question are different. Answer the question about that subject.",
    "The subject remains " +
      spec.label +
      " even when the original selection is no longer in the conversation history.",
  ];
  if (spec.alreadyCovered.length) {
    lines.push(
      "Dimensions already assigned for this subject: " + spec.alreadyCovered.join(", ") + ".",
    );
  } else {
    lines.push("No interpretive dimension has been assigned for this subject yet.");
  }
  if (spec.turn === "absent") {
    lines.push(spec.absentReason);
    lines.push("Do not invent an aspect, house, ruler, or configuration to fill the gap.");
    lines.push(lengthLine("absent"));
    return lines.join("\n");
  }
  if (spec.turn === "clarify") {
    lines.push(
      "The current question asks for clarification or repetition. Restate the subject from the dimensions already assigned. Do not open an unassigned dimension.",
    );
    lines.push(lengthLine("clarify"));
    return lines.join("\n");
  }
  if (spec.turn === "deepen") {
    lines.push(
      "The supported dimensions of this subject have already been assigned. Relate those dimensions to each other. Do not restate the earlier reading as a whole. Do not invent a new factor.",
    );
    lines.push(lengthLine("deepen"));
    return lines.join("\n");
  }
  if (spec.unavailable) {
    lines.push(spec.unavailableReason);
    lines.push(
      "Do not invent it. Do not switch to a different unassigned dimension.",
    );
    lines.push(lengthLine("specific"));
    return lines.join("\n");
  }
  if (spec.presented.length) {
    lines.push("Assigned this turn: " + spec.presented.join(", ") + ".");
    lines.push("Evidence for the assigned dimensions:");
    evidenceFor(spec.catalog, spec.presented).forEach(function (line) {
      lines.push(line);
    });
  }
  if (spec.turn === "specific") {
    lines.push(
      "This is a specific question. Answer it. Do not redirect it toward an unassigned dimension.",
    );
    if (spec.alreadyCovered.length) {
      lines.push(
        "Do not repeat the earlier reading except where the question needs that point.",
      );
    }
  } else if (spec.turn === "continue") {
    lines.push(
      "This is an open continuation of the same subject. Develop the assigned dimensions. Do not restate the interpretation already assigned.",
    );
  } else {
    lines.push(
      "This is the opening reading of the subject. Give its central significance and only the assigned supporting dimensions.",
    );
  }
  lines.push(
    "Do not invent an aspect, house, ruler, dignity, or configuration that the architecture does not list.",
  );
  lines.push(lengthLine(spec.turn));
  return lines.join("\n");
}

function absentReason(identity) {
  if (identity && identity.blocked === "unknown-time") {
    return "Birth time is unknown, so this house or angle cannot be interpreted. Say that, then stop. Do not invent a cusp, a ruler, or a house story.";
  }
  if (identity && identity.kind === "aspect" && !identity.contact) {
    return (
      identity.label +
      " is not in the computed aspect list. Say that this contact is not present. Do not invent the aspect, an orb, or a meaning for it. Do not substitute a different aspect."
    );
  }
  return "The chart does not supply a supported dimension for this subject. Say what is missing. Do not invent a placement or an aspect.";
}

function buildUserNote(spec) {
  return (
    "[Current chart subject: " +
    spec.label +
    " (" +
    spec.subjectKey +
    "). Current question: " +
    spec.question +
    ". The subject remains " +
    spec.label +
    " even if the original selection is no longer in the conversation. Follow INTERPRETIVE DEPTH.]"
  );
}

function packageResult(spec) {
  const covered = unique(spec.alreadyCovered.concat(spec.presented));
  const possibleNext = spec.catalog
    .map(function (item) {
      return item.id;
    })
    .filter(function (id) {
      return covered.indexOf(id) === -1;
    });
  const full = {
    label: spec.label,
    subjectKey: spec.subjectKey,
    subjectText: spec.subjectText,
    question: spec.question,
    alreadyCovered: spec.alreadyCovered,
    presented: spec.presented,
    turn: spec.turn,
    unavailable: spec.unavailable,
    unavailableReason: spec.unavailableReason,
    absentReason: spec.absentReason,
    catalog: spec.catalog,
  };
  return {
    applicable: true,
    turn: spec.turn,
    subjectKey: spec.subjectKey,
    kind: spec.kind,
    label: spec.label,
    question: spec.question,
    subjectText: spec.subjectText,
    presented: spec.presented.slice(),
    alreadyCovered: spec.alreadyCovered.slice(),
    covered: covered,
    possibleNext: possibleNext,
    coverage: {
      subjectKey: spec.subjectKey,
      kind: spec.kind,
      covered: covered,
    },
    directive: buildDirective(full),
    userNote: buildUserNote(full),
  };
}

/**
 * @param {{ message: string, route: object, architecture: object, chart?: object, previous?: object }} input
 */
function selectInterpretiveDepth(input) {
  const route = input && input.route;
  const arch = input && input.architecture;
  const chart = input && input.chart;
  if (!route || (route.primaryIntent !== "PLACEMENT" && route.primaryIntent !== "ASPECT")) {
    return null;
  }
  if (!arch || !arch.ok) return null;
  const identity = identityForRoute(route, arch, chart);
  if (!identity) return { applicable: false };
  const message = input.message == null ? route.asked : input.message;
  const question = String(message || "");
  const subjectText = String(route.questionForMode || question);
  const already = priorCovered(input.previous, identity);
  if (identity.blocked || (identity.kind === "aspect" && !identity.contact)) {
    return packageResult({
      label: identity.label,
      subjectKey: identity.key,
      kind: identity.kind,
      subjectText: subjectText,
      question: question,
      alreadyCovered: already,
      presented: [],
      turn: "absent",
      unavailable: "",
      absentReason: absentReason(identity),
      catalog: [],
    });
  }
  const catalog = availableDimensions(identity, arch, chart);
  if (!catalog.length) {
    return packageResult({
      label: identity.label,
      subjectKey: identity.key,
      kind: identity.kind,
      subjectText: subjectText,
      question: question,
      alreadyCovered: already,
      presented: [],
      turn: "absent",
      unavailable: "",
      absentReason: absentReason(identity),
      catalog: [],
    });
  }
  const text = normalizeAsk(question);
  const asked = requestedDimension(identity.kind, residue(question, identity), isLabelLike(question));
  const allowed = DIMENSIONS[identity.kind] || [];
  let turn = "initial";
  let presented = [];
  let unavailable = "";
  if (asked && allowed.indexOf(asked) !== -1) {
    turn = "specific";
    const found = catalog.some(function (item) {
      return item.id === asked;
    });
    if (found) presented = [asked];
    else unavailable = asked;
  } else if (OPEN_DEPTH_RE.test(text)) {
    presented = continuationSelection(catalog, already);
    if (!already.length) {
      turn = "initial";
      presented = initialSelection(catalog);
    } else if (!presented.length) turn = "deepen";
    else turn = "continue";
  } else if (CLARIFY_RE.test(text)) {
    turn = "clarify";
    presented = [];
  } else if (isLabelLike(question)) {
    if (!already.length) {
      turn = "initial";
      presented = initialSelection(catalog);
    } else {
      presented = continuationSelection(catalog, already);
      turn = presented.length ? "continue" : "deepen";
    }
  } else {
    turn = "specific";
    const center = catalog.filter(function (item) {
      return item.role === "center";
    })[0];
    if (center && already.indexOf(center.id) === -1) presented = [center.id];
  }
  return packageResult({
    label: identity.label,
    subjectKey: identity.key,
    kind: identity.kind,
    subjectText: subjectText,
    question: question,
    alreadyCovered: already,
    presented: presented,
    turn: turn,
    unavailable: unavailable,
    unavailableReason: unavailable ? unavailableReason(unavailable, arch) : "",
    absentReason: "",
    catalog: catalog,
  });
}

function structuralCoverage(raw, state) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const kind = raw.kind;
  const allow = DIMENSIONS[kind];
  if (!allow) return null;
  const key = typeof raw.subjectKey === "string" ? raw.subjectKey.trim() : "";
  if (!key || key.length > 80 || kindFromKey(key) !== kind) return null;
  const expected = subjectKeyFromState(state);
  if (!expected || expected !== key) return null;
  if (!Array.isArray(raw.covered) || raw.covered.length > 12) return null;
  const covered = [];
  for (let i = 0; i < raw.covered.length; i++) {
    const id = raw.covered[i];
    if (typeof id !== "string" || allow.indexOf(id) === -1) return null;
    if (covered.indexOf(id) === -1) covered.push(id);
  }
  return { subjectKey: key, kind: kind, covered: covered };
}

/**
 * Drop a coverage record that does not match the stored subject or the
 * dimensions this chart can actually support.
 */
function sanitizeCoverage(raw, state, chart) {
  const structural = structuralCoverage(raw, state);
  if (!structural) return null;
  let arch = null;
  try {
    arch = ensureArchitecture(chart);
  } catch (err) {
    arch = null;
  }
  if (!arch || !arch.ok) return structural;
  const identity = identityForState(state, arch, chart);
  if (!identity || identity.key !== structural.subjectKey || identity.kind !== structural.kind) {
    return null;
  }
  if (identity.blocked || (identity.kind === "aspect" && !identity.contact)) {
    return { subjectKey: structural.subjectKey, kind: structural.kind, covered: [] };
  }
  const available = {};
  availableDimensions(identity, arch, chart).forEach(function (item) {
    available[item.id] = true;
  });
  return {
    subjectKey: structural.subjectKey,
    kind: structural.kind,
    covered: structural.covered.filter(function (id) {
      return available[id];
    }),
  };
}

module.exports = {
  DIMENSIONS,
  selectInterpretiveDepth,
  sanitizeCoverage,
  subjectKeyFromState,
  aspectStorageKey,
};
