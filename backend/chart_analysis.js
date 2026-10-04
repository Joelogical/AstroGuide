/**
 * CHART_ANALYSIS intent: inspect the natal chart as a technical system.
 * Distinct from PERSONAL_INTERPRETATION (thesis / who they are).
 */

const { getPromptSection } = require("./prompt_loader");

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

/**
 * Short umbrella chart questions, including ones under 40 characters.
 * Not a life-area question and not a factual lookup.
 */
function isBroadChartAnalysisPrompt(message) {
  const t = normalizeAsk(message);
  if (!t) return false;
  if (
    /^(tell me about|analyze|analyse|read|interpret|walk me through)( my| the| this)?( birth)? chart$/.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /^what stands out( in| about)?( my| the| this)?( birth)?( chart)?$/.test(t)
  ) {
    return true;
  }
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

function isChartAnalysisQuestion(message) {
  if (isBroadChartAnalysisPrompt(message)) return true;
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
  if (progression && progression.phase === "progression") {
    text +=
      "\n\n" +
      getPromptSection("chart-analysis.md", "progression") +
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

function historyCorpus(history) {
  return (history || [])
    .map(function (message) {
      return message && message.content ? String(message.content) : "";
    })
    .join("\n");
}

function coverageHits(text, cues) {
  let distinct = 0;
  let total = 0;
  cues.forEach(function (re) {
    const flags = re.flags.indexOf("g") === -1 ? re.flags + "g" : re.flags;
    const matches = String(text || "").match(new RegExp(re.source, flags));
    if (matches && matches.length) {
      distinct += 1;
      total += matches.length;
    }
  });
  return { distinct: distinct, total: total };
}

function coverageIsSubstantial(hits) {
  return hits.total >= 2;
}

/**
 * First broad chart-analysis turn: dominant overview.
 * Later broad turns: the next architecture lens that prior replies have not developed.
 * @param {object} arch
 * @param {Array} history
 * @returns {object}
 */
function selectChartAnalysisFocus(arch, history) {
  const priorBroad = (history || []).filter(function (message) {
    return (
      message &&
      message.role === "user" &&
      isBroadChartAnalysisPrompt(message.content)
    );
  }).length;
  if (!priorBroad) {
    return {
      phase: "overview",
      id: "dominant_overview",
      label: "dominant structural overview",
      directive: "",
    };
  }
  const text = historyCorpus(history);
  const scored = ANALYSIS_LENSES.filter(function (lens) {
    return arch && arch.ok && lens.available(arch);
  }).map(function (lens, index) {
    const hits = coverageHits(text, lens.cues);
    return {
      lens: lens,
      index: index,
      hits: hits,
      substantial: coverageIsSubstantial(hits),
    };
  });
  const uncovered = scored.filter(function (item) {
    return !item.substantial;
  });
  let chosen = uncovered[0] || null;
  let exhausted = false;
  if (!chosen && scored.length) {
    exhausted = true;
    chosen = scored.slice().sort(function (a, b) {
      return a.hits.total - b.hits.total || a.index - b.index;
    })[0];
  }
  if (!chosen) {
    return {
      phase: "progression",
      id: "none",
      label: "no unused structure",
      directive:
        "No further unused structure is present in the computed architecture. Say that the available structures have already been covered and stop. Do not invent a pattern.",
    };
  }
  const coveredLabels = scored
    .filter(function (item) {
      return item.substantial && item.lens.id !== chosen.lens.id;
    })
    .map(function (item) {
      return item.lens.label;
    });
  const unusedLabels = scored
    .filter(function (item) {
      return !item.substantial && item.lens.id !== chosen.lens.id;
    })
    .map(function (item) {
      return item.lens.label;
    });
  const lines = [
    "ASSIGNED FOCUS: " + chosen.lens.label + ".",
    chosen.lens.task,
    "This focus is present in the computed architecture and has not yet received substantial attention.",
  ];
  if (exhausted) {
    lines.push(
      "Every available lens has already been discussed. This is the least developed one. Go further into it. Do not restate earlier paragraphs.",
    );
  }
  if (coveredLabels.length) {
    lines.push(
      "Already given substantial attention (context only, not the subject): " +
        coveredLabels.join("; ") +
        ".",
    );
  }
  if (unusedLabels.length) {
    lines.push(
      "Leave these for a later broad request: " + unusedLabels.join("; ") + ".",
    );
  }
  lines.push(
    "A dominant feature may be named only when this focus cannot be understood without it. Then return to the focus.",
  );
  lines.push(
    "CHART FACTS and the architecture block stay authoritative. Do not calculate new positions, aspects, houses, or dignities.",
  );
  return {
    phase: "progression",
    id: chosen.lens.id,
    label: chosen.lens.label,
    directive: lines.join("\n"),
  };
}

module.exports = {
  isBroadChartAnalysisPrompt,
  isChartAnalysisQuestion,
  getChartAnalysisRules,
  selectChartAnalysisFocus,
  historyBeforeCurrentTurn,
};
