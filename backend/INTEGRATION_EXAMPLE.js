// Example: How to integrate external resource access into your existing chat endpoint
// This shows the minimal changes needed to add function calling

// ============================================================================
// OPTION 1: Add as an alternative endpoint (safest - doesn't break existing)
// ============================================================================

// Add this new endpoint alongside your existing /api/chat
app.post("/api/chat-with-external", async (req, res) => {
  try {
    const { message, birthChart, conversationHistory } = req.body;

    if (!message || !birthChart) {
      return res.status(400).json({
        error: "Missing required fields",
        details: "Please provide both a message and birth chart data",
      });
    }

    // Use the enhanced chat with external resources
    const { enhancedChatWithExternal } = require("./enhanced_chat_with_external");
    const result = await enhancedChatWithExternal(
      message,
      birthChart,
      conversationHistory || []
    );

    // Follow-ups: use generateFollowUpSuggestionsLLM from ./followup_suggestions.js (see server.js)

    return res.json({
      response: result.response,
      followUpSuggestions: [],
      usedExternalResources: result.usedExternalResources,
      // Optional: include function calls for debugging
      // functionCalls: result.functionCalls,
    });
  } catch (error) {
    console.error("Error in chat-with-external endpoint:", error);
    return res.status(500).json({
      error: "Failed to process chat message",
      details: error.message,
    });
  }
});

// ============================================================================
// OPTION 2: Replace existing endpoint (more integrated)
// ============================================================================

// Replace your existing /api/chat endpoint with this:
app.post("/api/chat", async (req, res) => {
  try {
    const { message, birthChart, conversationHistory } = req.body;

    if (!message || !birthChart) {
      return res.status(400).json({
        error: "Missing required fields",
        details: "Please provide both a message and birth chart data",
      });
    }

    // Check if this is a factual question first (keep existing behavior)
    if (isFactualQuestion(message)) {
      const factualAnswer = answerFactualQuestion(message, birthChart);
      if (factualAnswer) {
        console.log("[FACTUAL] Answered factual question deterministically");
        return res.json({
          response: factualAnswer,
          isFactual: true,
          followUpSuggestions: [],
        });
      }
    }

    // NEW: Use enhanced chat with external resources
    const { enhancedChatWithExternal } = require("./enhanced_chat_with_external");
    const result = await enhancedChatWithExternal(
      message,
      birthChart,
      conversationHistory || []
    );

    // Log if external resources were used (for monitoring)
    if (result.usedExternalResources) {
      console.log("[EXTERNAL] Used external resources:", result.functionCalls);
    }

    return res.json({
      response: result.response,
      followUpSuggestions: [],
      // Optional: include metadata
      // usedExternalResources: result.usedExternalResources,
    });
  } catch (error) {
    console.error("Error in chat endpoint:", error);
    return res.status(500).json({
      error: "Failed to process chat message",
      details: error.message,
    });
  }
});

// ============================================================================
// OPTION 3: Hybrid approach - use external resources only when needed
// ============================================================================

// Detect when external resources might be helpful
function shouldUseExternalResources(message) {
  const externalKeywords = [
    "current",
    "now",
    "transit",
    "today",
    "recent",
    "latest",
    "what's happening",
    "explain",
    "detailed",
    "more about",
    "tell me everything",
  ];

  const lowerMessage = message.toLowerCase();
  return externalKeywords.some((keyword) => lowerMessage.includes(keyword));
}

app.post("/api/chat", async (req, res) => {
  try {
    const { message, birthChart, conversationHistory } = req.body;

    if (!message || !birthChart) {
      return res.status(400).json({
        error: "Missing required fields",
        details: "Please provide both a message and birth chart data",
      });
    }

    // Check if this is a factual question first
    if (isFactualQuestion(message)) {
      const factualAnswer = answerFactualQuestion(message, birthChart);
      if (factualAnswer) {
        return res.json({
          response: factualAnswer,
          isFactual: true,
          followUpSuggestions: [],
        });
      }
    }

    // Decide whether to use external resources
    const useExternal = shouldUseExternalResources(message);

    if (useExternal) {
      // Use enhanced chat with external resources
      const { enhancedChatWithExternal } = require("./enhanced_chat_with_external");
      const result = await enhancedChatWithExternal(
        message,
        birthChart,
        conversationHistory || []
      );

      return res.json({
        response: result.response,
        followUpSuggestions: [],
      });
    } else {
      // Use existing chat endpoint (no external resources)
      // ... your existing code here ...
    }
  } catch (error) {
    console.error("Error in chat endpoint:", error);
    return res.status(500).json({
      error: "Failed to process chat message",
      details: error.message,
    });
  }
});
