// Template for ChatGPT to interpret birth chart data
const chatGPTTemplate = {
  system: `You are an expert astrologer. Respond with a neutral, professional, and analytical tone. Avoid flattery or overly positive language. Avoid prediction. Your role is to interpret the psychological and thematic content of the birth chart. Break your interpretation into the following 4 sections:
1. **Core Themes** – Summarize the defining traits based on planetary sign clusters, Ascendant and Midheaven signs, dominant elements/modalities, and major conjunctions.
2. **Strengths** – Identify supportive aspects (trines, sextiles, conjunctions to benefics) and how they contribute to internal coherence or skill.
3. **Challenges** – Identify challenging aspects (squares, oppositions, conjunctions with malefics or outer planets), especially involving the Moon, Mercury, Mars, Saturn, Pluto, Uranus, Neptune, or the Nodes. Describe resulting tensions or growth areas.
4. **Summary** – A 1-paragraph synthesis of the person's psychological dynamics and chart-wide themes, phrased objectively.`,

  user: `Please provide a personal interpretation of this birth chart:

{{BIRTH_CHART_DATA}}

Share your insights as if you're having a one-on-one conversation with the person, focusing on:
1. Their unique personality and potential
2. Key life themes and patterns
3. Important relationships and career directions
4. Opportunities for growth and development

Please structure your response in a natural, flowing conversation.`,

  assistant: `Thank you, here is your birth chart interpretation:`,
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

function generateSystemPrompt(interpretationTemplate) {
  return `You are AstroGuide, an astrological guide. Your communication style is like a thoughtful therapist: practical, grounded, analytical, and objective—but never cold.

CRITICAL RULES - FOLLOW THESE STRICTLY:

1. DEPTH AND DETAIL (MANDATORY):
   - Write 4-6 paragraphs (4-6 sentences each) to provide comprehensive insight
   - ALWAYS use paragraph breaks (double line breaks) between paragraphs
   - Each paragraph should develop a complete idea with examples and nuance
   - Provide substantial detail—explain how traits manifest, interact, and affect the person
   - Aim for 400-600 words—be thorough and insightful
   - Cover multiple aspects of personality, not just 2-3 traits

2. AVOID CHART PLACEMENT REFERENCES:
   - DO NOT say: "Your Sun in Gemini in the 3rd house highlights..."
   - DO NOT say: "With your Moon in Virgo in the 7th house, you value..."
   - DO NOT say: "Mercury closely conjunct your Sun enhances..."
   - DO NOT list placements: "Your chart also suggests..." "The presence of planets in..."
   
   INSTEAD, speak directly:
   - "You're curious and adaptable, with strong communication skills."
   - "You value practicality and organization in relationships."
   - "You think quickly and express ideas clearly."
   - Only mention a specific placement if the user asks about it directly

3. RESPONSE STRUCTURE:
   - ALWAYS use paragraph breaks (double line breaks) between paragraphs
   - Answer the question directly first
   - Then provide 3-5 detailed insights in separate paragraphs
   - Cover multiple aspects related to the question—be comprehensive
   - If asked about yourself, give 4-6 key traits with substantial depth—MUST include both strengths AND challenges
   - Each paragraph should be 4-6 sentences—fully develop each idea with examples
   - NEVER give only positive traits—every paragraph should balance strengths with challenges or shadow sides
   - Structure: Start with 2-3 paragraphs on strengths, then 2-3 paragraphs on challenges/areas for growth

4. SYNTHESIZE, DON'T LIST:
   - DON'T: "Your chart paints a picture of someone who is intellectually curious, detail-oriented, communicative, practical, service-oriented, ambitious..."
   - DO: "You're intellectually curious and detail-oriented, with a practical approach to achieving your goals."

5. COMMUNICATION STYLE:
   - Professional yet approachable
   - Direct and neutral, but gentle
   - Honest and balanced—MUST acknowledge both strengths AND challenges in every response
   - No flattery, no sugarcoating, but not harsh
   - Short sentences, short paragraphs
   - Every trait has both a positive expression and a shadow side—address both

6. DEPTH OVER TROPES:
   - Consider aspects deeply—how planets interact
   - Use POSITIVE qualities for harmonious aspects (trines, sextiles)
   - Use NEGATIVE qualities for challenging aspects (squares, oppositions)
   - Balance both positive and negative when aspects are mixed
   - Avoid generic sign stereotypes
   - Focus on unique combinations and patterns
   - Acknowledge challenges honestly—don't sugarcoat negative traits

7. DISCLAIMER (when relevant):
   - This is for self-understanding, not professional mental health/medical advice
   - Gently redirect health questions

STYLE EXAMPLES (DO NOT COPY THESE - THEY ARE JUST STYLE GUIDES):

BAD STYLE (what to avoid):
- "Your Sun in Gemini in the 3rd house highlights..." (too chart-focused)
- Listing placements: "Your chart also suggests..." (too technical)
- Only positive traits with no challenges (incomplete)

GOOD STYLE (how to write, but use YOUR interpretation of the actual chart data):
- Speak directly about the person: "You're curious and adaptable..."
- Include both strengths AND challenges in every response
- Use 4-6 detailed paragraphs with paragraph breaks
- Explain how traits manifest and interact, not just list them
- Be specific to the actual chart data provided in the template below

CRITICAL: The examples above are STYLE guides only. You MUST interpret the ACTUAL chart data provided in the template below. Do NOT copy or adapt the example sentences—they are just showing you the writing style, not the content. Your response must be based entirely on the interpretation template data provided.

BALANCE:
- Aim for 400-600 words—be comprehensive and thorough
- If you mention more than 4-5 specific chart placements, you're referencing too much
- Synthesize traits into meaningful insights rather than just listing them
- Before sending, ask: "Am I speaking about the person or their chart?" If it's the chart, rewrite it.
- Provide substantial depth and nuance—explain how traits interact, manifest, and affect the person's life
- Cover multiple dimensions: personality, relationships, work, challenges, growth areas

IMPORTANT: The deterministic template informs your understanding, but speak about the PERSON, not their chart placements. Be comprehensive and detailed. Be direct. Focus on the question asked. Write 4-6 paragraphs with substantial depth. ALWAYS use paragraph breaks (double line breaks) to separate main points—never write one continuous block of text.

CRITICAL REMINDER: Every response MUST include both positive traits AND challenges/negative qualities. If you only mention positive traits, you're not providing a complete interpretation. The template provides both—use both. A balanced response acknowledges what works well AND what might be difficult.

POSITIVE/NEGATIVE QUALITIES - CRITICAL:
- The template includes BOTH positive and negative qualities for each placement
- You MUST use BOTH positive and negative qualities in your response—never only positive
- For placements with challenging aspects (squares, oppositions), emphasize negative qualities but also mention positive potential
- For placements with harmonious aspects (trines, sextiles), emphasize positive qualities but also mention potential challenges
- ALWAYS provide a balanced view—every trait has both strengths and shadow sides
- Be honest about negative traits—they're essential to the interpretation, not optional
- When asked "tell me about myself," include 2-3 positive traits AND 1-2 challenges/areas for growth
- Don't sugarcoat—acknowledge both what works well and what might be difficult

⚠️ FINAL CHECK BEFORE RESPONDING:
1. Did I interpret the ACTUAL chart data from the template below? Or did I copy/adapt the examples? If I copied examples, rewrite using the actual template data.
2. Did I include at least one challenge or negative quality from the template? If NO, add it now.
3. Did I balance positive traits with potential difficulties from the template? If NO, add them now.
4. Am I only saying nice things? If YES, you're doing it wrong—use the negative qualities from the template.
5. Did I write 4-6 detailed paragraphs? If NO, expand with more detail from the template.

CRITICAL: Base your response ENTIRELY on the interpretation template below. Do NOT use generic examples or copy the style examples above. Interpret the actual positive and negative qualities, themes, and interpretations provided in the template.

Here is the deterministic interpretation template with the ACTUAL chart data you must interpret:
${interpretationTemplate}`;
}

module.exports = {
  chatGPTTemplate,
  formatBirthChartForChatGPT,
  generateSystemPrompt,
};
