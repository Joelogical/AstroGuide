// Semantic matching utilities for astrology concepts
// This module provides semantic understanding beyond exact keyword matching
// It maps concepts, synonyms, and related terms to improve question understanding

/**
 * Astrology concept knowledge graph
 * Maps concepts to their synonyms, related terms, and semantic relationships
 */
const astrologyConcepts = {
  // Planetary concepts with synonyms and related terms
  sun: {
    primary: "sun",
    synonyms: ["identity", "ego", "self", "core self", "essence", "vitality"],
    related: ["personality", "who am i", "purpose", "life force", "willpower"],
    questions: ["what is my sun", "tell me about my sun", "my sun sign"],
  },
  moon: {
    primary: "moon",
    synonyms: ["emotions", "feelings", "emotional nature", "inner self"],
    related: ["mood", "nurturing", "mother", "intuition", "emotional needs"],
    questions: ["what is my moon", "my moon sign", "emotional nature"],
  },
  mercury: {
    primary: "mercury",
    synonyms: ["communication", "thinking", "mind", "intellect"],
    related: ["learning", "speech", "writing", "analysis", "reasoning"],
    questions: ["how do i communicate", "my thinking style", "mercury sign"],
  },
  venus: {
    primary: "venus",
    synonyms: ["love", "relationships", "romance", "beauty", "values"],
    related: ["attraction", "partnership", "aesthetics", "harmony", "pleasure"],
    questions: ["love life", "relationships", "what i value", "attraction"],
  },
  mars: {
    primary: "mars",
    synonyms: ["action", "drive", "passion", "assertiveness"],
    related: ["anger", "aggression", "sex", "motivation", "energy", "conflict"],
    questions: ["how do i act", "my drive", "passion", "assertiveness"],
  },
  jupiter: {
    primary: "jupiter",
    synonyms: ["luck", "expansion", "growth", "philosophy"],
    related: ["optimism", "wisdom", "opportunity", "beliefs", "abundance"],
    questions: ["where is my luck", "growth areas", "philosophy", "beliefs"],
  },
  saturn: {
    primary: "saturn",
    synonyms: ["discipline", "responsibility", "challenges", "structure"],
    related: ["limitation", "karma", "lessons", "authority", "restriction"],
    questions: ["my challenges", "discipline", "responsibility", "lessons"],
  },
  uranus: {
    primary: "uranus",
    synonyms: ["change", "innovation", "rebellion", "freedom"],
    related: ["unpredictable", "revolution", "independence", "unconventional"],
    questions: ["how do i handle change", "innovation", "rebellion"],
  },
  neptune: {
    primary: "neptune",
    synonyms: ["dreams", "illusion", "spirituality", "creativity"],
    related: ["confusion", "intuition", "mysticism", "art", "compassion"],
    questions: ["my dreams", "spirituality", "creativity", "intuition"],
  },
  pluto: {
    primary: "pluto",
    synonyms: ["transformation", "power", "intensity", "control"],
    related: ["obsession", "regeneration", "depth", "taboo", "psychology"],
    questions: ["transformation", "power dynamics", "intensity", "control"],
  },
  ascendant: {
    primary: "ascendant",
    synonyms: ["rising", "asc", "outer self", "first impression"],
    related: ["appearance", "how others see me", "mask", "persona"],
    questions: ["my rising sign", "first impression", "how others see me"],
  },
  midheaven: {
    primary: "midheaven",
    synonyms: ["mc", "career", "public image", "vocation"],
    related: ["reputation", "life direction", "public self", "achievement"],
    questions: ["my career", "public image", "vocation", "life direction"],
  },

  // Life area concepts
  relationships: {
    primary: "relationships",
    synonyms: ["love", "partnership", "romance", "dating"],
    related: [
      "marriage",
      "compatibility",
      "partner",
      "attraction",
      "connection",
    ],
    questions: ["love life", "partnership", "romance", "dating"],
  },
  career: {
    primary: "career",
    synonyms: ["work", "job", "profession", "vocation"],
    related: ["success", "workplace", "colleagues", "boss", "employment"],
    questions: ["my work", "profession", "job", "career path"],
  },
  family: {
    primary: "family",
    synonyms: ["parents", "mother", "father", "siblings", "children", "home"],
    related: ["family dynamics", "home life", "roots", "heritage"],
    questions: ["my family", "parents", "home life", "family relationships"],
  },
  money: {
    primary: "money",
    synonyms: ["financial", "finances", "wealth", "income", "resources"],
    related: ["savings", "budget", "material security", "possessions"],
    questions: ["my finances", "money", "wealth", "financial situation"],
  },
  health: {
    primary: "health",
    synonyms: ["wellness", "physical", "body", "healing"],
    related: ["illness", "vitality", "energy", "wellbeing"],
    questions: ["my health", "physical wellbeing", "body", "wellness"],
  },

  // Aspect concepts
  aspects: {
    primary: "aspects",
    synonyms: ["planetary relationships", "planet connections"],
    related: ["conjunction", "square", "trine", "opposition", "sextile"],
    questions: ["how do my planets interact", "planetary aspects"],
  },

  // General concepts
  personality: {
    primary: "personality",
    synonyms: ["who am i", "myself", "about me", "character"],
    related: ["identity", "traits", "nature", "essence"],
    questions: ["tell me about myself", "who am i", "my personality"],
  },
  strengths: {
    primary: "strengths",
    synonyms: ["talents", "gifts", "positive", "good qualities"],
    related: ["abilities", "skills", "advantages", "assets"],
    questions: ["my strengths", "talents", "gifts", "what am i good at"],
  },
  challenges: {
    primary: "challenges",
    synonyms: ["difficulties", "problems", "struggles", "weaknesses"],
    related: ["negative", "issues", "trouble", "areas for growth"],
    questions: ["my challenges", "difficulties", "problems", "struggles"],
  },
};

/**
 * Calculate semantic similarity between a message and a concept
 * Returns a score between 0 and 1, where 1 is a perfect match
 * @param {string} message - The user's message (lowercased)
 * @param {object} concept - The concept object from astrologyConcepts
 * @returns {number} Similarity score (0-1)
 */
function calculateSemanticSimilarity(message, concept) {
  const lowerMessage = message.toLowerCase();
  let score = 0;
  let maxScore = 0;

  // Exact match on primary term (highest weight)
  if (lowerMessage.includes(concept.primary)) {
    score += 1.0;
    maxScore += 1.0;
  } else {
    maxScore += 1.0;
  }

  // Synonym matches (high weight)
  concept.synonyms.forEach((synonym) => {
    if (lowerMessage.includes(synonym)) {
      score += 0.8;
    }
    maxScore += 0.8;
  });

  // Related term matches (medium weight)
  concept.related.forEach((related) => {
    if (lowerMessage.includes(related)) {
      score += 0.5;
    }
    maxScore += 0.5;
  });

  // Question pattern matches (high weight if exact)
  concept.questions.forEach((question) => {
    if (lowerMessage.includes(question)) {
      score += 0.9;
    }
    maxScore += 0.9;
  });

  // Normalize by max possible score
  return maxScore > 0 ? score / maxScore : 0;
}

/**
 * Find the best matching concept(s) for a message
 * @param {string} message - The user's message
 * @returns {Array} Array of {concept, key, score} objects, sorted by score
 */
function findMatchingConcepts(message) {
  const lowerMessage = message.toLowerCase();
  const matches = [];

  for (const [key, concept] of Object.entries(astrologyConcepts)) {
    const score = calculateSemanticSimilarity(lowerMessage, concept);
    if (score > 0.1) {
      // Only include if there's some match
      matches.push({ concept, key, score });
    }
  }

  // Sort by score (highest first)
  matches.sort((a, b) => b.score - a.score);

  return matches;
}

/**
 * Get the best matching concept for a message
 * @param {string} message - The user's message
 * @param {number} threshold - Minimum score threshold (default 0.3)
 * @returns {object|null} Best matching concept or null
 */
function getBestMatch(message, threshold = 0.3) {
  const matches = findMatchingConcepts(message);
  if (matches.length === 0 || matches[0].score < threshold) {
    return null;
  }
  return matches[0];
}

/**
 * Check if a message matches a specific concept
 * @param {string} message - The user's message
 * @param {string} conceptKey - The concept key (e.g., "sun", "moon", "relationships")
 * @param {number} threshold - Minimum score threshold (default 0.3)
 * @returns {boolean} True if message matches the concept
 */
function matchesConcept(message, conceptKey, threshold = 0.3) {
  const concept = astrologyConcepts[conceptKey];
  if (!concept) {
    return false;
  }
  const score = calculateSemanticSimilarity(message.toLowerCase(), concept);
  return score >= threshold;
}

/**
 * Extract multiple concepts from a message
 * Useful for complex questions that might involve multiple topics
 * @param {string} message - The user's message
 * @param {number} threshold - Minimum score threshold (default 0.3)
 * @returns {Array} Array of matching concept keys
 */
function extractConcepts(message, threshold = 0.3) {
  const matches = findMatchingConcepts(message);
  return matches.filter((m) => m.score >= threshold).map((m) => m.key);
}

/**
 * Get semantic context for a concept
 * Returns all related terms that might be useful for understanding
 * @param {string} conceptKey - The concept key
 * @returns {object|null} Concept object with all related terms
 */
function getConceptContext(conceptKey) {
  return astrologyConcepts[conceptKey] || null;
}

module.exports = {
  astrologyConcepts,
  calculateSemanticSimilarity,
  findMatchingConcepts,
  getBestMatch,
  matchesConcept,
  extractConcepts,
  getConceptContext,
};
