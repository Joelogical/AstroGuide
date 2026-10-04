/**
 * CHART_ANALYSIS intent: inspect the natal chart as a technical system.
 * Distinct from PERSONAL_INTERPRETATION (thesis / who they are).
 */

const { getPromptSection } = require("./prompt_loader");

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
  return (
    getPromptSection("chart-analysis.md", "shared") +
    "\n\n" +
    getPromptSection(
      "chart-analysis.md",
      advanced ? "advanced" : "beginner",
    )
  );
}

module.exports = {
  isChartAnalysisQuestion,
  getChartAnalysisRules,
};
