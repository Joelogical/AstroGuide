// Deterministic chart interpretation functions
// This module processes birth chart data and generates structured interpretations

const {
  getPlanetMeaning,
  getSignMeaning,
  getHouseMeaning,
  getPlanetSignInterpretation,
  getAspectPolarity,
} = require("./astrology_rules");

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

    // Elemental balance
    elementalBalance: calculateElementalBalance(birthChart),

    // Modal balance
    modalBalance: calculateModalBalance(birthChart),

    // Summary of key themes
    keyThemes: [],
  };

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
 * @returns {string} Formatted text template
 */
function formatInterpretationForAI(interpretation) {
  let template = `BIRTH CHART INTERPRETATION TEMPLATE\n`;
  template += `=====================================\n\n`;
  template += `⚠️ CRITICAL: This template includes BOTH positive and negative qualities for each placement.\n`;
  template += `You MUST use BOTH in your interpretation—never only positive traits.\n`;
  template += `Every placement has both strengths and challenges—address both.\n\n`;

  template += `CHART INFORMATION:\n`;
  template += `Date: ${interpretation.chartInfo.date}\n`;
  template += `Time: ${interpretation.chartInfo.time}\n`;
  template += `Location: ${interpretation.chartInfo.location.latitude}°N, ${interpretation.chartInfo.location.longitude}°E\n\n`;

  template += `ANGULAR POINTS:\n`;
  template += `Ascendant (${interpretation.angles.ascendant.sign}):\n`;
  template += `  Positive: ${interpretation.angles.ascendant.positive}\n`;
  template += `  Negative: ${interpretation.angles.ascendant.negative}\n`;
  template += `Midheaven (${interpretation.angles.midheaven.sign}):\n`;
  template += `  Positive: ${interpretation.angles.midheaven.positive}\n`;
  template += `  Negative: ${interpretation.angles.midheaven.negative}\n\n`;

  template += `PLANETARY INTERPRETATIONS:\n`;
  template += `---------------------------\n`;

  for (const [planetKey, planet] of Object.entries(interpretation.planets)) {
    template += `\n${planet.name} in ${planet.sign} (House ${planet.house})`;
    if (planet.isRetrograde) {
      template += ` [Retrograde]`;
    }
    template += ` [Aspect Polarity: ${planet.aspectPolarity}]:\n`;

    template += `POSITIVE QUALITIES:\n`;
    template += `  Planet: ${planet.positive.planetCore}\n`;
    template += `  Sign: ${planet.positive.signCore}\n`;
    template += `  House: ${planet.positive.houseCore}\n`;
    template += `  Interpretation: ${planet.positive.interpretation}\n`;
    template += `  Themes: ${planet.positive.planetThemes.join(
      ", "
    )} + ${planet.positive.signThemes.join(
      ", "
    )} + ${planet.positive.houseThemes.join(", ")}\n`;

    template += `NEGATIVE QUALITIES:\n`;
    template += `  Planet: ${planet.negative.planetCore}\n`;
    template += `  Sign: ${planet.negative.signCore}\n`;
    template += `  House: ${planet.negative.houseCore}\n`;
    template += `  Interpretation: ${planet.negative.interpretation}\n`;
    template += `  Themes: ${planet.negative.planetThemes.join(
      ", "
    )} + ${planet.negative.signThemes.join(
      ", "
    )} + ${planet.negative.houseThemes.join(", ")}\n`;

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
  }

  template += `\n\nELEMENTAL BALANCE:\n`;
  template += `Dominant Element: ${interpretation.elementalBalance.dominant}\n`;
  template += `Lacking Element: ${interpretation.elementalBalance.lacking}\n`;
  template += `Distribution: ${JSON.stringify(
    interpretation.elementalBalance.distribution
  )}\n\n`;

  template += `MODAL BALANCE:\n`;
  template += `Dominant Modality: ${interpretation.modalBalance.dominant}\n`;
  template += `Distribution: ${JSON.stringify(
    interpretation.modalBalance.distribution
  )}\n\n`;

  template += `KEY THEMES:\n`;
  interpretation.keyThemes.forEach((theme) => {
    template += `- ${theme}\n`;
  });

  template += `\n\nASPECTS:\n`;
  // Aspects will be added when we process them

  return template;
}

module.exports = {
  generateChartInterpretation,
  formatInterpretationForAI,
  calculateElementalBalance,
  calculateModalBalance,
  extractKeyThemes,
};
