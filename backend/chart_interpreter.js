// Deterministic chart interpretation functions
// This module processes birth chart data and generates structured interpretations

const {
  getPlanetMeaning,
  getSignMeaning,
  getHouseMeaning,
  getPlanetSignInterpretation,
  getAspectPolarity,
  getAspectStyle,
  calculatePlanetSignificance,
} = require("./astrology_rules");

const {
  getPlanetThemeGroups,
  getAspectTemplate,
  replaceTemplatePlaceholders,
  holisticInstructions,
  coreSynthesisConfig,
  templateSections,
  significanceThresholds,
  stressResponseTemplate,
  rulerInfluenceTemplate,
  noAspectTemplates,
} = require("./holistic_config");

/**
 * Process raw birth chart data and generate deterministic interpretations
 * @param {object} birthChart - The processed birth chart object
 * @returns {object} Structured interpretation template
 */
function generateChartInterpretation(birthChart) {
  const interpretation = {
    // Basic chart information
    chartInfo: {
      date: birthChart.birthData.date,
      time: birthChart.birthData.time,
      location: birthChart.birthData.location,
    },

    // Angular points interpretations
    angles: {
      ascendant: {
        sign: birthChart.angles.ascendant.sign,
        element: birthChart.angles.ascendant.element,
        degree: birthChart.angles.ascendant.degree,
        ruler: getChartRuler(birthChart.angles.ascendant.sign),
        positive:
          getSignMeaning(birthChart.angles.ascendant.sign, "positive")?.core ||
          "",
        negative:
          getSignMeaning(birthChart.angles.ascendant.sign, "negative")?.core ||
          "",
      },
      midheaven: {
        sign: birthChart.angles.midheaven.sign,
        element: birthChart.angles.midheaven.element,
        degree: birthChart.angles.midheaven.degree,
        positive:
          getSignMeaning(birthChart.angles.midheaven.sign, "positive")?.core ||
          "",
        negative:
          getSignMeaning(birthChart.angles.midheaven.sign, "negative")?.core ||
          "",
      },
    },

    // Planetary interpretations
    planets: {},

    // Planet significance scores
    planetSignificance: {},

    // Aspect groupings by theme
    aspectGroups: {
      identityEmotions: [], // Sun, Moon, Ascendant, chart ruler
      mindCommunication: [], // Mercury aspects
      loveSex: [], // Venus, Mars aspects
      growthChallenges: [], // Jupiter, Saturn, outer planets
    },

    // Core personality synthesis
    coreSynthesis: null,

    // Elemental balance
    elementalBalance: calculateElementalBalance(birthChart),

    // Modal balance
    modalBalance: calculateModalBalance(birthChart),

    // Summary of key themes
    keyThemes: [],
  };

  // Calculate planet significance scores
  const allAspects = birthChart.aspects || [];
  for (const planetName of Object.keys(birthChart.planets)) {
    interpretation.planetSignificance[planetName] = calculatePlanetSignificance(
      planetName,
      allAspects,
      {
        angles: interpretation.angles,
        planets: birthChart.planets,
      }
    );
  }

  // Group aspects by theme
  interpretation.aspectGroups = groupAspectsByTheme(
    allAspects,
    interpretation.angles.ascendant.ruler
  );

  // Generate core personality synthesis
  interpretation.coreSynthesis = generateCoreSynthesis(
    birthChart,
    interpretation
  );

  // Process each planet
  for (const [planetName, planetData] of Object.entries(birthChart.planets)) {
    // Get positive and negative interpretations
    const positiveInterpretation = getPlanetSignInterpretation(
      planetName,
      planetData.sign,
      "positive"
    );
    const negativeInterpretation = getPlanetSignInterpretation(
      planetName,
      planetData.sign,
      "negative"
    );

    const planetPositive = getPlanetMeaning(planetName, "positive");
    const planetNegative = getPlanetMeaning(planetName, "negative");
    const signPositive = getSignMeaning(planetData.sign, "positive");
    const signNegative = getSignMeaning(planetData.sign, "negative");
    const housePositive = getHouseMeaning(planetData.house, "positive");
    const houseNegative = getHouseMeaning(planetData.house, "negative");

    // Determine overall polarity based on aspects involving this planet
    let aspectPolarity = "positive"; // default
    const planetAspects =
      birthChart.aspects?.filter(
        (a) => a.planet1 === planetName || a.planet2 === planetName
      ) || [];

    // If planet has challenging aspects (squares, oppositions), lean negative
    // If planet has harmonious aspects (trines, sextiles), lean positive
    const hasChallengingAspects = planetAspects.some(
      (a) => a.aspect === "square" || a.aspect === "opposition"
    );
    const hasHarmoniousAspects = planetAspects.some(
      (a) => a.aspect === "trine" || a.aspect === "sextile"
    );

    // Determine primary polarity (can be mixed, but we'll note both)
    if (hasChallengingAspects && !hasHarmoniousAspects) {
      aspectPolarity = "negative";
    } else if (hasHarmoniousAspects && !hasChallengingAspects) {
      aspectPolarity = "positive";
    } else {
      aspectPolarity = "mixed"; // Both types of aspects present
    }

    interpretation.planets[planetName] = {
      name: planetName.charAt(0).toUpperCase() + planetName.slice(1),
      sign: planetData.sign,
      element: planetData.element,
      house: planetData.house,
      degree: planetData.degree,
      isRetrograde: planetData.isRetrograde,

      // Positive qualities
      positive: {
        planetCore: planetPositive?.core || "",
        planetThemes: planetPositive?.themes || [],
        planetKeywords: planetPositive?.keywords || [],
        signCore: signPositive?.core || "",
        signThemes: signPositive?.themes || [],
        signKeywords: signPositive?.keywords || [],
        houseCore: housePositive?.core || "",
        houseThemes: housePositive?.themes || [],
        houseKeywords: housePositive?.keywords || [],
        interpretation: positiveInterpretation,
      },

      // Negative qualities
      negative: {
        planetCore: planetNegative?.core || "",
        planetThemes: planetNegative?.themes || [],
        planetKeywords: planetNegative?.keywords || [],
        signCore: signNegative?.core || "",
        signThemes: signNegative?.themes || [],
        signKeywords: signNegative?.keywords || [],
        houseCore: houseNegative?.core || "",
        houseThemes: houseNegative?.themes || [],
        houseKeywords: houseNegative?.keywords || [],
        interpretation: negativeInterpretation,
      },

      // Aspect-based polarity
      aspectPolarity: aspectPolarity,
      aspects: planetAspects.map((a) => ({
        ...a,
        polarity: getAspectPolarity(a.aspect),
      })),
    };
  }

  // Calculate key themes from the chart
  interpretation.keyThemes = extractKeyThemes(interpretation);

  return interpretation;
}

/**
 * Calculate elemental balance
 * @param {object} birthChart - The birth chart object
 * @returns {object} Elemental balance data
 */
function calculateElementalBalance(birthChart) {
  const elements = {
    Fire: 0,
    Earth: 0,
    Air: 0,
    Water: 0,
  };

  // Count planets in each element
  Object.values(birthChart.planets).forEach((planet) => {
    if (planet.element && elements.hasOwnProperty(planet.element)) {
      elements[planet.element]++;
    }
  });

  // Count houses in each element
  birthChart.houses.forEach((house) => {
    if (house.element && elements.hasOwnProperty(house.element)) {
      elements[house.element]++;
    }
  });

  // Determine dominant and lacking elements
  const sorted = Object.entries(elements).sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0][0];
  const lacking = sorted[sorted.length - 1][0];

  return {
    distribution: elements,
    dominant,
    lacking,
    balance: sorted.map(([element, count]) => ({ element, count })),
  };
}

/**
 * Calculate modal balance
 * @param {object} birthChart - The birth chart object
 * @returns {object} Modal balance data
 */
function calculateModalBalance(birthChart) {
  const modalities = {
    Cardinal: 0,
    Fixed: 0,
    Mutable: 0,
  };

  const modalSigns = {
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

  // Count planets in each modality
  Object.values(birthChart.planets).forEach((planet) => {
    const modality = modalSigns[planet.sign];
    if (modality && modalities.hasOwnProperty(modality)) {
      modalities[modality]++;
    }
  });

  // Count houses in each modality
  birthChart.houses.forEach((house) => {
    const modality = modalSigns[house.sign];
    if (modality && modalities.hasOwnProperty(modality)) {
      modalities[modality]++;
    }
  });

  const sorted = Object.entries(modalities).sort((a, b) => b[1] - a[1]);
  const dominant = sorted[0][0];

  return {
    distribution: modalities,
    dominant,
    balance: sorted.map(([modality, count]) => ({ modality, count })),
  };
}

/**
 * Extract key themes from the chart interpretation
 * @param {object} interpretation - The chart interpretation object
 * @returns {array} Array of key theme strings
 */
function extractKeyThemes(interpretation) {
  const themes = [];

  // Add dominant element theme
  if (interpretation.elementalBalance.dominant) {
    themes.push(
      `Strong ${interpretation.elementalBalance.dominant} element influence`
    );
  }

  // Add dominant modality theme
  if (interpretation.modalBalance.dominant) {
    themes.push(`Dominant ${interpretation.modalBalance.dominant} modality`);
  }

  // Add prominent planet themes (planets in their own signs or strong placements)
  const prominentPlanets = Object.values(interpretation.planets)
    .filter((p) => p.planetThemes && p.planetThemes.length > 0)
    .slice(0, 3);

  prominentPlanets.forEach((planet) => {
    themes.push(`${planet.name} themes: ${planet.planetThemes.join(", ")}`);
  });

  return themes;
}

/**
 * Format the interpretation template for AI consumption
 * @param {object} interpretation - The chart interpretation object
 * @param {object} birthChart - The birth chart data
 * @returns {string} Formatted text template
 */
function formatInterpretationForAI(interpretation, birthChart) {
  let template = `BIRTH CHART INTERPRETATION TEMPLATE\n`;
  template += `=====================================\n\n`;
  template += `⚠️ CRITICAL INSTRUCTIONS FOR HOLISTIC INTERPRETATION:\n`;
  template += `\n`;
  template += `🚫 NEVER DO THIS (PLANET-BY-PLANET BREAKDOWN):\n`;
  template += `- "Your Sun in Gemini... [paragraph about Sun]"\n`;
  template += `- "Your Moon in Virgo... [paragraph about Moon]"\n`;
  template += `- "Your Mercury... [paragraph about Mercury]"\n`;
  template += `This creates a fragmented, checklist-style response. DO NOT structure your response this way.\n\n`;
  template += `✅ INSTEAD DO THIS (UNIFIED SYNTHESIS):\n`;
  template += `- Weave multiple placements together in each paragraph\n`;
  template += `- Show how Sun, Moon, Mercury, Venus, etc. all interconnect\n`;
  template += `- Create a unified narrative, not separate paragraphs for each planet\n`;
  template += `- Each paragraph should integrate 2-3+ chart elements\n\n`;
  holisticInstructions.forEach((instruction, index) => {
    template += `${index + 1}. ${instruction}\n`;
  });
  template += `\n`;

  template += `CHART INFORMATION:\n`;
  template += `Date: ${interpretation.chartInfo.date}\n`;
  template += `Time: ${interpretation.chartInfo.time}\n`;
  template += `Location: ${interpretation.chartInfo.location.latitude}°N, ${interpretation.chartInfo.location.longitude}°E\n\n`;

  // CORE PERSONALITY SYNTHESIS
  if (interpretation.coreSynthesis) {
    const synth = interpretation.coreSynthesis;
    template += `═══════════════════════════════════════════════════════════\n`;
    template += `${coreSynthesisConfig.sectionTitle}\n`;
    template += `═══════════════════════════════════════════════════════════\n\n`;

    template += `${coreSynthesisConfig.foundationLabel}\n`;
    template += `- Sun in ${synth.sun.sign} (House ${synth.sun.house}): Core identity expression\n`;
    template += `- Moon in ${synth.moon.sign} (House ${synth.moon.house}): Emotional nature\n`;
    template += `- Ascendant in ${synth.ascendant.sign}: Outer personality and first impressions\n`;
    if (synth.chartRuler) {
      template += `- Chart Ruler: ${synth.chartRuler.planet.toUpperCase()} in ${
        synth.chartRuler.sign
      } (House ${synth.chartRuler.house}): How identity is expressed\n\n`;
    } else {
      template += `- Chart Ruler: Not available\n\n`;
    }

    // Sun-Moon relationship
    if (synth.sunMoonAspect) {
      const aspectStyle = getAspectStyle(synth.sunMoonAspect.aspect);
      template +=
        replaceTemplatePlaceholders(coreSynthesisConfig.identityEmotionsLabel, {
          aspect: synth.sunMoonAspect.aspect.toUpperCase(),
        }) + `\n`;
      template += `Aspect Style: ${aspectStyle.polarity}, Tension: ${aspectStyle.tension}, Strength: ${aspectStyle.strength}\n`;
      template += `${generateCombinedAspectInterpretation(
        synth.sunMoonAspect,
        birthChart
      )}\n\n`;
    } else {
      template += `${coreSynthesisConfig.identityEmotionsNoAspectLabel}\n`;
      const sunPositive =
        getSignMeaning(synth.sun.sign, "positive")?.core || "";
      const moonPositive =
        getSignMeaning(synth.moon.sign, "positive")?.core || "";
      template +=
        replaceTemplatePlaceholders(noAspectTemplates.sunMoon, {
          sunSign: synth.sun.sign,
          sunPositive: sunPositive,
          moonSign: synth.moon.sign,
          moonPositive: moonPositive,
        }) + `\n\n`;
    }

    // Sun-Chart Ruler relationship
    if (synth.sunRulerAspect && synth.chartRuler) {
      template +=
        replaceTemplatePlaceholders(
          coreSynthesisConfig.identityExpressionLabel,
          {
            ruler: synth.chartRuler.planet.toUpperCase(),
            aspect: synth.sunRulerAspect.aspect.toUpperCase(),
          }
        ) + `\n`;
      template += `${generateCombinedAspectInterpretation(
        synth.sunRulerAspect,
        birthChart
      )}\n\n`;
    }

    // Moon-Chart Ruler relationship
    if (synth.moonRulerAspect && synth.chartRuler) {
      template +=
        replaceTemplatePlaceholders(
          coreSynthesisConfig.emotionsExpressionLabel,
          {
            ruler: synth.chartRuler.planet.toUpperCase(),
            aspect: synth.moonRulerAspect.aspect.toUpperCase(),
          }
        ) + `\n`;
      template += `${generateCombinedAspectInterpretation(
        synth.moonRulerAspect,
        birthChart
      )}\n\n`;
    }

    template += `${coreSynthesisConfig.stressResponseLabel}\n`;
    const ascendantNegative =
      getSignMeaning(synth.ascendant.sign, "negative")?.core ||
      "defensive patterns";
    const moonNegative =
      getSignMeaning(synth.moon.sign, "negative")?.core || "emotional patterns";

    let rulerInfluence = "";
    if (synth.chartRuler) {
      const rulerNegative =
        getPlanetMeaning(synth.chartRuler.planet, "negative")?.core ||
        "respond to challenges";
      rulerInfluence = replaceTemplatePlaceholders(rulerInfluenceTemplate, {
        rulerPlanet: synth.chartRuler.planet.toUpperCase(),
        rulerSign: synth.chartRuler.sign,
        rulerNegative: rulerNegative,
      });
    }

    template +=
      replaceTemplatePlaceholders(stressResponseTemplate, {
        ascendantSign: synth.ascendant.sign,
        ascendantNegative: ascendantNegative,
        moonSign: synth.moon.sign,
        moonNegative: moonNegative,
        rulerInfluence: rulerInfluence,
      }) + `\n\n`;
  }

  template += `═══════════════════════════════════════════════════════════\n`;
  template += `${templateSections.aspectDriven}\n`;
  template += `═══════════════════════════════════════════════════════════\n\n`;

  // Get theme groups configuration
  const themeGroups = getPlanetThemeGroups(
    interpretation.angles.ascendant.ruler
  );

  // IDENTITY & EMOTIONS
  if (interpretation.aspectGroups.identityEmotions.length > 0) {
    template += `${themeGroups.identityEmotions.label} (${themeGroups.identityEmotions.description}):\n`;
    template += `─────────────────────────────────────────────────────────────\n`;
    interpretation.aspectGroups.identityEmotions.forEach((aspect) => {
      template += `\n${aspect.planet1.toUpperCase()} ${aspect.aspect.toUpperCase()} ${aspect.planet2.toUpperCase()}:\n`;
      template += `${generateCombinedAspectInterpretation(
        aspect,
        birthChart
      )}\n`;
    });
    template += `\n`;
  }

  // MIND & COMMUNICATION
  if (interpretation.aspectGroups.mindCommunication.length > 0) {
    template += `${themeGroups.mindCommunication.label} (${themeGroups.mindCommunication.description}):\n`;
    template += `─────────────────────────────────────────────────────────────\n`;
    interpretation.aspectGroups.mindCommunication.forEach((aspect) => {
      template += `\n${aspect.planet1.toUpperCase()} ${aspect.aspect.toUpperCase()} ${aspect.planet2.toUpperCase()}:\n`;
      template += `${generateCombinedAspectInterpretation(
        aspect,
        birthChart
      )}\n`;
    });
    template += `\n`;
  }

  // LOVE & SEX
  if (interpretation.aspectGroups.loveSex.length > 0) {
    template += `${themeGroups.loveSex.label} (${themeGroups.loveSex.description}):\n`;
    template += `─────────────────────────────────────────────────────────────\n`;
    interpretation.aspectGroups.loveSex.forEach((aspect) => {
      template += `\n${aspect.planet1.toUpperCase()} ${aspect.aspect.toUpperCase()} ${aspect.planet2.toUpperCase()}:\n`;
      template += `${generateCombinedAspectInterpretation(
        aspect,
        birthChart
      )}\n`;
    });
    template += `\n`;
  }

  // GROWTH & CHALLENGES
  if (interpretation.aspectGroups.growthChallenges.length > 0) {
    template += `${themeGroups.growthChallenges.label} (${themeGroups.growthChallenges.description}):\n`;
    template += `─────────────────────────────────────────────────────────────\n`;
    interpretation.aspectGroups.growthChallenges.forEach((aspect) => {
      template += `\n${aspect.planet1.toUpperCase()} ${aspect.aspect.toUpperCase()} ${aspect.planet2.toUpperCase()}:\n`;
      template += `${generateCombinedAspectInterpretation(
        aspect,
        birthChart
      )}\n`;
    });
    template += `\n`;
  }

  template += `═══════════════════════════════════════════════════════════\n`;
  template += `${templateSections.planetSignificance}\n`;
  template += `═══════════════════════════════════════════════════════════\n`;
  const sortedPlanets = Object.entries(interpretation.planetSignificance)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  sortedPlanets.forEach(([planet, score]) => {
    let significanceLevel = "LOW";
    if (score >= significanceThresholds.high) {
      significanceLevel = "HIGH";
    } else if (score >= significanceThresholds.medium) {
      significanceLevel = "MEDIUM";
    }
    template += `${planet.toUpperCase()}: ${score.toFixed(
      2
    )} (${significanceLevel} significance)\n`;
  });
  template += `\n`;

  template += `═══════════════════════════════════════════════════════════\n`;
  template += `${templateSections.placementDetails}\n`;
  template += `═══════════════════════════════════════════════════════════\n\n`;

  // Sort planets by significance for emphasis
  const planetEntries = Object.entries(interpretation.planets).sort((a, b) => {
    const scoreA = interpretation.planetSignificance[a[0]] || 0;
    const scoreB = interpretation.planetSignificance[b[0]] || 0;
    return scoreB - scoreA;
  });

  for (const [planetKey, planet] of planetEntries) {
    template += `${planet.name} in ${planet.sign} (House ${planet.house})`;
    if (planet.isRetrograde) {
      template += ` [Retrograde]`;
    }
    template += ` [Significance: ${(
      interpretation.planetSignificance[planetKey] || 0
    ).toFixed(2)}]\n`;

    template += `  Planet Energy: ${planet.positive.planetCore}\n`;
    template += `  Sign Expression: ${planet.positive.signCore}\n`;
    template += `  House Context: ${planet.positive.houseCore}\n`;

    if (planet.aspects && planet.aspects.length > 0) {
      template += `  Aspects: ${planet.aspects
        .map(
          (a) =>
            `${a.planet1 === planetKey ? a.planet2 : a.planet1} ${a.aspect} (${
              a.polarity
            })`
        )
        .join(", ")}\n`;
    }
    template += `\n`;
  }

  template += `ELEMENTAL BALANCE:\n`;
  template += `Dominant Element: ${interpretation.elementalBalance.dominant}\n`;
  template += `Lacking Element: ${interpretation.elementalBalance.lacking}\n\n`;

  template += `MODAL BALANCE:\n`;
  template += `Dominant Modality: ${interpretation.modalBalance.dominant}\n\n`;

  return template;
}

/**
 * Get chart ruler based on ascendant sign
 * @param {string} ascendantSign - Ascendant sign
 * @returns {string} Chart ruler planet name
 */
function getChartRuler(ascendantSign) {
  const rulers = {
    Aries: "mars",
    Taurus: "venus",
    Gemini: "mercury",
    Cancer: "moon",
    Leo: "sun",
    Virgo: "mercury",
    Libra: "venus",
    Scorpio: "mars", // Traditional: Mars, Modern: Pluto
    Sagittarius: "jupiter",
    Capricorn: "saturn",
    Aquarius: "saturn", // Traditional: Saturn, Modern: Uranus
    Pisces: "jupiter", // Traditional: Jupiter, Modern: Neptune
  };
  return rulers[ascendantSign] || "sun";
}

/**
 * Group aspects by thematic category
 * @param {array} aspects - All aspects in chart
 * @param {string} chartRuler - Chart ruler planet
 * @returns {object} Grouped aspects
 */
function groupAspectsByTheme(aspects, chartRuler) {
  const groups = {
    identityEmotions: [],
    mindCommunication: [],
    loveSex: [],
    growthChallenges: [],
  };

  // Get configured theme groups
  const themeGroups = getPlanetThemeGroups(chartRuler);

  aspects.forEach((aspect) => {
    const p1 = aspect.planet1.toLowerCase();
    const p2 = aspect.planet2.toLowerCase();

    // Identity and emotions
    if (
      themeGroups.identityEmotions.planets.includes(p1) ||
      themeGroups.identityEmotions.planets.includes(p2) ||
      themeGroups.identityEmotions.planets.some(
        (p) => p1.includes(p) || p2.includes(p)
      )
    ) {
      groups.identityEmotions.push(aspect);
    }

    // Mind and communication
    if (
      themeGroups.mindCommunication.planets.includes(p1) ||
      themeGroups.mindCommunication.planets.includes(p2)
    ) {
      groups.mindCommunication.push(aspect);
    }

    // Love and sex
    if (
      themeGroups.loveSex.planets.includes(p1) ||
      themeGroups.loveSex.planets.includes(p2)
    ) {
      groups.loveSex.push(aspect);
    }

    // Growth and challenges
    if (
      themeGroups.growthChallenges.planets.includes(p1) ||
      themeGroups.growthChallenges.planets.includes(p2)
    ) {
      groups.growthChallenges.push(aspect);
    }
  });

  return groups;
}

/**
 * Generate core personality synthesis from luminaries and chart ruler
 * @param {object} birthChart - Birth chart data
 * @param {object} interpretation - Current interpretation object
 * @returns {object} Core synthesis data
 */
function generateCoreSynthesis(birthChart, interpretation) {
  const sun = birthChart.planets?.sun;
  const moon = birthChart.planets?.moon;
  const ascendant = interpretation.angles.ascendant;
  const chartRulerName = ascendant.ruler;
  const chartRuler = birthChart.planets?.[chartRulerName];

  if (!sun || !moon) {
    return null;
  }

  // Chart ruler might not exist if it's a non-standard ruler
  if (!chartRuler) {
    console.warn(`Chart ruler ${chartRulerName} not found in planets`);
  }

  // Get aspects involving these key points
  const allAspects = birthChart.aspects || [];
  const keyAspects = allAspects.filter((a) => {
    const p1 = a.planet1.toLowerCase();
    const p2 = a.planet2.toLowerCase();
    return (
      p1 === "sun" ||
      p2 === "sun" ||
      p1 === "moon" ||
      p2 === "moon" ||
      p1 === chartRulerName ||
      p2 === chartRulerName
    );
  });

  // Find Sun-Moon aspect
  const sunMoonAspect = allAspects.find(
    (a) =>
      (a.planet1.toLowerCase() === "sun" &&
        a.planet2.toLowerCase() === "moon") ||
      (a.planet1.toLowerCase() === "moon" && a.planet2.toLowerCase() === "sun")
  );

  // Find Sun-Chart Ruler aspect
  let sunRulerAspect = null;
  if (chartRuler) {
    sunRulerAspect = allAspects.find(
      (a) =>
        (a.planet1.toLowerCase() === "sun" &&
          a.planet2.toLowerCase() === chartRulerName) ||
        (a.planet1.toLowerCase() === chartRulerName &&
          a.planet2.toLowerCase() === "sun")
    );
  }

  // Find Moon-Chart Ruler aspect
  let moonRulerAspect = null;
  if (chartRuler) {
    moonRulerAspect = allAspects.find(
      (a) =>
        (a.planet1.toLowerCase() === "moon" &&
          a.planet2.toLowerCase() === chartRulerName) ||
        (a.planet1.toLowerCase() === chartRulerName &&
          a.planet2.toLowerCase() === "moon")
    );
  }

  return {
    sun: {
      sign: sun.sign,
      house: sun.house,
      element: sun.element,
    },
    moon: {
      sign: moon.sign,
      house: moon.house,
      element: moon.element,
    },
    ascendant: {
      sign: ascendant.sign,
      element: ascendant.element,
    },
    chartRuler: chartRuler
      ? {
          planet: chartRulerName,
          sign: chartRuler.sign,
          house: chartRuler.house,
          element: chartRuler.element,
        }
      : null,
    keyAspects: keyAspects,
    sunMoonAspect: sunMoonAspect,
    sunRulerAspect: sunRulerAspect,
    moonRulerAspect: moonRulerAspect,
  };
}

/**
 * Generate combined aspect interpretation
 * @param {object} aspect - Aspect data
 * @param {object} birthChart - Birth chart data
 * @returns {string} Combined interpretation text
 */
function generateCombinedAspectInterpretation(aspect, birthChart) {
  const p1Key = aspect.planet1.toLowerCase();
  const p2Key = aspect.planet2.toLowerCase();

  // Handle ascendant as special case
  let planet1, planet2;
  if (p1Key === "ascendant") {
    planet1 = {
      sign: birthChart.angles?.ascendant?.sign,
      house: 1,
      element: birthChart.angles?.ascendant?.element,
    };
  } else {
    planet1 = birthChart.planets?.[p1Key];
  }

  if (p2Key === "ascendant") {
    planet2 = {
      sign: birthChart.angles?.ascendant?.sign,
      house: 1,
      element: birthChart.angles?.ascendant?.element,
    };
  } else {
    planet2 = birthChart.planets?.[p2Key];
  }

  if (!planet1 || !planet2) return "";

  const planet1Name =
    aspect.planet1.charAt(0).toUpperCase() + aspect.planet1.slice(1);
  const planet2Name =
    aspect.planet2.charAt(0).toUpperCase() + aspect.planet2.slice(1);
  const aspectStyle = getAspectStyle(aspect.aspect);

  const planet1Sign = getSignMeaning(planet1.sign, "positive");
  const planet2Sign = getSignMeaning(planet2.sign, "positive");
  const planet1Planet = getPlanetMeaning(p1Key, "positive");
  const planet2Planet = getPlanetMeaning(p2Key, "positive");

  // Get template for this aspect polarity
  const templateObj = getAspectTemplate(aspectStyle.polarity);

  // Prepare values for template replacement
  const templateValues = {
    planet1Name: planet1Name,
    planet2Name: planet2Name,
    planet1Sign: planet1.sign,
    planet2Sign: planet2.sign,
    planet1Core: planet1Planet?.core || "the planet's energy",
    planet2Core: planet2Planet?.core || "the other planet's energy",
    planet1SignCore: planet1Sign?.core || "",
    planet2SignCore: planet2Sign?.core || "",
    planet1Keyword: planet1Sign?.keywords?.[0] || "one quality",
    planet2Keyword: planet2Sign?.keywords?.[0] || "another quality",
  };

  // Replace placeholders in template
  const interpretation = replaceTemplatePlaceholders(
    templateObj.template,
    templateValues
  );

  return interpretation;
}

module.exports = {
  generateChartInterpretation,
  formatInterpretationForAI,
  calculateElementalBalance,
  calculateModalBalance,
  extractKeyThemes,
  generateCoreSynthesis,
  generateCombinedAspectInterpretation,
  groupAspectsByTheme,
};
