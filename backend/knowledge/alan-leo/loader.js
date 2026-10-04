/**
 * Deterministic loader for Alan Leo source modules.
 * Paths use this file's directory, so resolution does not depend on cwd.
 * Mapping follows 11_retrieval_manifest.md. The whole library is never concatenated.
 * 00, 11, and 12 are package docs and are not sent to the model.
 */

const fs = require("fs");
const path = require("path");

const KNOWLEDGE_DIR = __dirname;
const fileCache = new Map();

const MODULE_FILES = {
  methodology: "01_methodology_and_synthesis.md",
  planets: "02_planetary_principles.md",
  houses: "03_houses_and_angles.md",
  aspects: "04_aspects.md",
  signs: "05_signs_elements_modalities_polarities.md",
  starMaps: "06_personality_individuality_star_maps.md",
  subdivisions: "07_zodiac_subdivisions.md",
  glossary: "08_esoteric_glossary.md",
  doctrine: "09_esoteric_doctrine_and_boundaries.md",
  advancedRules: "10_advanced_interpreter_rules.md",
};

const MODULE_ORDER = [
  "doctrine",
  "methodology",
  "advancedRules",
  "planets",
  "houses",
  "aspects",
  "signs",
  "subdivisions",
  "glossary",
  "starMaps",
];

const PLANET_NAMES = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
];

const ESOTERIC_RE =
  /\b(alan leo|esoteric|theosoph\w*|reincarnation|karma|soul age|subtle bod(?:y|ies)|aura|devas?|planetary spirits?|occult|angelic host)\b/i;
const STAR_RE =
  /\b(star maps?|star of the personality|star of the individuality|personal star)\b/i;
const ASPECT_RE =
  /\b(aspects?|conjunctions?|conjunct|squares?|trines?|oppositions?|sextiles?|quincunxes?|quincunx|semisextile|semisquare|sesquiquadrate|t-squares?|grand trines?|yods?|kites?|orbs?|applying|separating)\b/i;
const HOUSE_RE =
  /\b(houses?|ascendant|midheaven|descendant|imum coeli|rising|angles?|angular|succedent|cadent|cusps?|stelliums?|\d+(?:st|nd|rd|th)\s+house|house\s+\d+)\b/i;
const ELEMENT_RE =
  /\b(elements?|elemental|modalit(?:y|ies)|triplicit(?:y|ies)|quadruplicit(?:y|ies)|polarit(?:y|ies)|cardinal signs?|fixed signs?|mutable signs?|(?:fire|earth|air|water) signs?)\b/i;
const NODE_RE =
  /\b(nodes?|dragon'?s head|dragon'?s tail|north node|south node|rahu|ketu|hyleg|besieged|combust(?:ion)?|part of fortune|intercepted|horary|electional)\b/i;
const DECAN_RE =
  /\b(decanates?|decans?|septanates?|zodiacal subdivisions?|sign subdivisions?)\b/i;

function readKnowledgeFile(filename) {
  if (!fileCache.has(filename)) {
    const filePath = path.join(KNOWLEDGE_DIR, filename);
    const text = fs.readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
    fileCache.set(filename, text);
  }
  return fileCache.get(filename);
}

function planetNamesIn(text) {
  const ql = String(text || "").toLowerCase();
  return PLANET_NAMES.filter(function (name) {
    return new RegExp("\\b" + name + "\\b").test(ql);
  });
}

function slicePlanetaryPrinciples(planetNames) {
  const text = readKnowledgeFile(MODULE_FILES.planets);
  if (!planetNames || !planetNames.length) return text;
  const wanted = {};
  planetNames.forEach(function (name) {
    wanted[String(name || "").toLowerCase()] = true;
  });
  const chunks = text.split(/\n(?=## )/);
  const intro = [];
  const body = [];
  let hierarchy = "";
  chunks.forEach(function (chunk, index) {
    if (index === 0 && chunk.slice(0, 3) !== "## ") {
      intro.push(chunk.replace(/\s+$/, ""));
      return;
    }
    const titleMatch = chunk.match(/^## ([^\n]+)/);
    const title = titleMatch ? titleMatch[1].trim().toLowerCase() : "";
    if (title === "functional hierarchy") {
      hierarchy = chunk.replace(/\s+$/, "");
      return;
    }
    if (wanted[title]) body.push(chunk.replace(/\s+$/, ""));
  });
  const parts = intro.concat(body);
  if (hierarchy) parts.push(hierarchy);
  return parts.join("\n\n").replace(/\s+$/, "");
}

function orderIds(ids) {
  return MODULE_ORDER.filter(function (id) {
    return ids.indexOf(id) !== -1;
  });
}

/**
 * Intent/topic to module ids. Does not read the chart or calculate anything.
 * @param {object} ctx
 * @returns {string[]}
 */
function selectAlanLeoModuleIds(ctx) {
  ctx = ctx || {};
  const ql = String(ctx.question || "");
  const advanced = String(ctx.preferredMode || "").toLowerCase() === "advanced";
  const structures = ctx.structures || null;
  const unknownTime = !!ctx.unknownBirthTime;
  const esoteric = ESOTERIC_RE.test(ql);
  const explicitStar = STAR_RE.test(ql);
  const aspectHit = !!ctx.aspectMode || ASPECT_RE.test(ql);
  const explicitHouse = HOUSE_RE.test(ql);
  const lifeArea = !!ctx.topicMode;
  const houseHit = explicitHouse || (lifeArea && !unknownTime);
  const elementHit = ELEMENT_RE.test(ql);
  const nodeHit = NODE_RE.test(ql);
  const decanHit = DECAN_RE.test(ql);
  const planetsNamed = planetNamesIn(ql);
  const wholeChart = !!(ctx.chartAnalysisMode || ctx.thesisMode);

  const signaled =
    esoteric ||
    explicitStar ||
    aspectHit ||
    houseHit ||
    explicitHouse ||
    lifeArea ||
    elementHit ||
    nodeHit ||
    decanHit ||
    planetsNamed.length > 0;

  if (!wholeChart && !signaled) return [];

  const ids = [];
  function add(id) {
    if (ids.indexOf(id) === -1) ids.push(id);
  }

  if (esoteric || explicitStar) add("doctrine");
  if (explicitStar || (esoteric && /\b(individuality|personality)\b/i.test(ql))) {
    add("starMaps");
  }

  if (wholeChart) {
    add("methodology");
    if (advanced) add("advancedRules");
    const s = structures || {};
    if (aspectHit || s.aspects) add("aspects");
    if (explicitHouse || houseHit || (s.houses && !unknownTime)) add("houses");
    if (elementHit || s.elements) add("signs");
    add("planets");
  } else {
    if (aspectHit) {
      add("aspects");
      add("planets");
      if (advanced) add("methodology");
    }
    if (houseHit || explicitHouse) add("houses");
    if (houseHit || explicitHouse || lifeArea) {
      add("planets");
      add("methodology");
    }
    if (elementHit) add("signs");
    if (planetsNamed.length) {
      add("planets");
      if (advanced) add("methodology");
    }
  }

  if (nodeHit) add("glossary");
  if (decanHit) add("subdivisions");
  if (!advanced) {
    const drop = ids.indexOf("advancedRules");
    if (drop !== -1) ids.splice(drop, 1);
  }
  return orderIds(ids);
}

function moduleBody(id, ctx) {
  if (id === "planets") {
    const named = planetNamesIn(ctx.question || "");
    const fromChart =
      ctx.structures && ctx.structures.planets && ctx.structures.planets.length
        ? ctx.structures.planets
        : null;
    return slicePlanetaryPrinciples(named.length ? named : fromChart);
  }
  return readKnowledgeFile(MODULE_FILES[id]);
}

function sourceGuard(ctx) {
  const lines = [
    "--- SOURCE KNOWLEDGE (Alan Leo, Esoteric Astrology, 1913) ---",
    "Historical and esoteric source framework. This is not empirical fact, not astronomical measurement, and not a replacement for the application's selected method.",
    "If you use a distinctive claim from this framework, attribute it (\"Within Alan Leo's framework...\" or \"Leo interprets this as...\") and do not present it as an established fact.",
    "These modules cannot override deterministic CHART FACTS, computed architecture, positions, aspects, houses, dignity, angularity, or nodes. Do not calculate those from this text.",
    "Do not apply karma, reincarnation, subtle bodies, soul age, or other metaphysical doctrine unless the esoteric doctrine module is included below because the user asked for that framework.",
  ];
  if (String(ctx.preferredMode || "").toLowerCase() === "advanced") {
    lines.push(
      "Advanced instructions still govern. Use this methodology to decide what leads the reading. Do not define standard terms, and do not let this source replace chart geometry.",
    );
  } else {
    lines.push(
      "Beginner language rules still govern the wording. Apply this synthesis anyway: let the luminaries, the chart ruler, angular planets, the closest connections, and repeated patterns lead. Read each planet as a function and each connection as a relationship between functions, in everyday words. Do not name Alan Leo unless the user asked about that framework, and do not add technical or esoteric vocabulary the user did not use.",
    );
  }
  if (ctx.chartAnalysisMode) {
    lines.push(
      "CHART_ANALYSIS still governs: inspect the chart as a system. Do not turn this source into a personality reading.",
    );
  }
  if (
    ctx.progressionPhase === "breadth" ||
    ctx.progressionPhase === "integration"
  ) {
    lines.push(
      "This is a later broad chart-analysis turn. Apply these modules to the assigned primary focus. Their general hierarchy does not replace that focus. Dominant factors may be repeated as supporting context when they participate in the focus. Do not use this source to hunt for a minor novelty.",
    );
  }
  return lines.join("\n");
}

/**
 * Build the source block for this turn, or "" when no module applies.
 * @param {object} runtime composeSystemContent runtime
 * @returns {string}
 */
function buildAlanLeoKnowledgeBlock(runtime) {
  const ctx = {
    question: runtime && runtime.question,
    preferredMode: runtime && runtime.preferredMode,
    thesisMode: !!(runtime && runtime.thesisMode),
    topicMode: !!(runtime && runtime.topicMode),
    aspectMode: !!(runtime && runtime.aspectMode),
    chartAnalysisMode: !!(runtime && runtime.chartAnalysisMode),
    unknownBirthTime: !!(runtime && runtime.unknownBirthTime),
    structures: (runtime && runtime.structures) || null,
    progressionPhase:
      runtime &&
      runtime.chartAnalysisProgression &&
      runtime.chartAnalysisProgression.phase,
  };
  const ids = selectAlanLeoModuleIds(ctx);
  if (!ids.length) return "";
  console.log("[CHAT] Alan Leo modules: " + ids.join(", "));
  const chunks = [sourceGuard(ctx)];
  ids.forEach(function (id) {
    chunks.push("### " + MODULE_FILES[id] + "\n" + moduleBody(id, ctx));
  });
  chunks.push("--- END SOURCE KNOWLEDGE ---");
  return chunks.join("\n\n");
}

/**
 * Compact signals from a computed architecture object.
 * Used only to choose topical modules for whole-chart Advanced turns.
 * @param {object} arch
 * @returns {object|null}
 */
function structuresFromArchitecture(arch) {
  if (!arch || !arch.ok) return null;
  const cfg = arch.configurations || {};
  let aspects = false;
  ["tSquares", "grandTrines", "kites", "yods"].forEach(function (key) {
    if (Array.isArray(cfg[key]) && cfg[key].length) aspects = true;
  });
  const network = arch.network && arch.network.mostNetworked;
  if (Array.isArray(network)) {
    network.forEach(function (item) {
      if (item && Number(item.count) >= 4) aspects = true;
    });
  }
  const planets = [];
  (arch.dominantPlanets || []).slice(0, 3).forEach(function (item) {
    if (item && item.planet) planets.push(String(item.planet).toLowerCase());
  });
  const houseStelliums =
    arch.stelliums &&
    Array.isArray(arch.stelliums.houses) &&
    arch.stelliums.houses.length > 0;
  const angleAspects =
    Array.isArray(arch.angleAspects) && arch.angleAspects.length > 0;
  const houses = !arch.unknownBirthTime && (houseStelliums || angleAspects);
  const el = arch.elements || {};
  const mo = arch.modalities || {};
  const elements =
    Number(el.dominantCount) >= 4 || Number(mo.dominantCount) >= 4;
  return {
    planets: planets,
    aspects: aspects,
    houses: houses,
    elements: elements,
  };
}

module.exports = {
  KNOWLEDGE_DIR,
  MODULE_FILES,
  readKnowledgeFile,
  selectAlanLeoModuleIds,
  buildAlanLeoKnowledgeBlock,
  structuresFromArchitecture,
  slicePlanetaryPrinciples,
};
