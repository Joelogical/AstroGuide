/**
 * Conversational analysis state.
 * Chart importance stays in chart_architecture.js.
 * This module only records which focus the existing progression selector chose.
 * It does not rescore the chart.
 */

const { selectChartAnalysisFocus } = require("./chart_analysis");

function buildAnalysisState(arch, priorConversation, route) {
  const intent = route && route.primaryIntent;
  if (!route || !route.progressionEligible) {
    return {
      previousIntent: null,
      currentIntent: intent || null,
      currentFocus: null,
      coveredStructures: [],
      progressionPhase: null,
      depth: 0,
      sourceFrameworksUsed: [],
      focus: null,
    };
  }
  const focus = selectChartAnalysisFocus(arch, priorConversation);
  const phase = focus && focus.phase;
  return {
    previousIntent: "CHART_ANALYSIS",
    currentIntent: "CHART_ANALYSIS",
    currentFocus: focus ? focus.id : null,
    coveredStructures: [],
    progressionPhase: phase,
    depth: phase === "integration" ? 2 : phase === "breadth" ? 1 : 0,
    sourceFrameworksUsed: [],
    focus: focus,
  };
}

module.exports = {
  buildAnalysisState,
};
