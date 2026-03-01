// Question pattern recognition system
// Recognizes complex question patterns beyond simple keyword matching
// Uses pattern templates to understand user intent more accurately

/**
 * Question pattern definitions
 * Each pattern has:
 * - pattern: Regex to match the pattern
 * - type: Type of question (factual, interpretation, relationship, comparison)
 * - confidence: Base confidence score (0-1)
 * - extract: Function to extract relevant data from match
 * - handler: Optional function name to handle this pattern type
 */
const questionPatterns = [
  // Factual questions - "What sign is X in?"
  {
    pattern: /what (sign|house|element) (is|are) (my|the) (\w+)/i,
    type: "factual",
    confidence: 0.95,
    extract: (match) => ({
      questionType: match[1], // sign, house, element
      target: match[4], // planet or angle
    }),
    handler: "factual_placement",
  },
  {
    pattern:
      /(sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|ascendant|midheaven) (is|in|sign|house)/i,
    type: "factual",
    confidence: 0.9,
    extract: (match) => ({
      target: match[1],
      questionType:
        match[2] === "sign"
          ? "sign"
          : match[2] === "house"
          ? "house"
          : "placement",
    }),
    handler: "factual_placement",
  },

  // Interpretation questions - "What does X mean?"
  {
    pattern: /what (does|is) (my|the) (\w+) (mean|signify|represent|indicate)/i,
    type: "interpretation",
    confidence: 0.9,
    extract: (match) => ({
      target: match[3],
      questionType: "meaning",
    }),
    handler: "interpretation_meaning",
  },
  {
    pattern: /(tell me|explain|describe) (about|what) (my|the) (\w+)/i,
    type: "interpretation",
    confidence: 0.85,
    extract: (match) => ({
      target: match[4],
      questionType: "explanation",
    }),
    handler: "interpretation_meaning",
  },
  {
    pattern: /what (is|are) (my|the) (\w+) (like|about)/i,
    type: "interpretation",
    confidence: 0.8,
    extract: (match) => ({
      target: match[3],
      questionType: "description",
    }),
    handler: "interpretation_meaning",
  },

  // Relationship questions - "How does X affect Y?"
  {
    pattern:
      /how (does|do) (my|the) (\w+) (affect|influence|impact) (my|the) (\w+)/i,
    type: "relationship",
    confidence: 0.85,
    extract: (match) => ({
      source: match[3],
      target: match[6],
      relationship: "influence",
    }),
    handler: "relationship_influence",
  },
  {
    pattern:
      /(what|how) (is|are) (the )?(connection|relationship|link) (between|of) (my|the) (\w+) (and|&) (my|the) (\w+)/i,
    type: "relationship",
    confidence: 0.8,
    extract: (match) => ({
      source: match[6],
      target: match[9],
      relationship: "connection",
    }),
    handler: "relationship_connection",
  },

  // Comparison questions - "Which is stronger, X or Y?"
  {
    pattern:
      /which (is|are) (stronger|more important|dominant|prominent),? (my|the) (\w+) (or|and) (my|the) (\w+)/i,
    type: "comparison",
    confidence: 0.75,
    extract: (match) => ({
      first: match[4],
      second: match[7],
      comparison: match[2],
    }),
    handler: "comparison_strength",
  },

  // General questions - "Tell me about myself"
  {
    pattern:
      /(tell me|what can you tell me) (about )?(myself|me|my personality|who i am)/i,
    type: "general",
    confidence: 0.9,
    extract: () => ({
      questionType: "general_personality",
    }),
    handler: "general_personality",
  },
  {
    pattern: /(who am i|what am i like|describe me)/i,
    type: "general",
    confidence: 0.85,
    extract: () => ({
      questionType: "general_personality",
    }),
    handler: "general_personality",
  },

  // Life area questions - "What about my relationships?"
  {
    pattern: /(what about|tell me about|how are) (my|the) (\w+)/i,
    type: "life_area",
    confidence: 0.7,
    extract: (match) => ({
      area: match[3],
    }),
    handler: "life_area",
  },

  // Aspect questions - "What aspects does X have?"
  {
    pattern: /what (aspects|aspect) (does|do|has|have) (my|the) (\w+)/i,
    type: "aspects",
    confidence: 0.9,
    extract: (match) => ({
      target: match[4],
    }),
    handler: "aspects_planet",
  },
  {
    pattern:
      /(does|do) (my|the) (\w+) (and|&) (my|the) (\w+) (have|make) (an|a) (aspect|connection)/i,
    type: "aspects",
    confidence: 0.8,
    extract: (match) => ({
      first: match[3],
      second: match[6],
    }),
    handler: "aspects_pair",
  },
];

/**
 * Match a message against question patterns
 * @param {string} message - The user's message
 * @returns {Array} Array of matches sorted by confidence
 */
function matchPatterns(message) {
  const matches = [];

  for (const patternDef of questionPatterns) {
    const match = message.match(patternDef.pattern);
    if (match) {
      let extracted = null;
      try {
        extracted = patternDef.extract(match);
      } catch (error) {
        console.error(`Error extracting from pattern: ${error.message}`);
        continue;
      }

      matches.push({
        pattern: patternDef,
        match: match,
        extracted: extracted,
        confidence: patternDef.confidence,
        type: patternDef.type,
        handler: patternDef.handler,
      });
    }
  }

  // Sort by confidence (highest first)
  matches.sort((a, b) => b.confidence - a.confidence);

  return matches;
}

/**
 * Get the best matching pattern for a message
 * @param {string} message - The user's message
 * @param {number} minConfidence - Minimum confidence threshold (default 0.5)
 * @returns {object|null} Best match or null
 */
function getBestPattern(message, minConfidence = 0.5) {
  const matches = matchPatterns(message);
  if (matches.length === 0 || matches[0].confidence < minConfidence) {
    return null;
  }
  return matches[0];
}

/**
 * Check if a message matches a specific pattern type
 * @param {string} message - The user's message
 * @param {string} type - Pattern type to check for
 * @returns {boolean} True if message matches the type
 */
function matchesType(message, type) {
  const matches = matchPatterns(message);
  return matches.some((m) => m.type === type);
}

/**
 * Get all pattern types that match a message
 * @param {string} message - The user's message
 * @returns {Array} Array of pattern types
 */
function getMatchingTypes(message) {
  const matches = matchPatterns(message);
  return [...new Set(matches.map((m) => m.type))];
}

/**
 * Extract intent from a message
 * Combines pattern matching with semantic understanding
 * @param {string} message - The user's message
 * @returns {object} Intent object with type, confidence, and extracted data
 */
function extractIntent(message) {
  const patternMatch = getBestPattern(message, 0.4);

  if (patternMatch) {
    return {
      type: patternMatch.type,
      confidence: patternMatch.confidence,
      handler: patternMatch.handler,
      data: patternMatch.extracted,
      method: "pattern",
    };
  }

  // Fallback: try to infer from semantic matching
  // This would integrate with semantic_matcher.js
  return {
    type: "unknown",
    confidence: 0.3,
    handler: null,
    data: null,
    method: "fallback",
  };
}

module.exports = {
  questionPatterns,
  matchPatterns,
  getBestPattern,
  matchesType,
  getMatchingTypes,
  extractIntent,
};
