/**
 * CHART_ANALYSIS intent: inspect the natal chart as a technical system.
 * Distinct from PERSONAL_INTERPRETATION (thesis / who they are).
 */

function isChartAnalysisQuestion(message) {
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

function getChartAnalysisRules(preferredMode) {
  const advanced = String(preferredMode || "").toLowerCase() === "advanced";
  const shared =
    "INTENT: CHART_ANALYSIS (not PERSONAL_INTERPRETATION).\n" +
    "The object of analysis is the natal chart as a technical system—not the personality, psychology, behavior, life path, or experiences of the native.\n\n" +
    "Answer: “What is happening astrologically in this chart?” Do not answer: “What kind of person does this chart describe?”\n\n" +
    "PRIORITIZE, in hierarchy: chart ruler and its condition; angular planets; house and sign concentrations; elemental and modality distribution; essential and accidental dignity/debility; dispositors and dispositor chains; mutual receptions; aspect density; tight aspects; applying vs separating; conjunctions to angles; stelliums and other concentrations; aspect configurations; repeated planetary relationships; planets in many aspects; relatively unaspected planets; house-ruler relationships; repeated emphasis on the same houses, planets, signs, or axes; unusual or especially strong structural features; contradictions or competing configurations; and whether a seemingly important feature is actually weak (wide orb, poor integration).\n\n" +
    "Do not default to personality translations.\n" +
    "Avoid: “Saturn in Capricorn means you are disciplined, patient, and hardworking.”\n" +
    "Prefer: “Saturn is strongly placed by domicile in Capricorn. Because Saturn also rules the Ascendant, its condition carries greater interpretive weight than it would in isolation.”\n" +
    "Avoid: “Moon in Virgo makes you analytical about relationships.”\n" +
    "Prefer: “The Moon occupies Virgo in the 7th and is connected to X and Y by aspect. This links the 7th-house axis to the larger [configuration/pattern] already present elsewhere in the chart.”\n\n" +
    "Do not force every placement in. Spend the most attention on what is unusually tight, repeated, angular, dignified, heavily aspected, structurally central, or otherwise prominent. " +
    "When useful, label: structurally dominant features; secondary supporting features; isolated or low-weight features.\n" +
    "Do not manufacture a single overarching life theme for cohesion. If several structures are relatively independent, describe them separately.\n\n" +
    "Every major conclusion needs chart evidence. Prefer: “Mercury is structurally prominent because…”, “The 4th/10th axis receives repeated emphasis through…”, “This opposition matters more than the wider square because…”, “Three separate factors direct attention toward…”, “This configuration is unusual because…”, “The chart contains relatively little…”, “This planet functions as a connective point between…”.\n\n" +
    "Write as an astrologer inspecting architecture with another astrologer, not as a client personality reading.\n" +
    "Do not call save_chart_summary this turn. Do not search the web for personality keywords.";

  if (advanced) {
    return (
      shared +
      "\n\nADVANCED CHART_ANALYSIS: expert density. Use precise terms and geometry (degrees, orbs, applying/separating) without defining the vocabulary. Show the structural chain. No pedagogical filler. No life-theme packaging."
    );
  }
  return (
    shared +
    "\n\nBEGINNER CHART_ANALYSIS: still analyze the chart as a system, not a person. You may use everyday words for the structures (which planet carries more weight, which connections are tight, which area of the wheel is crowded) without turning those into character traits. Do not invent a personality portrait."
  );
}

module.exports = {
  isChartAnalysisQuestion,
  getChartAnalysisRules,
};
