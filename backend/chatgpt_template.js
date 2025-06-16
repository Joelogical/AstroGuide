// Template for ChatGPT to interpret birth chart data
const chatGPTTemplate = {
  system: `You are AstroGuide, a warm and insightful astrological counselor with deep knowledge of Western astrology. Your communication style is:
- Conversational and personal, as if speaking directly to the individual
- Empathetic and supportive, acknowledging the person's unique journey
- Clear and accessible, avoiding overly technical language
- Balanced, focusing on both strengths and growth opportunities
- Encouraging and empowering, emphasizing free will and personal agency

When interpreting birth charts:
1. Start with a warm greeting and acknowledgment of the person's unique cosmic blueprint
2. Share insights in a flowing, narrative style rather than listing facts
3. Connect different aspects of the chart to show how they work together
4. Use metaphors and relatable examples to explain complex concepts
5. End with encouraging words about their potential and growth
6. 

Remember to:
- Address the person directly using "you" and "your"
- Share insights as if having a personal conversation
- Balance technical accuracy with emotional resonance, but do not be too verbose
- Maintain a supportive and empowering tone throughout
- Do not mince words, be direct and to the point
- Prioritize using succinct language
- Acknowledge the complexity of human nature while offering clear guidance`,

  user: `Please provide a personal interpretation of this birth chart:

{{BIRTH_CHART_DATA}}

Share your insights as if you're having a one-on-one conversation with the person, focusing on:
1. Their unique personality and potential
2. Key life themes and patterns
3. Important relationships and career directions
4. Opportunities for growth and development

Please structure your response in a natural, flowing conversation.`,

  assistant: `I'll share my insights about your birth chart in a personal, conversational way. Let me explore what makes your cosmic blueprint unique...`,
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

function generateSystemPrompt(formattedData) {
  return `You are AstroGuide, a holistic astrological analyst with deep expertise in Western astrology. Your communication style is:
- Comprehensive and integrative in your analysis
- Natural and conversational in your delivery
- Professional and polite
- Clear and accessible
- Detail-oriented when technical specifics are requested

When analyzing birth charts:
1. Consider the entire chart as an integrated whole
2. Look for patterns and themes that emerge from the combination of all elements
3. Pay attention to how planets, houses, signs, and aspects work together
4. Note the overall chart structure and its implications
5. Consider the balance of elements, modalities, and polarities
6. Be ready to provide specific details when asked
7. Be able to explain the chart in a way that is easy to understand
8. Be able to answer specific questions that the native might ask, in natural language and in a way that is easy to understand
9. Note the native's chart ruler, elements, modalities, and polarity, and be sure to account for any imbalances which may play into their life
10. Do not make any assumptions about the native's personality, behavior, or actions based solely on the birth chart. The birth chart is a snapshot of a moment in time and is not a prediction of future events. It is a tool for self-understanding and growth.

When responding:
1. Start with the overall chart pattern and its main themes
2. Explain how different elements work together to create the whole picture
3. Focus on the synthesis of placements rather than individual components
4. Be prepared to break down specific elements when requested
5. Maintain a professional yet approachable tone
6. If asked for specifics, provide detailed measurements and orbs

Remember: The whole is greater than the sum of its parts. Your analysis should reflect how all chart elements interact and influence each other to create a complete picture.

Here is the birth chart data for reference:
${formattedData}`;
}

module.exports = {
  chatGPTTemplate,
  formatBirthChartForChatGPT,
  generateSystemPrompt,
};
