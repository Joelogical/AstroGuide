/**
 * CHART_ANALYSIS intent: inspect the natal chart as a technical system.
 * Distinct from PERSONAL_INTERPRETATION (thesis / who they are).
 */

const { getPromptSection } = require("./prompt_loader");
const { isFactualQuestion } = require("./factual_questions");

const PLANET_WORD =
  "sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|ceres|pallas|juno|vesta";
const SIGN_WORD =
  "aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces";
const OUTER_PLANETS = { uranus: true, neptune: true, pluto: true };
const MAJOR_IMPORTANCE = 4;

function normalizeAsk(message) {
  return String(message || "")
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/[!?.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(please|hey|ok|okay)\s+/, "")
    .replace(/\s+please$/, "")
    .replace(/^(can you|could you|would you)\s+/, "");
}

function hasExplicitAnalyticalTarget(message) {
  const t = normalizeAsk(message);
  if (!t) return false;
  if (new RegExp("\\b(" + PLANET_WORD + ")\\b").test(t)) return true;
  if (new RegExp("\\b(" + SIGN_WORD + ")\\b").test(t)) return true;
  if (
    /\b(ascendant|midheaven|descendant|imum coeli|rising|houses?|\d+(?:st|nd|rd|th)\s+house|house\s+\d+)\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\b(conjunctions?|conjunct|squares?|trines?|oppositions?|sextiles?|quincunxes?|aspects?|orbs?|degrees?|retrograde)\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (/\b(t-?squares?|grand trines?|yods?|kites?|stelliums?)\b/.test(t)) {
    return true;
  }
  if (
    /\b(career|job|work|relationships?|love|money|finances?|family|home|friends?|health|purpose)\b/.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

function isExplicitBroadChartPrompt(message) {
  const t = normalizeAsk(message);
  if (!t || hasExplicitAnalyticalTarget(t)) return false;
  if (
    /^(tell me about|analyze|analyse|read|interpret|walk me through)( my| the| this)?( birth)? chart$/.test(
      t,
    )
  ) {
    return true;
  }
  if (/^what stands out( in| about)?( my| the| this)?( birth)? chart$/.test(t)) {
    return true;
  }
  if (/^what stands out$/.test(t)) return true;
  if (
    /^what(?:'s| is) interesting( about)?( my| the| this)?( birth)?( chart)?$/.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /^what(?:'s| is) (going on|happening)( in)?( my| the| this)?( birth)? chart$/.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

function isOpenContinuation(message) {
  const t = normalizeAsk(message);
  if (!t || hasExplicitAnalyticalTarget(t) || isFactualQuestion(t)) return false;
  return /^(tell me more|say more|go deeper|go on|keep going|what else stands out|what else do you see|what else|anything else|and)$/.test(
    t,
  );
}

function isInherentChartAnalysisQuestion(message) {
  if (isFactualQuestion(message)) return false;
  if (
    hasExplicitAnalyticalTarget(message) &&
    !isExplicitBroadChartPrompt(message)
  ) {
    return false;
  }
  if (isExplicitBroadChartPrompt(message)) return true;
  const t = String(message || "").toLowerCase().trim();
  if (!t) return false;
  if (
    /\b(analyze|analyse|interpret(ing)?)\s+(my |the |this )?(birth )?chart\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (/\btell me about (my |the |this )?(birth )?chart\b/.test(t)) return true;
  if (/\bwalk (me )?through (my |the |this )?(birth )?chart\b/.test(t)) {
    return true;
  }
  if (/\bread (my |the |this )?(birth )?chart\b/.test(t)) return true;
  if (/\bchart architecture\b/.test(t)) return true;
  if (/\bwhat stands out\b/.test(t) && /\bchart\b/.test(t) && !/\belse\b/.test(t)) {
    return true;
  }
  if (/\bwhat('s| is) interesting about (my |the |this )?chart\b/.test(t)) {
    return true;
  }
  if (
    /\bdominant (features|themes|patterns|factors|structures)\b/.test(t) &&
    /\bchart\b/.test(t)
  ) {
    return true;
  }
  if (
    /\b(what )?(patterns|configurations|structures) (are )?(present|in|showing)\b/.test(
      t,
    ) &&
    /\bchart\b/.test(t)
  ) {
    return true;
  }
  if (/\btechnically significant\b/.test(t) && /\bchart\b/.test(t)) return true;
  if (
    /\bwhat('s| is) (in|going on in|happening (in|astrologically in)) (my |the |this )?(birth )?chart\b/.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

function contextIsChartAnalysis(history) {
  const users = (history || []).filter(function (message) {
    return message && message.role === "user" && message.content;
  });
  for (let i = users.length - 1; i >= 0; i--) {
    const text = users[i].content;
    if (isFactualQuestion(text)) return false;
    if (isOpenContinuation(text)) continue;
    if (
      hasExplicitAnalyticalTarget(text) &&
      !isExplicitBroadChartPrompt(text)
    ) {
      return false;
    }
    return isInherentChartAnalysisQuestion(text);
  }
  return false;
}

/**
 * Broad chart questions, including short ones and vague continuations.
 * A continuation inherits CHART_ANALYSIS only from preceding chart-analysis context.
 * An explicit planet, aspect, house, or life-area target is not broad.
 */
function isBroadChartAnalysisPrompt(message, history) {
  if (isFactualQuestion(message)) return false;
  if (
    hasExplicitAnalyticalTarget(message) &&
    !isExplicitBroadChartPrompt(message)
  ) {
    return false;
  }
  if (isExplicitBroadChartPrompt(message)) return true;
  return isOpenContinuation(message) && contextIsChartAnalysis(history);
}

function isChartAnalysisQuestion(message, history) {
  if (isFactualQuestion(message)) return false;
  if (
    hasExplicitAnalyticalTarget(message) &&
    !isExplicitBroadChartPrompt(message)
  ) {
    return false;
  }
  if (isBroadChartAnalysisPrompt(message, history)) return true;
  const t = String(message || "").toLowerCase().trim();
  if (!t) return false;
  if (
    /\b(analyze|analyse|interpret(ing)?)\s+(my |the |this )?(birth )?chart\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (/\btell me about (my |the |this )?(birth )?chart\b/.test(t)) return true;
  if (/\bwalk (me )?through (my |the |this )?(birth )?chart\b/.test(t)) {
    return true;
  }
  if (/\bread (my |the |this )?(birth )?chart\b/.test(t)) return true;
  if (/\bchart architecture\b/.test(t)) return true;
  if (/\bwhat stands out\b/.test(t) && /\bchart\b/.test(t)) return true;
  if (/\bwhat('s| is) interesting about (my |the |this )?chart\b/.test(t)) {
    return true;
  }
  if (
    /\bdominant (features|themes|patterns|factors|structures)\b/.test(t) &&
    /\bchart\b/.test(t)
  ) {
    return true;
  }
  if (
    /\b(what )?(patterns|configurations|structures) (are )?(present|in|showing)\b/.test(
      t,
    ) &&
    /\bchart\b/.test(t)
  ) {
    return true;
  }
  if (/\btechnically significant\b/.test(t) && /\bchart\b/.test(t)) return true;
  if (
    /\bwhat('s| is) (in|going on in|happening (in|astrologically in)) (my |the |this )?(birth )?chart\b/.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

function getChartAnalysisRules(preferredMode, progression) {
  const advanced = String(preferredMode || "").toLowerCase() === "advanced";
  let text =
    getPromptSection("chart-analysis.md", "shared") +
    "\n\n" +
    getPromptSection(
      "chart-analysis.md",
      advanced ? "advanced" : "beginner",
    );
  if (progression && progression.phase === "breadth") {
    text +=
      "\n\n" +
      getPromptSection("chart-analysis.md", "progression") +
      "\n\n" +
      String(progression.directive || "");
  } else if (progression && progression.phase === "integration") {
    text +=
      "\n\n" +
      getPromptSection("chart-analysis.md", "integration") +
      "\n\n" +
      String(progression.directive || "");
  } else if (progression && progression.phase === "overview") {
    text += "\n\n" + getPromptSection("chart-analysis.md", "overview");
  }
  return text;
}

const ANALYSIS_LENSES = [
  {
    id: "rulership_chains",
    label: "dispositorship and rulership chains",
    cues: [
      /\bdispositors?\b/i,
      /\brulership chains?\b/i,
      /\bfinal dispositor\b/i,
      /\banswers to\b/i,
      /\bchain of rulers\b/i,
    ],
    available: function (arch) {
      const d = arch.dispositors || {};
      return !!(
        d.finalDispositor ||
        (d.hubs && d.hubs.length) ||
        (d.chains && d.chains.length) ||
        (!arch.unknownBirthTime &&
          arch.houseChains &&
          arch.houseChains.length)
      );
    },
    task: "Trace who rules whom from the architecture: final dispositor, dispositor hubs, and, only when birth time is known, the house-ruler chains. Do not invent a chain that is not listed.",
  },
  {
    id: "aspect_topology",
    label: "aspect topology",
    cues: [
      /\baspect networks?\b/i,
      /\bmost networked\b/i,
      /\bapplying\b/i,
      /\bseparating\b/i,
      /\btopology\b/i,
    ],
    available: function (arch) {
      const network = arch.network || {};
      const cfg = arch.configurations || {};
      const hasConfig = ["tSquares", "grandTrines", "kites", "yods"].some(
        function (key) {
          return Array.isArray(cfg[key]) && cfg[key].length;
        },
      );
      return !!(
        (network.mostNetworked && network.mostNetworked.length) ||
        hasConfig ||
        (arch.aspectsAnnotated && arch.aspectsAnnotated.length)
      );
    },
    task: "Describe the aspect network as a system: which planets are highly connected, which contacts are tight, and which are applying or separating. Use the orbs and applying/separating flags already in the architecture.",
  },
  {
    id: "house_axes",
    label: "house-axis organization",
    cues: [
      /\bhouse axis\b/i,
      /\b(1st\s*\/\s*7th|4th\s*\/\s*10th|1st and 7th|4th and 10th)\b/i,
      /\bopposite houses\b/i,
      /\bascendant[- ]descendant\b/i,
    ],
    available: function (arch) {
      return (
        !arch.unknownBirthTime &&
        Array.isArray(arch.houseChains) &&
        arch.houseChains.length > 0
      );
    },
    task: "Organize the houses by axis, especially 1/7 and 4/10, using the house-ruler chains in the architecture. Name an axis only when those houses or their rulers are actually emphasized.",
  },
  {
    id: "angular_structure",
    label: "angular structure",
    cues: [
      /\bangular planets?\b/i,
      /\bon the angles\b/i,
      /\b(conjunct|conjunction to) the (ascendant|midheaven|descendant|imum)\b/i,
      /\baspects? to (the )?(asc|mc|ascendant|midheaven)\b/i,
    ],
    available: function (arch) {
      if (arch.unknownBirthTime) return false;
      if (arch.angleAspects && arch.angleAspects.length) return true;
      const conditions = arch.planetConditions || {};
      return Object.keys(conditions).some(function (name) {
        return conditions[name] && conditions[name].houseClass === "angular";
      });
    },
    task: "Examine planets on the angles and aspects to the Ascendant and Midheaven, as listed. Say which angles are occupied or contacted and which are quiet.",
  },
  {
    id: "dignity_reception",
    label: "dignity and reception",
    cues: [
      /\b(domicile|exaltation|detriment|fall|peregrine)\b/i,
      /\bessential dignity\b/i,
      /\bmutual reception\b/i,
      /\bdebilit/i,
    ],
    available: function (arch) {
      const conditions = arch.planetConditions || {};
      const dignified = Object.keys(conditions).some(function (name) {
        const dignity = conditions[name] && conditions[name].dignity;
        return dignity && dignity !== "peregrine";
      });
      const receptions =
        arch.dispositors &&
        arch.dispositors.mutualReceptions &&
        arch.dispositors.mutualReceptions.length;
      return !!(dignified || receptions);
    },
    task: "Examine essential dignity, debility, and any mutual reception already computed. Do not recalculate dignity from sign names.",
  },
  {
    id: "configurations",
    label: "aspect configurations",
    cues: [
      /\bt-?squares?\b/i,
      /\bgrand trines?\b/i,
      /\byods?\b/i,
      /\bkites?\b/i,
    ],
    available: function (arch) {
      const cfg = arch.configurations || {};
      return ["tSquares", "grandTrines", "kites", "yods"].some(function (key) {
        return Array.isArray(cfg[key]) && cfg[key].length;
      });
    },
    task: "Examine the named configurations in the architecture as systems, including the focal or apex planet. Do not invent a T-square, grand trine, kite, or yod that is not listed.",
  },
  {
    id: "element_modality",
    label: "elemental and modal distribution",
    cues: [
      /\belemental\b/i,
      /\bmodalit/i,
      /\b(cardinal|fixed|mutable)\b/i,
      /\b(fire|earth|air|water) (dominant|emphasis|shortage|lacking|heavy)\b/i,
    ],
    available: function (arch) {
      return !!(arch.elements && arch.elements.distribution);
    },
    task: "Examine the elemental and modality counts in the architecture, including what is crowded and what is thin. Do not turn the distribution into a personality type.",
  },
  {
    id: "isolated_planets",
    label: "isolated or weakly integrated planets",
    cues: [
      /\bunaspected\b/i,
      /\bweakly integrated\b/i,
      /\bstan(ds|d) apart\b/i,
      /\bno major aspects\b/i,
    ],
    available: function (arch) {
      const network = arch.network || {};
      if (network.unaspected && network.unaspected.length) return true;
      const conditions = arch.planetConditions || {};
      return Object.keys(conditions).some(function (name) {
        const majors =
          conditions[name] && conditions[name].majorAspects
            ? conditions[name].majorAspects
            : [];
        return majors.length <= 1;
      });
    },
    task: "Examine planets the architecture marks as unaspected, or that have only a weak tie into the main network. Say how they sit outside the denser pattern.",
  },
  {
    id: "secondary_unusual",
    label: "secondary but technically unusual structures",
    cues: [
      /\bsingletons?\b/i,
      /\bchart shape\b/i,
      /\b(bundle|bowl|bucket|locomotive|seesaw|splay)\b/i,
    ],
    available: function (arch) {
      const singletons = arch.singletons || {};
      const hasSingleton =
        (singletons.elements && singletons.elements.length) ||
        (singletons.modalities && singletons.modalities.length);
      const shape =
        arch.shape && arch.shape.jones && arch.shape.jones.name
          ? String(arch.shape.jones.name)
          : "";
      return !!(
        hasSingleton ||
        /bundle|bowl|bucket|locomotive|seesaw|splay/i.test(shape)
      );
    },
    task: "Examine one secondary structure that is technically unusual here, such as a singleton or the named chart shape. Place it beside the dominant pattern without repeating that pattern.",
  },
];

/**
 * The client sends history that already includes the message just submitted.
 * Drop that trailing copy so the first broad question is not treated as a repeat.
 */
function historyBeforeCurrentTurn(currentMsg, history) {
  const items = Array.isArray(history) ? history.slice() : [];
  const text = String(currentMsg || "").trim();
  const last = items[items.length - 1];
  if (
    last &&
    last.role === "user" &&
    String(last.content || "").trim() === text
  ) {
    items.pop();
  }
  return items;
}

function allowedPlanet(arch, name) {
  const key = String(name || "").toLowerCase();
  if (!key) return false;
  if (arch && arch.chartSystem === "traditional" && OUTER_PLANETS[key]) {
    return false;
  }
  return true;
}

function timeKnown(arch) {
  return !!(arch && arch.ok && !arch.unknownBirthTime);
}

function dominants(arch) {
  return ((arch && arch.dominantPlanets) || []).filter(function (item) {
    return item && allowedPlanet(arch, item.planet);
  });
}

function configList(arch) {
  const cfg = (arch && arch.configurations) || {};
  return ["tSquares", "grandTrines", "kites", "yods"].reduce(function (all, key) {
    return all.concat(cfg[key] || []);
  }, []);
}

function lensImportance(id, arch) {
  if (!arch || !arch.ok) return 0;
  const tops = dominants(arch).slice(0, 3);
  const topNames = tops.map(function (item) {
    return item.planet;
  });
  const conditions = arch.planetConditions || {};
  if (id === "configurations") return configList(arch).length ? 8 : 0;
  if (id === "rulership_chains") {
    const disp = arch.dispositors || {};
    const hubs = (disp.hubs || []).filter(function (hub) {
      return hub && allowedPlanet(arch, hub.planet) && Number(hub.count) >= 3;
    });
    let score = 0;
    if (
      disp.finalDispositor &&
      allowedPlanet(arch, disp.finalDispositor) &&
      topNames.indexOf(disp.finalDispositor) !== -1
    ) {
      score += 6;
    }
    if (hubs.length) score += 4;
    return score;
  }
  if (id === "aspect_topology") {
    const networked = (
      (arch.network && arch.network.mostNetworked) ||
      []
    ).filter(function (item) {
      return item && allowedPlanet(arch, item.planet);
    });
    let score = 0;
    networked.forEach(function (item) {
      if (Number(item.count) >= 5) score += 6;
      else if (Number(item.count) >= 4) score += 4;
    });
    let tight = 0;
    (arch.aspectsAnnotated || []).forEach(function (aspect) {
      if (!aspect || !aspect.major || Number(aspect.orb) > 2) return;
      if (
        !allowedPlanet(arch, aspect.planet1) ||
        !allowedPlanet(arch, aspect.planet2)
      ) {
        return;
      }
      tight += 1;
    });
    if (tight >= 2) score += 4;
    return score;
  }
  if (id === "house_axes") {
    if (!timeKnown(arch)) return 0;
    const angularHouse = { 1: true, 4: true, 7: true, 10: true };
    let score = 0;
    ((arch.stelliums && arch.stelliums.houses) || []).forEach(function (item) {
      if (item && angularHouse[item.house]) score += 5;
    });
    return score;
  }
  if (id === "angular_structure") {
    if (!timeKnown(arch)) return 0;
    let score = 0;
    const angles = arch.angleAspects || [];
    if (angles.length) score += 4;
    if (
      angles.some(function (aspect) {
        return aspect && Number(aspect.orb) <= 3;
      })
    ) {
      score += 2;
    }
    const angularDominant = tops.some(function (item) {
      const condition = conditions[item.planet];
      return condition && condition.houseClass === "angular";
    });
    if (angularDominant) score += 5;
    return score;
  }
  if (id === "dignity_reception") {
    let score = 0;
    const receptions =
      arch.dispositors && arch.dispositors.mutualReceptions
        ? arch.dispositors.mutualReceptions
        : [];
    if (receptions.length) score += 6;
    tops.forEach(function (item) {
      const dignity = conditions[item.planet] && conditions[item.planet].dignity;
      if (dignity && dignity !== "peregrine") score += 4;
    });
    return score;
  }
  if (id === "element_modality") {
    const elements = arch.elements || {};
    const modalities = arch.modalities || {};
    let score = 0;
    if (Number(elements.dominantCount) >= 5) score += 6;
    else if (Number(elements.dominantCount) >= 4) score += 4;
    if (Number(modalities.dominantCount) >= 5) score += 4;
    else if (Number(modalities.dominantCount) >= 4) score += 3;
    return score;
  }
  if (id === "isolated_planets") {
    const unaspected = (
      (arch.network && arch.network.unaspected) ||
      []
    ).filter(function (name) {
      return allowedPlanet(arch, name);
    });
    if (!unaspected.length) return 0;
    const top = {};
    tops.forEach(function (item) {
      top[item.planet] = true;
    });
    let score = 0;
    unaspected.forEach(function (name) {
      if (top[name] || name === "sun" || name === "moon") score += 5;
    });
    return score;
  }
  return 0;
}

function developedSentences(text, cues) {
  return String(text || "")
    .split(/[.!?]+/)
    .map(function (sentence) {
      return sentence.trim();
    })
    .filter(function (sentence) {
      return (
        sentence.length >= 40 &&
        cues.some(function (re) {
          return re.test(sentence);
        })
      );
    });
}

function lensIsCovered(history, cues) {
  return (history || []).some(function (message) {
    return (
      message &&
      message.role === "assistant" &&
      developedSentences(message.content, cues).length >= 3
    );
  });
}

function priorBroadCount(history) {
  const items = history || [];
  let count = 0;
  items.forEach(function (message, index) {
    if (!message || message.role !== "user") return;
    if (isBroadChartAnalysisPrompt(message.content, items.slice(0, index))) {
      count += 1;
    }
  });
  return count;
}

const INTEGRATION_PASSES = [
  {
    id: "integrate_relations",
    label: "how the analyzed structures relate",
    cues: [
      /\bthese structures\b/i,
      /\brelationship between\b/i,
      /\btogether they\b/i,
      /\bone qualifies the other\b/i,
    ],
    importance: function (arch, coveredIds) {
      return coveredIds.length >= 2 ? 7 : 0;
    },
    task: "Relate the structures already analyzed. Show where they reinforce, qualify, or contradict one another. Do not open a new minor category.",
  },
  {
    id: "integrate_dispositor_aspects",
    label: "dispositorship together with the aspect network",
    cues: [
      /\bdispositor[^.!?]{0,80}aspect/i,
      /\baspect network[^.!?]{0,80}dispositor/i,
      /\bchain[^.!?]{0,60}(square|trine|opposition|conjunction)/i,
    ],
    importance: function (arch) {
      if (lensImportance("rulership_chains", arch) < MAJOR_IMPORTANCE) return 0;
      if (lensImportance("aspect_topology", arch) < MAJOR_IMPORTANCE) return 0;
      return 6;
    },
    task: "Show how the dispositor chain and the aspect network act on the same planets. Use only links already present in the architecture.",
  },
  {
    id: "integrate_houses_angles",
    label: "house rulership together with angularity",
    cues: [
      /\bhouse ruler[^.!?]{0,80}angular/i,
      /\bangular[^.!?]{0,80}(house ruler|rulership)/i,
    ],
    importance: function (arch) {
      if (!timeKnown(arch)) return 0;
      if (lensImportance("angular_structure", arch) < MAJOR_IMPORTANCE) return 0;
      return 6;
    },
    task: "Show how angular planets participate in the house-ruler chains already computed. Do not invent angles or houses. Birth-time-dependent claims stay limited to what the architecture marks as known.",
  },
  {
    id: "integrate_contradictions",
    label: "contradictions between dominant configurations",
    cues: [
      /\bcontradict/i,
      /\bcompeting configurations?\b/i,
      /\bpull against\b/i,
    ],
    importance: function (arch) {
      return configList(arch).length >= 2 ? 6 : 0;
    },
    task: "State the competition between dominant configurations the architecture already lists. Do not resolve it into a single theme or a new minor factor.",
  },
  {
    id: "integrate_synthesis",
    label: "synthesis of the structures already analyzed",
    cues: [
      /\btaken together\b/i,
      /\bthe same dominant\b/i,
      /\bwithout adding a new factor\b/i,
    ],
    importance: function (arch, coveredIds) {
      return coveredIds.length >= 1 ? 4 : 0;
    },
    task: "Synthesize the structures already analyzed. A dominant fact may be stated again when it connects them. Do not introduce a low-weight feature in order to sound new.",
  },
];

function focusDirective(item, kind) {
  const lines = [
    "PRIMARY FOCUS: " + item.label + ".",
    item.task,
    "SUPPORTING CONTEXT: a dominant factor may be mentioned again when it participates in this focus. Already discussed does not mean forbidden.",
    "Do not reproduce the previous reading as a whole. Recurring facts are appropriate when they explain the focus.",
    "Do not invent a minor or obscure factor to sound different.",
    "The architecture ranking is unchanged by what has already been said. CHART FACTS and the architecture block stay authoritative. Do not calculate new positions, aspects, houses, or dignities.",
  ];
  if (kind === "integration") {
    lines.splice(
      2,
      0,
      "The major unexplored structures are exhausted. Deepen the relationship among structures already analyzed.",
    );
  } else {
    lines.splice(
      2,
      0,
      "This focus is high value in the computed architecture and has not yet been analyzed at length.",
    );
  }
  return lines.join("\n");
}

/**
 * First broad chart-analysis turn: dominant overview.
 * Later broad turns: highest-value unexplored architecture, then integration.
 * Does not modify architecture scores.
 * @param {object} arch
 * @param {Array} history
 * @returns {object}
 */
function selectChartAnalysisFocus(arch, history) {
  if (!priorBroadCount(history)) {
    return {
      phase: "overview",
      id: "dominant_overview",
      label: "dominant structural overview",
      directive: "",
    };
  }
  const breadth = ANALYSIS_LENSES.filter(function (lens) {
    return lens.id !== "secondary_unusual";
  })
    .map(function (lens, index) {
      return {
        lens: lens,
        index: index,
        importance: lensImportance(lens.id, arch),
        covered: lensIsCovered(history, lens.cues),
      };
    })
    .filter(function (item) {
      return item.importance >= MAJOR_IMPORTANCE && !item.covered;
    })
    .sort(function (a, b) {
      return b.importance - a.importance || a.index - b.index;
    });
  if (breadth.length) {
    const chosen = breadth[0].lens;
    return {
      phase: "breadth",
      id: chosen.id,
      label: chosen.label,
      directive: focusDirective(chosen, "breadth"),
    };
  }
  const coveredIds = ANALYSIS_LENSES.filter(function (lens) {
    return (
      lens.id !== "secondary_unusual" &&
      lensImportance(lens.id, arch) >= MAJOR_IMPORTANCE &&
      lensIsCovered(history, lens.cues)
    );
  }).map(function (lens) {
    return lens.id;
  });
  const integration = INTEGRATION_PASSES.map(function (pass, index) {
    return {
      pass: pass,
      index: index,
      importance: pass.importance(arch, coveredIds),
      covered: lensIsCovered(history, pass.cues),
    };
  })
    .filter(function (item) {
      return item.importance >= MAJOR_IMPORTANCE && !item.covered;
    })
    .sort(function (a, b) {
      return b.importance - a.importance || a.index - b.index;
    });
  if (integration.length) {
    const chosen = integration[0].pass;
    return {
      phase: "integration",
      id: chosen.id,
      label: chosen.label,
      directive: focusDirective(chosen, "integration"),
    };
  }
  return {
    phase: "integration",
    id: "hold",
    label: "the relationship among the dominant factors already analyzed",
    directive: focusDirective(
      {
        label: "the relationship among the dominant factors already analyzed",
        task: "Stay with the highest-ranked factors already in the architecture. Explain how they work together. Do not search the chart for a leftover curiosity.",
      },
      "integration",
    ),
  };
}

module.exports = {
  hasExplicitAnalyticalTarget,
  isOpenContinuation,
  contextIsChartAnalysis,
  isBroadChartAnalysisPrompt,
  isChartAnalysisQuestion,
  getChartAnalysisRules,
  selectChartAnalysisFocus,
  historyBeforeCurrentTurn,
};
