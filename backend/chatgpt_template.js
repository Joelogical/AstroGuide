// Template for ChatGPT to interpret birth chart data
const chatGPTTemplate = {
  system: `You are an expert astrologer with deep knowledge of Western astrology. Your task is to interpret birth chart data and provide meaningful insights. Follow these guidelines:

1. Core Principles:
   - Focus on the whole chart rather than individual placements
   - Consider the relationships between planets, signs, houses, and aspects
   - Pay special attention to angular points (Ascendant and Midheaven)
   - Note any stelliums (3+ planets in one sign/house)
   - Consider the balance of elements and modalities

2. Interpretation Framework:
   a) Personality and Core Nature:
      - Ascendant and its ruler
      - Sun sign and house placement
      - Moon sign and house placement
      - Elemental balance
      - Modal balance (Cardinal, Fixed, Mutable)

   b) Mental and Communication Style:
      - Mercury's sign, house, and aspects
      - Air element emphasis
      - Third house placements
      - Gemini/Virgo influences

   c) Emotional Nature and Security:
      - Moon's sign, house, and aspects
      - Water element emphasis
      - Fourth house placements
      - Cancer/Scorpio/Pisces influences

   d) Relationships and Values:
      - Venus's sign, house, and aspects
      - Seventh house placements
      - Libra/Taurus influences
      - Synastry indicators

   e) Drive and Energy:
      - Mars's sign, house, and aspects
      - Fire element emphasis
      - First house placements
      - Aries/Leo/Sagittarius influences

   f) Life Purpose and Career:
      - Midheaven and its ruler
      - Tenth house placements
      - Saturn's position and aspects
      - Capricorn/Aquarius influences

3. Aspect Interpretation Guidelines:
   - Conjunction (0°): Fusion of energies
   - Sextile (60°): Harmonious opportunity
   - Square (90°): Dynamic tension
   - Trine (120°): Natural flow
   - Opposition (180°): Polarized balance
   - Consider orb size for aspect strength
   - Note any aspect patterns (T-squares, Yods, etc.)

4. House System Interpretation:
   - Angular houses (1,4,7,10): Most powerful
   - Succedent houses (2,5,8,11): Building and maintaining
   - Cadent houses (3,6,9,12): Learning and adapting
   - Consider house rulers and their conditions

5. Response Structure:
   a) Overview:
      - Key themes and patterns
      - Elemental and modal balance
      - Dominant energies

   b) Core Personality:
      - Ascendant and rising sign analysis
      - Sun and Moon synthesis
      - Key personality traits

   c) Life Areas:
      - Career and purpose
      - Relationships and values
      - Home and family
      - Communication and learning
      - Spirituality and growth

   d) Challenges and Opportunities:
      - Major aspects and their implications
      - House placements and their meanings
      - Potential growth areas

   e) Summary:
      - Key strengths
      - Areas for development
      - Overall life direction

6. Important Considerations:
   - Always maintain a balanced perspective
   - Focus on potential rather than limitationsd
   - Consider both traditional and modern interpretations
   - Acknowledge the complexity of human nature
   - Respect free will and personal choice

Remember to:
- Use clear, accessible language
- Provide specific examples
- Balance technical accuracy with practical insight
- Maintain a supportive and empowering tone
- Acknowledge the limitations of any interpretation`,

  user: `Please analyze this birth chart data and provide a comprehensive interpretation:

{{BIRTH_CHART_DATA}}

Focus on:
1. Core personality traits and potential
2. Key life themes and patterns
3. Important relationships and career directions
4. Challenges and opportunities for growth

Please structure your response according to the framework provided.`,

  assistant: `I'll analyze this birth chart and provide a comprehensive interpretation. Let me break this down into key areas:

[The bot will then follow the structure outlined in the system prompt, providing a detailed analysis of the birth chart data]`,
};

// Function to format birth chart data for ChatGPT
function formatBirthChartForChatGPT(birthChart) {
  return `
Birth Chart Analysis Request

Birth Data:
Date: ${birthChart.birthData.date}
Time: ${birthChart.birthData.time}
Location: ${birthChart.birthData.location.latitude}°N, ${
    birthChart.birthData.location.longitude
  }°E
Timezone: UTC${birthChart.birthData.location.timezone}

Angular Points:
Ascendant: ${birthChart.angles.ascendant.degree.toFixed(2)}° ${
    birthChart.angles.ascendant.sign
  } (${birthChart.angles.ascendant.element})
Midheaven: ${birthChart.angles.midheaven.degree.toFixed(2)}° ${
    birthChart.angles.midheaven.sign
  } (${birthChart.angles.midheaven.element})

Planetary Positions:
${Object.entries(birthChart.planets)
  .map(([planet, info]) => {
    const planetNames = {
      sun: "Sun",
      moon: "Moon",
      mars: "Mars",
      mercury: "Mercury",
      jupiter: "Jupiter",
      venus: "Venus",
      saturn: "Saturn",
      uranus: "Uranus",
      neptune: "Neptune",
      pluto: "Pluto",
    };
    const retrograde = info.isRetrograde ? " (R)" : "";
    return `${planetNames[planet]}: ${info.degree.toFixed(2)}° ${info.sign} (${
      info.element
    }) - House ${info.house}${retrograde}`;
  })
  .join("\n")}

Houses:
${birthChart.houses
  .map(
    (house) =>
      `House ${house.number}: ${house.degree.toFixed(2)}° ${house.sign} (${
        house.element
      })`
  )
  .join("\n")}

Aspects:
${birthChart.aspects
  .map((aspect) => {
    const planetNames = {
      sun: "Sun",
      moon: "Moon",
      mars: "Mars",
      mercury: "Mercury",
      jupiter: "Jupiter",
      venus: "Venus",
      saturn: "Saturn",
      uranus: "Uranus",
      neptune: "Neptune",
      pluto: "Pluto",
    };
    return `${planetNames[aspect.planet1]} (${aspect.planet1Sign}) ${
      aspect.aspect
    } ${planetNames[aspect.planet2]} (${
      aspect.planet2Sign
    }) - ${aspect.orb.toFixed(1)}° orb`;
  })
  .join("\n")}

Additional Analysis Points:
1. Elemental Balance:
${calculateElementalBalance(birthChart)}

2. Modal Balance:
${calculateModalBalance(birthChart)}

3. Stelliums:
${findStelliums(birthChart)}

4. Aspect Patterns:
${findAspectPatterns(birthChart)}
`;
}

// Helper function to calculate elemental balance
function calculateElementalBalance(birthChart) {
  const elements = {
    Fire: 0,
    Earth: 0,
    Air: 0,
    Water: 0,
  };

  // Count planets in each element
  Object.values(birthChart.planets).forEach((planet) => {
    elements[planet.element]++;
  });

  // Count houses in each element
  birthChart.houses.forEach((house) => {
    elements[house.element]++;
  });

  return Object.entries(elements)
    .map(([element, count]) => `${element}: ${count} placements`)
    .join("\n");
}

// Helper function to calculate modal balance
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
    modalities[modalSigns[planet.sign]]++;
  });

  // Count houses in each modality
  birthChart.houses.forEach((house) => {
    modalities[modalSigns[house.sign]]++;
  });

  return Object.entries(modalities)
    .map(([modality, count]) => `${modality}: ${count} placements`)
    .join("\n");
}

// Helper function to find stelliums
function findStelliums(birthChart) {
  const stelliums = {
    signs: {},
    houses: {},
  };

  // Count planets in each sign
  Object.values(birthChart.planets).forEach((planet) => {
    stelliums.signs[planet.sign] = (stelliums.signs[planet.sign] || 0) + 1;
  });

  // Count planets in each house
  Object.values(birthChart.planets).forEach((planet) => {
    stelliums.houses[planet.house] = (stelliums.houses[planet.house] || 0) + 1;
  });

  const stelliumSigns = Object.entries(stelliums.signs)
    .filter(([_, count]) => count >= 3)
    .map(([sign, count]) => `${sign}: ${count} planets`);

  const stelliumHouses = Object.entries(stelliums.houses)
    .filter(([_, count]) => count >= 3)
    .map(([house, count]) => `House ${house}: ${count} planets`);

  return (
    [...stelliumSigns, ...stelliumHouses].join("\n") || "No stelliums found"
  );
}

// Helper function to find aspect patterns
function findAspectPatterns(birthChart) {
  const patterns = [];

  // Check for T-squares
  const oppositions = birthChart.aspects.filter(
    (a) => a.aspect === "opposition"
  );
  oppositions.forEach((opp) => {
    const squares = birthChart.aspects.filter(
      (a) =>
        a.aspect === "square" &&
        (a.planet1 === opp.planet1 ||
          a.planet1 === opp.planet2 ||
          a.planet2 === opp.planet1 ||
          a.planet2 === opp.planet2)
    );
    if (squares.length >= 1) {
      patterns.push(
        `T-square involving ${opp.planet1}-${opp.planet2} opposition`
      );
    }
  });

  // Check for Yods
  const sextiles = birthChart.aspects.filter((a) => a.aspect === "sextile");
  sextiles.forEach((sext) => {
    const quincunxes = birthChart.aspects.filter(
      (a) =>
        a.aspect === "quincunx" &&
        (a.planet1 === sext.planet1 ||
          a.planet1 === sext.planet2 ||
          a.planet2 === sext.planet1 ||
          a.planet2 === sext.planet2)
    );
    if (quincunxes.length >= 1) {
      patterns.push(
        `Yod pattern involving ${sext.planet1}-${sext.planet2} sextile`
      );
    }
  });

  return patterns.join("\n") || "No major aspect patterns found";
}

module.exports = {
  chatGPTTemplate,
  formatBirthChartForChatGPT,
};
