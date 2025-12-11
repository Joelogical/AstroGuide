/**
 * Configuration for holistic chart interpretation
 * This module centralizes all hardcoded values used in holistic interpretation
 * to make them easily configurable and maintainable
 */

/**
 * Planet groupings for thematic aspect categorization
 * These determine which planets belong to which life themes
 */
const planetThemeGroups = {
  identityEmotions: {
    planets: ["sun", "moon", "ascendant"],
    // chartRuler will be dynamically added
    description: "Sun, Moon, Ascendant, Chart Ruler aspects",
    label: "IDENTITY & EMOTIONS",
  },
  mindCommunication: {
    planets: ["mercury"],
    description: "Mercury aspects",
    label: "MIND & COMMUNICATION",
  },
  loveSex: {
    planets: ["venus", "mars"],
    description: "Venus, Mars aspects",
    label: "LOVE & SEX",
  },
  growthChallenges: {
    planets: ["jupiter", "saturn", "uranus", "neptune", "pluto"],
    description: "Jupiter, Saturn, Outer Planets aspects",
    label: "GROWTH & CHALLENGES",
  },
};

/**
 * Aspect interpretation templates
 * These templates generate the text for aspect interpretations
 * Use placeholders: {planet1Name}, {planet2Name}, {planet1Sign}, {planet2Sign},
 * {planet1Core}, {planet2Core}, {planet1SignCore}, {planet2SignCore},
 * {planet1Keyword}, {planet2Keyword}
 */
const aspectInterpretationTemplates = {
  merged: {
    // Conjunction
    template: `Your {planet1Name} in {planet1Sign} and {planet2Name} in {planet2Sign} are merged through a conjunction. ` +
      `This creates a unified expression where {planet1Core} and {planet2Core} work together as one force. ` +
      `The {planet1Sign} expression of {planet1Name} blends with the {planet2Sign} expression of {planet2Name}, ` +
      `creating a combined energy that is both {planet1SignCore} and {planet2SignCore}.`,
  },
  polarized: {
    // Opposition
    template: `Your {planet1Name} in {planet1Sign} and {planet2Name} in {planet2Sign} are in opposition, creating a polarized dynamic. ` +
      `Your {planet1Core} expressed through {planet1Sign} seeks {planet1SignCore}, ` +
      `while your {planet2Core} expressed through {planet2Sign} need {planet2SignCore}. ` +
      `This creates tension where you may feel pulled between {planet1Keyword} and {planet2Keyword}, ` +
      `requiring you to find balance between these opposing forces.`,
  },
  friction: {
    // Square
    template: `Your {planet1Name} in {planet1Sign} and {planet2Name} in {planet2Sign} form a square, creating friction and challenge. ` +
      `Your {planet1Core} wants {planet1SignCore}, while your {planet2Core} need {planet2SignCore}. ` +
      `This square creates internal conflict where you may vacillate between {planet1Keyword} and {planet2Keyword}, ` +
      `pushing you to grow through the tension between these competing needs.`,
  },
  flowing: {
    // Trine
    template: `Your {planet1Name} in {planet1Sign} and {planet2Name} in {planet2Sign} form a trine, creating flowing harmony. ` +
      `Your {planet1Core} expressed through {planet1Sign} naturally supports your {planet2Core} expressed through {planet2Sign}. ` +
      `This creates ease where {planet1Keyword} and {planet2Keyword} work together seamlessly, ` +
      `allowing you to express both energies with natural grace.`,
  },
  cooperative: {
    // Sextile
    template: `Your {planet1Name} in {planet1Sign} and {planet2Name} in {planet2Sign} form a sextile, creating cooperative energy. ` +
      `Your {planet1Core} and {planet2Core} can work together harmoniously, ` +
      `with {planet1Sign} expression supporting {planet2Sign} expression. ` +
      `This creates opportunities where you can integrate {planet1Keyword} with {planet2Keyword} ` +
      `through conscious effort and awareness.`,
  },
};

/**
 * Holistic interpretation instructions
 * These guide how the AI should interpret the chart holistically
 */
const holisticInstructions = [
  "Start with the CORE PERSONALITY SYNTHESIS - this is the foundation.",
  "Use ASPECT-DRIVEN narrative - combine placements that aspect each other.",
  "Avoid repeating isolated placement descriptions when aspects already cover them.",
  "Group aspects by theme (Identity/Emotions, Mind/Communication, Love/Sex, Growth/Challenges).",
  "Use planet significance scores to emphasize heavily aspected planets.",
  "Include BOTH positive and negative qualities throughout.",
  "Show relationships between chart pieces, not just isolated descriptions.",
];

/**
 * Core synthesis section labels and structure
 */
const coreSynthesisConfig = {
  sectionTitle: "CORE PERSONALITY SYNTHESIS (Luminaries + Chart Ruler)",
  foundationLabel: "FOUNDATION:",
  identityEmotionsLabel: "IDENTITY & EMOTIONS (Sun-Moon {aspect}):",
  identityEmotionsNoAspectLabel: "IDENTITY & EMOTIONS (Sun-Moon):",
  identityExpressionLabel: "IDENTITY & EXPRESSION (Sun-{ruler} {aspect}):",
  emotionsExpressionLabel: "EMOTIONS & EXPRESSION (Moon-{ruler} {aspect}):",
  stressResponseLabel: "STRESS RESPONSE:",
  noAspectFallback: `Without a major aspect between them, these energies operate somewhat independently, ` +
    `creating a dynamic where your identity and emotional needs may not always align.`,
};

/**
 * Template section headers
 */
const templateSections = {
  aspectDriven: "ASPECT-DRIVEN INTERPRETATIONS (Grouped by Theme)",
  planetSignificance: "PLANET SIGNIFICANCE SCORES (Higher = More Important)",
  placementDetails: "PLACEMENT DETAILS (Technical Reference)",
};

/**
 * Significance score thresholds
 */
const significanceThresholds = {
  high: 0.7,
  medium: 0.5,
  low: 0.0,
};

/**
 * Stress response template
 * Placeholders: {ascendantSign}, {ascendantNegative}, {moonSign}, {moonNegative},
 * {rulerPlanet}, {rulerSign}, {rulerNegative}
 */
const stressResponseTemplate = `When under stress, your {ascendantSign} Ascendant may show {ascendantNegative}, ` +
  `while your {moonSign} Moon reacts with {moonNegative}. ` +
  `{rulerInfluence}`;

const rulerInfluenceTemplate = `Your chart ruler {rulerPlanet} in {rulerSign} influences how you {rulerNegative}.`;

/**
 * No aspect fallback templates
 */
const noAspectTemplates = {
  sunMoon: `Your {sunSign} Sun makes you {sunPositive}, while your {moonSign} Moon needs {moonPositive}. ` +
    `Without a major aspect between them, these energies operate somewhat independently, ` +
    `creating a dynamic where your identity and emotional needs may not always align.`,
};

/**
 * Get planet theme groups with chart ruler dynamically added
 * @param {string} chartRuler - Chart ruler planet name
 * @returns {object} Planet theme groups with chart ruler included
 */
function getPlanetThemeGroups(chartRuler) {
  const groups = JSON.parse(JSON.stringify(planetThemeGroups)); // Deep copy
  
  // Add chart ruler to identity/emotions group
  if (chartRuler && groups.identityEmotions) {
    if (!groups.identityEmotions.planets.includes(chartRuler.toLowerCase())) {
      groups.identityEmotions.planets.push(chartRuler.toLowerCase());
    }
  }
  
  return groups;
}

/**
 * Get aspect interpretation template for a given polarity
 * @param {string} polarity - Aspect polarity (merged, polarized, friction, flowing, cooperative)
 * @returns {object} Template object with template string
 */
function getAspectTemplate(polarity) {
  return aspectInterpretationTemplates[polarity] || aspectInterpretationTemplates.cooperative;
}

/**
 * Replace placeholders in a template string
 * @param {string} template - Template string with placeholders
 * @param {object} values - Object with placeholder values
 * @returns {string} Template with placeholders replaced
 */
function replaceTemplatePlaceholders(template, values) {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value || '');
  }
  return result;
}

module.exports = {
  planetThemeGroups,
  aspectInterpretationTemplates,
  holisticInstructions,
  coreSynthesisConfig,
  templateSections,
  significanceThresholds,
  stressResponseTemplate,
  rulerInfluenceTemplate,
  noAspectTemplates,
  getPlanetThemeGroups,
  getAspectTemplate,
  replaceTemplatePlaceholders,
};

