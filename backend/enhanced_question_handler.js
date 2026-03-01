// Enhanced question handler that combines:
// 1. Existing keyword matching (factual_questions.js)
// 2. New semantic matching (semantic_matcher.js)
// 3. New pattern recognition (question_patterns.js)
//
// This demonstrates how to enhance accuracy while keeping existing functionality

const {
  isFactualQuestion,
  answerFactualQuestion,
} = require("./factual_questions");
const {
  getBestMatch,
  matchesConcept,
  extractConcepts,
} = require("./semantic_matcher");
const { getBestPattern, extractIntent } = require("./question_patterns");

/**
 * Enhanced question handler that uses multiple methods
 * @param {string} message - User's question
 * @param {object} birthChart - Birth chart data
 * @returns {object} Response object with answer and metadata
 */
function handleQuestion(message, birthChart) {
  const result = {
    answer: null,
    method: null,
    confidence: 0,
    metadata: {},
  };

  // Method 1: Try existing factual question handler first (fast, deterministic)
  if (isFactualQuestion(message)) {
    const answer = answerFactualQuestion(message, birthChart);
    if (answer) {
      result.answer = answer;
      result.method = "factual_keyword";
      result.confidence = 0.95; // High confidence for deterministic answers
      result.metadata = {
        type: "factual",
        handler: "existing",
      };
      return result;
    }
  }

  // Method 2: Try pattern recognition (handles complex patterns)
  const patternMatch = getBestPattern(message, 0.5);
  if (patternMatch) {
    result.metadata.pattern = patternMatch;

    // Handle different pattern types
    switch (patternMatch.type) {
      case "factual":
        // Try to answer using pattern-extracted data
        const factualAnswer = answerFactualQuestionFromPattern(
          message,
          patternMatch,
          birthChart
        );
        if (factualAnswer) {
          result.answer = factualAnswer;
          result.method = "factual_pattern";
          result.confidence = patternMatch.confidence;
          return result;
        }
        break;

      case "interpretation":
        // This would trigger AI interpretation
        result.method = "interpretation_pattern";
        result.confidence = patternMatch.confidence;
        result.metadata.needsAI = true;
        result.metadata.target = patternMatch.extracted.target;
        return result;

      case "relationship":
        // This would trigger relationship analysis
        result.method = "relationship_pattern";
        result.confidence = patternMatch.confidence;
        result.metadata.needsAI = true;
        result.metadata.source = patternMatch.extracted.source;
        result.metadata.target = patternMatch.extracted.target;
        return result;

      case "general":
        // This would trigger general personality interpretation
        result.method = "general_pattern";
        result.confidence = patternMatch.confidence;
        result.metadata.needsAI = true;
        return result;
    }
  }

  // Method 3: Try semantic matching (handles synonyms and related terms)
  const semanticMatch = getBestMatch(message, 0.3);
  if (semanticMatch) {
    result.metadata.semantic = semanticMatch;

    // If it's a factual concept, try to answer
    const factualConcepts = [
      "sun",
      "moon",
      "mercury",
      "venus",
      "mars",
      "jupiter",
      "saturn",
      "uranus",
      "neptune",
      "pluto",
      "ascendant",
      "midheaven",
    ];

    if (factualConcepts.includes(semanticMatch.key)) {
      // Try to construct a factual question
      const constructedQuestion = constructFactualQuestion(
        message,
        semanticMatch.key
      );
      if (constructedQuestion) {
        const answer = answerFactualQuestion(constructedQuestion, birthChart);
        if (answer) {
          result.answer = answer;
          result.method = "factual_semantic";
          result.confidence = semanticMatch.score * 0.8; // Slightly lower than direct match
          return result;
        }
      }
    }

    // Otherwise, mark for AI interpretation
    result.method = "interpretation_semantic";
    result.confidence = semanticMatch.score;
    result.metadata.needsAI = true;
    result.metadata.concept = semanticMatch.key;
    return result;
  }

  // Method 4: Fallback - use intent extraction
  const intent = extractIntent(message);
  if (intent.type !== "unknown") {
    result.method = "intent_fallback";
    result.confidence = intent.confidence;
    result.metadata.intent = intent;
    result.metadata.needsAI = true;
    return result;
  }

  // No match found - return null to trigger default AI handling
  result.method = "unknown";
  result.confidence = 0;
  result.metadata.needsAI = true;
  return result;
}

/**
 * Try to answer a factual question using pattern-extracted data
 * @param {string} originalMessage - Original user message
 * @param {object} patternMatch - Pattern match result
 * @param {object} birthChart - Birth chart data
 * @returns {string|null} Answer or null
 */
function answerFactualQuestionFromPattern(
  originalMessage,
  patternMatch,
  birthChart
) {
  const extracted = patternMatch.extracted;

  if (extracted.questionType === "sign" && extracted.target) {
    // "What sign is X in?"
    const planetKey = extracted.target.toLowerCase();
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

  if (extracted.questionType === "house" && extracted.target) {
    // "What house is X in?"
    const planetKey = extracted.target.toLowerCase();
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

  return null;
}

/**
 * Construct a factual question from semantic match
 * @param {string} message - Original message
 * @param {string} conceptKey - Matched concept key
 * @returns {string|null} Constructed question or null
 */
function constructFactualQuestion(message, conceptKey) {
  const lowerMessage = message.toLowerCase();

  // Try to infer what they're asking about
  if (
    lowerMessage.includes("sign") ||
    lowerMessage.includes("what sign") ||
    lowerMessage.includes("which sign")
  ) {
    return `What sign is my ${conceptKey} in?`;
  }

  if (
    lowerMessage.includes("house") ||
    lowerMessage.includes("what house") ||
    lowerMessage.includes("which house")
  ) {
    return `What house is my ${conceptKey} in?`;
  }

  // Default: ask about sign
  return `What sign is my ${conceptKey} in?`;
}

/**
 * Get question understanding metadata
 * Useful for debugging and improving the system
 * @param {string} message - User's question
 * @returns {object} Understanding metadata
 */
function getQuestionUnderstanding(message) {
  const understanding = {
    originalMessage: message,
    methods: [],
    concepts: [],
    patterns: [],
    intent: null,
  };

  // Check semantic matching
  const semanticMatch = getBestMatch(message, 0.2);
  if (semanticMatch) {
    understanding.methods.push("semantic");
    understanding.concepts.push({
      key: semanticMatch.key,
      score: semanticMatch.score,
    });
  }

  // Check pattern matching
  const patternMatch = getBestPattern(message, 0.3);
  if (patternMatch) {
    understanding.methods.push("pattern");
    understanding.patterns.push({
      type: patternMatch.type,
      confidence: patternMatch.confidence,
      handler: patternMatch.handler,
    });
  }

  // Check factual matching
  if (isFactualQuestion(message)) {
    understanding.methods.push("factual");
  }

  // Get intent
  understanding.intent = extractIntent(message);

  return understanding;
}

module.exports = {
  handleQuestion,
  getQuestionUnderstanding,
  answerFactualQuestionFromPattern,
  constructFactualQuestion,
};
