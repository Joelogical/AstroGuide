// Enhanced chat endpoint with external resource access
// This demonstrates how to add function calling to enable AI to access external resources

const openai = require("./openai_service");
const {
  getFunctionDefinitions,
  executeFunction,
} = require("./external_resources");
const { generateSystemPrompt } = require("./chatgpt_template");
const {
  formatInterpretationForAI,
  generateChartInterpretation,
} = require("./chart_interpreter");
const {
  isFactualQuestion,
  answerFactualQuestion,
} = require("./factual_questions");

/**
 * Detect if a message is a casual greeting or simple acknowledgment
 * @param {string} message - User's message
 * @returns {boolean} True if message is casual/simple
 */
function isCasualMessage(message) {
  const lowerMessage = message.toLowerCase().trim();
  const casualPatterns = [
    /^(hi|hello|hey|hiya|howdy|greetings|sup|yo|what's up|whats up)$/i,
    /^(thanks|thank you|thx|ty|appreciate it)$/i,
    /^(ok|okay|k|sure|yep|yeah|yes|no|nope|alright|got it)$/i,
    /^(cool|nice|awesome|great|good|fine)$/i,
  ];

  // Check if it matches casual patterns
  if (casualPatterns.some((pattern) => pattern.test(lowerMessage))) {
    return true;
  }

  // Check if it's a very short message without astrological keywords
  const astroKeywords = [
    "chart",
    "birth",
    "astrology",
    "sign",
    "planet",
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
    "aries",
    "taurus",
    "gemini",
    "cancer",
    "leo",
    "virgo",
    "libra",
    "scorpio",
    "sagittarius",
    "capricorn",
    "aquarius",
    "pisces",
    "aspect",
    "house",
    "ascendant",
    "midheaven",
    "transit",
    "interpretation",
  ];

  if (
    lowerMessage.length < 20 &&
    !astroKeywords.some((keyword) => lowerMessage.includes(keyword))
  ) {
    return true;
  }

  return false;
}

/**
 * Check if user is asking about their chart or wants interpretation
 * @param {string} message - User's message
 * @param {Array} conversationHistory - Previous conversation messages
 * @returns {boolean} True if user wants chart interpretation
 */
function wantsChartInterpretation(message, conversationHistory = []) {
  const lowerMessage = message.toLowerCase().trim();
  const interpretationKeywords = [
    "tell me about",
    "tell me about myself",
    "interpret",
    "interpretation",
    "what does my chart",
    "what does my birth chart",
    "my chart",
    "my birth chart",
    "explain my",
    "describe my",
    "what am i",
    "who am i",
    "what are my",
    "what about me",
    "about myself",
    "my personality",
    "my traits",
    "what are my strengths",
    "what are my challenges",
    "what are my weaknesses",
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
    "rising",
    "aspect",
    "house",
    "transit",
  ];

  // Check current message
  if (
    interpretationKeywords.some((keyword) => lowerMessage.includes(keyword))
  ) {
    return true;
  }

  // Check conversation history for context
  const allMessages = [
    ...conversationHistory,
    { role: "user", content: message },
  ]
    .map((m) => m.content?.toLowerCase() || "")
    .join(" ");

  if (interpretationKeywords.some((keyword) => allMessages.includes(keyword))) {
    return true;
  }

  return false;
}

/**
 * Enhanced chat endpoint with external resource access via function calling
 * @param {string} message - User's message
 * @param {object} birthChart - Birth chart data
 * @param {Array} conversationHistory - Previous conversation messages
 * @returns {Promise<object>} Response with answer and metadata
 */
async function enhancedChatWithExternal(
  message,
  birthChart,
  conversationHistory = [],
) {
  try {
    // Check if this is a factual question first
    if (isFactualQuestion(message)) {
      const factualAnswer = answerFactualQuestion(message, birthChart);
      if (factualAnswer) {
        return {
          response: factualAnswer,
          isFactual: true,
          usedExternalResources: false,
        };
      }
    }

    // Determine if we should include full chart interpretation template
    const isCasual = isCasualMessage(message);
    const wantsInterpretation = wantsChartInterpretation(
      message,
      conversationHistory,
    );

    // Only generate interpretation template if user is asking about their chart
    let interpretationTemplate = null;
    if (wantsInterpretation && !isCasual) {
      if (birthChart.interpretationTemplate) {
        interpretationTemplate = birthChart.interpretationTemplate;
      } else if (birthChart.deterministicInterpretation) {
        const { formatInterpretationForAI } = require("./chart_interpreter");
        interpretationTemplate = formatInterpretationForAI(
          birthChart.deterministicInterpretation,
          birthChart,
        );
      } else {
        const deterministicInterpretation =
          generateChartInterpretation(birthChart);
        interpretationTemplate = formatInterpretationForAI(
          deterministicInterpretation,
          birthChart,
        );
      }
    }

    // Create messages array with context-aware system prompt
    const messages = [
      {
        role: "system",
        content:
          generateSystemPrompt(
            interpretationTemplate,
            isCasual,
            wantsInterpretation,
          ) +
          "\n\nYou have access to external resources through function calling. " +
          "If you need more detailed information about astrology concepts, current transits, " +
          "or specific interpretations, you can use the available functions to fetch this information.",
      },
    ];

    // Add conversation history
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }

    // Add current message
    messages.push({
      role: "user",
      content: message,
    });

    // Get function definitions
    const functions = getFunctionDefinitions();

    // Make API call with function calling enabled
    let completion;
    let usedExternalResources = false;
    let functionCalls = [];

    // First call - AI may request function calls
    completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // or "gpt-4" for better function calling
      messages: messages,
      functions: functions,
      function_call: "auto", // Let AI decide when to call functions
      temperature: 0.7,
      max_tokens: 1000,
    });

    // Check if AI wants to call a function
    const messageResponse = completion.choices[0].message;

    // Handle function calls if any
    if (messageResponse.function_call) {
      usedExternalResources = true;
      const functionName = messageResponse.function_call.name;
      const functionArgs = JSON.parse(messageResponse.function_call.arguments);

      console.log(
        `[EXTERNAL] AI requested function call: ${functionName}`,
        functionArgs,
      );

      // Execute the function
      const functionResult = await executeFunction(functionName, functionArgs);

      // Add function call and result to messages
      messages.push({
        role: "assistant",
        content: null,
        function_call: messageResponse.function_call,
      });

      messages.push({
        role: "function",
        name: functionName,
        content: JSON.stringify(functionResult),
      });

      functionCalls.push({
        name: functionName,
        args: functionArgs,
        result: functionResult,
      });

      // Make another API call with the function result
      completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages,
        functions: functions,
        function_call: "auto",
        temperature: 0.7,
        max_tokens: 1000,
      });
    }

    const finalResponse = completion.choices[0].message.content;

    return {
      response: finalResponse,
      isFactual: false,
      usedExternalResources: usedExternalResources,
      functionCalls: functionCalls,
    };
  } catch (error) {
    console.error("Error in enhanced chat with external:", error);
    throw error;
  }
}

module.exports = {
  enhancedChatWithExternal,
};
