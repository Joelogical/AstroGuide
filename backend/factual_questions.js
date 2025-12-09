// Deterministic function to answer factual questions about the birth chart
// This handles questions that have direct, factual answers from the chart data

/**
 * Check if a question is a factual question that can be answered deterministically
 * @param {string} message - The user's message
 * @returns {boolean} True if the question can be answered deterministically
 */
function isFactualQuestion(message) {
  const lowerMessage = message.toLowerCase().trim();

  // Patterns that indicate factual questions
  const factualPatterns = [
    /how many (planets|planets are|planets are in)/i,
    /what (sign|house|element|modality) (is|are|does)/i,
    /which (sign|house|planet|planets)/i,
    /(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto) (is|in|sign|house)/i,
    /(ascendant|midheaven|asc|mc) (is|in|sign)/i,
    /what (planets|planet) (are|is) (in|in the)/i,
    /(house \d+|1st|2nd|3rd|4th|5th|6th|7th|8th|9th|10th|11th|12th) (has|contains|planets)/i,
    /how many (planets|planets are) (in|in the) (house|sign)/i,
    /what (aspects|aspect) (does|do|has|have)/i,
    /(conjunction|square|trine|opposition|sextile) (with|to|between)/i,
    /is (retrograde|direct)/i,
    /what (degree|degrees) (is|are)/i,
  ];

  return factualPatterns.some((pattern) => pattern.test(lowerMessage));
}

/**
 * Answer factual questions about the birth chart deterministically
 * @param {string} message - The user's question
 * @param {object} birthChart - The birth chart data
 * @returns {string|null} The answer if it's a factual question, null otherwise
 */
function answerFactualQuestion(message, birthChart) {
  const lowerMessage = message.toLowerCase().trim();

  // Extract planets in a specific house
  if (
    /how many (planets|planets are) (in|in the) (house|the) (\d+)/i.test(
      message
    )
  ) {
    const match = message.match(/house (\d+)/i);
    if (match) {
      const houseNum = parseInt(match[1]);

      // Validate house number
      if (houseNum < 1 || houseNum > 12) {
        return `House numbers must be between 1 and 12. You asked about House ${houseNum}.`;
      }

      const planetsInHouse = Object.entries(birthChart.planets || {})
        .filter(([_, planet]) => planet.house === houseNum)
        .map(([key, _]) => {
          const planetNames = {
            sun: "Sun",
            moon: "Moon",
            mercury: "Mercury",
            venus: "Venus",
            mars: "Mars",
            jupiter: "Jupiter",
            saturn: "Saturn",
            uranus: "Uranus",
            neptune: "Neptune",
            pluto: "Pluto",
          };
          return planetNames[key] || key;
        });

      const count = planetsInHouse.length;
      if (count === 0) {
        return `There are no planets in House ${houseNum}.`;
      } else if (count === 1) {
        return `There is 1 planet in House ${houseNum}: ${planetsInHouse[0]}.`;
      } else {
        const last = planetsInHouse.pop();
        return `There are ${count} planets in House ${houseNum}: ${planetsInHouse.join(
          ", "
        )}, and ${last}.`;
      }
    }
  }

  // What planets are in a specific house
  if (
    /what (planets|planet) (are|is) (in|in the) (house|the) (\d+)/i.test(
      message
    )
  ) {
    const match = message.match(/house (\d+)/i);
    if (match) {
      const houseNum = parseInt(match[1]);

      // Validate house number
      if (houseNum < 1 || houseNum > 12) {
        return `House numbers must be between 1 and 12. You asked about House ${houseNum}.`;
      }

      const planetsInHouse = Object.entries(birthChart.planets || {})
        .filter(([_, planet]) => planet.house === houseNum)
        .map(([key, planet]) => {
          const planetNames = {
            sun: "Sun",
            moon: "Moon",
            mercury: "Mercury",
            venus: "Venus",
            mars: "Mars",
            jupiter: "Jupiter",
            saturn: "Saturn",
            uranus: "Uranus",
            neptune: "Neptune",
            pluto: "Pluto",
          };
          const planetName = planetNames[key] || key;
          return `${planetName} in ${planet.sign}`;
        });

      if (planetsInHouse.length === 0) {
        return `There are no planets in House ${houseNum}.`;
      } else {
        return `The planets in House ${houseNum} are: ${planetsInHouse.join(
          ", "
        )}.`;
      }
    }
  }

  // What sign is a planet in
  const planetSignPattern =
    /(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto) (is|in|sign)/i;
  if (planetSignPattern.test(message)) {
    const match = message.match(
      /(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto)/i
    );
    if (match) {
      const planetKey = match[1].toLowerCase();
      const planet = birthChart.planets?.[planetKey];
      if (planet) {
        const planetNames = {
          sun: "Sun",
          moon: "Moon",
          mercury: "Mercury",
          venus: "Venus",
          mars: "Mars",
          jupiter: "Jupiter",
          saturn: "Saturn",
          uranus: "Uranus",
          neptune: "Neptune",
          pluto: "Pluto",
        };
        const planetName = planetNames[planetKey] || planetKey;
        return `Your ${planetName} is in ${planet.sign}.`;
      }
    }
  }

  // Which house is a planet in
  const planetHousePattern =
    /(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto) (house|in which house)/i;
  if (planetHousePattern.test(message)) {
    const match = message.match(
      /(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto)/i
    );
    if (match) {
      const planetKey = match[1].toLowerCase();
      const planet = birthChart.planets?.[planetKey];
      if (planet) {
        const planetNames = {
          sun: "Sun",
          moon: "Moon",
          mercury: "Mercury",
          venus: "Venus",
          mars: "Mars",
          jupiter: "Jupiter",
          saturn: "Saturn",
          uranus: "Uranus",
          neptune: "Neptune",
          pluto: "Pluto",
        };
        const planetName = planetNames[planetKey] || planetKey;
        return `Your ${planetName} is in House ${planet.house}.`;
      }
    }
  }

  // What sign is the ascendant/midheaven in
  if (/(ascendant|asc) (is|in|sign)/i.test(message)) {
    const asc = birthChart.angles?.ascendant;
    if (asc) {
      return `Your Ascendant is in ${asc.sign} at ${asc.degree.toFixed(2)}°.`;
    }
  }

  if (/(midheaven|mc) (is|in|sign)/i.test(message)) {
    const mc = birthChart.angles?.midheaven;
    if (mc) {
      return `Your Midheaven is in ${mc.sign} at ${mc.degree.toFixed(2)}°.`;
    }
  }

  // What planets are in a specific sign
  if (
    /what (planets|planet) (are|is) (in|in the) (sign|sign of) (\w+)/i.test(
      message
    )
  ) {
    const match = message.match(
      /(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)/i
    );
    if (match) {
      const sign =
        match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      const planetsInSign = Object.entries(birthChart.planets || {})
        .filter(([_, planet]) => planet.sign === sign)
        .map(([key, _]) => {
          const planetNames = {
            sun: "Sun",
            moon: "Moon",
            mercury: "Mercury",
            venus: "Venus",
            mars: "Mars",
            jupiter: "Jupiter",
            saturn: "Saturn",
            uranus: "Uranus",
            neptune: "Neptune",
            pluto: "Pluto",
          };
          return planetNames[key] || key;
        });

      if (planetsInSign.length === 0) {
        return `There are no planets in ${sign} in your chart.`;
      } else {
        return `The planets in ${sign} are: ${planetsInSign.join(", ")}.`;
      }
    }
  }

  // Which house has the most/least planets
  if (
    /which (house|houses) (has|have) (the )?(most|least|fewest) (planets|planet)/i.test(
      message
    )
  ) {
    const houseCounts = {};
    Object.values(birthChart.planets || {}).forEach((planet) => {
      const house = planet.house;
      houseCounts[house] = (houseCounts[house] || 0) + 1;
    });

    if (Object.keys(houseCounts).length === 0) {
      return "I couldn't find any planets in your chart.";
    }

    const isMost = /most/i.test(message);
    const sortedHouses = Object.entries(houseCounts).sort((a, b) =>
      isMost ? b[1] - a[1] : a[1] - b[1]
    );

    const topCount = sortedHouses[0][1];
    const topHouses = sortedHouses
      .filter(([_, count]) => count === topCount)
      .map(([house, _]) => `House ${house}`);

    if (topHouses.length === 1) {
      return `${topHouses[0]} has the ${
        isMost ? "most" : "fewest"
      } planets with ${topCount} planet${topCount > 1 ? "s" : ""}.`;
    } else {
      return `${topHouses.join(" and ")} ${
        topHouses.length > 2 ? "all " : ""
      }have the ${isMost ? "most" : "fewest"} planets with ${topCount} planet${
        topCount > 1 ? "s" : ""
      } each.`;
    }
  }

  // Which sign has the most/least planets
  if (
    /which (sign|signs) (has|have) (the )?(most|least|fewest) (planets|planet)/i.test(
      message
    )
  ) {
    const signCounts = {};
    Object.values(birthChart.planets || {}).forEach((planet) => {
      const sign = planet.sign;
      signCounts[sign] = (signCounts[sign] || 0) + 1;
    });

    if (Object.keys(signCounts).length === 0) {
      return "I couldn't find any planets in your chart.";
    }

    const isMost = /most/i.test(message);
    const sortedSigns = Object.entries(signCounts).sort((a, b) =>
      isMost ? b[1] - a[1] : a[1] - b[1]
    );

    const topCount = sortedSigns[0][1];
    const topSigns = sortedSigns
      .filter(([_, count]) => count === topCount)
      .map(([sign, _]) => sign);

    if (topSigns.length === 1) {
      return `${topSigns[0]} has the ${
        isMost ? "most" : "fewest"
      } planets with ${topCount} planet${topCount > 1 ? "s" : ""}.`;
    } else {
      return `${topSigns.join(" and ")} ${
        topSigns.length > 2 ? "all " : ""
      }have the ${isMost ? "most" : "fewest"} planets with ${topCount} planet${
        topCount > 1 ? "s" : ""
      } each.`;
    }
  }

  // What aspects does a planet have
  if (
    /what (aspects|aspect) (does|do|has|have) (the )?(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto)/i.test(
      message
    )
  ) {
    const match = message.match(
      /(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto)/i
    );
    if (match) {
      const planetKey = match[1].toLowerCase();
      const aspects = (birthChart.aspects || []).filter(
        (aspect) => aspect.planet1 === planetKey || aspect.planet2 === planetKey
      );

      if (aspects.length === 0) {
        const planetNames = {
          sun: "Sun",
          moon: "Moon",
          mercury: "Mercury",
          venus: "Venus",
          mars: "Mars",
          jupiter: "Jupiter",
          saturn: "Saturn",
          uranus: "Uranus",
          neptune: "Neptune",
          pluto: "Pluto",
        };
        return `Your ${planetNames[planetKey]} has no major aspects.`;
      } else {
        const planetNames = {
          sun: "Sun",
          moon: "Moon",
          mercury: "Mercury",
          venus: "Venus",
          mars: "Mars",
          jupiter: "Jupiter",
          saturn: "Saturn",
          uranus: "Uranus",
          neptune: "Neptune",
          pluto: "Pluto",
        };
        const aspectList = aspects.map((aspect) => {
          const otherPlanet =
            aspect.planet1 === planetKey ? aspect.planet2 : aspect.planet1;
          const otherPlanetName = planetNames[otherPlanet] || otherPlanet;
          return `${otherPlanetName} ${aspect.aspect} (${aspect.orb.toFixed(
            1
          )}° orb)`;
        });
        return `Your ${planetNames[planetKey]} has ${aspects.length} aspect${
          aspects.length > 1 ? "s" : ""
        }: ${aspectList.join(", ")}.`;
      }
    }
  }

  // Is a planet retrograde
  if (
    /is (the )?(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto) (retrograde|direct)/i.test(
      message
    )
  ) {
    const match = message.match(
      /(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto)/i
    );
    if (match) {
      const planetKey = match[1].toLowerCase();
      const planet = birthChart.planets?.[planetKey];
      if (planet) {
        const planetNames = {
          sun: "Sun",
          moon: "Moon",
          mercury: "Mercury",
          venus: "Venus",
          mars: "Mars",
          jupiter: "Jupiter",
          saturn: "Saturn",
          uranus: "Uranus",
          neptune: "Neptune",
          pluto: "Pluto",
        };
        const planetName = planetNames[planetKey] || planetKey;
        if (planet.isRetrograde) {
          return `Yes, your ${planetName} is retrograde.`;
        } else {
          return `No, your ${planetName} is direct (not retrograde).`;
        }
      }
    }
  }

  // Return null if no factual pattern matched
  return null;
}

module.exports = {
  isFactualQuestion,
  answerFactualQuestion,
};
