const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// Log full stack for unhandled rejections (e.g. "Assignment to constant variable")
process.on("unhandledRejection", (reason, promise) => {
  console.error("\n!!! UNHANDLED REJECTION !!!");
  console.error("Reason:", reason);
  if (reason && typeof reason === "object" && "stack" in reason) {
    console.error("Stack:\n", reason.stack);
  }
});

const { getBirthChartInterpretation } = require("./chatgpt_service");
const {
  formatBirthChartForChatGPT,
  generateSystemPrompt,
} = require("./chatgpt_template");
const openai = require("./openai_service");
const {
  generateChartInterpretation,
  formatInterpretationForAI,
} = require("./chart_interpreter");
const {
  isFactualQuestion,
  answerFactualQuestion,
} = require("./factual_questions");
const {
  getFunctionDefinitions,
  executeFunction,
  gatherChartInterpretationsFromWeb,
} = require("./external_resources");
const { getPrioritizedChartPoints } = require("./chart_signals");
const {
  buildProfileMemoryBlock,
  buildGenerationMessages,
  composeSystemContent,
} = require("./prompt_layers");
const { generateFollowUpSuggestionsLLM } = require("./followup_suggestions");
const { isGibberishPrompt, gibberishReply } = require("./gibberish_prompt");
const { isPredictionQuestion } = require("./prediction_guard");
const { validateBirthInput } = require("./birth_input");
const { routeChatIntent } = require("./intent_router");
const { buildAnalysisState } = require("./analysis_state");
const {
  historyBeforeCurrentTurn,
  continuesEstablishedChartAnalysis,
} = require("./chart_analysis");
const { handleQuestion } = require("./enhanced_question_handler");
const {
  buildChartArchitecture,
  ensureArchitecture,
  formatArchitectureForAI,
  formatLockedClaimsForModel,
  formatTopicLensForModel,
  formatAspectLensForModel,
} = require("./chart_architecture");
const {
  structuresFromArchitecture,
} = require("./knowledge/alan-leo/loader");
const { calculateNatalChart } = require("./birth_chart_service");
const {
  isTraditionalChart,
  applyTraditionalChartView,
} = require("./traditional_chart");
const {
  unavailableBodyReply,
  resolveChatReading,
} = require("./reading_configuration");

// Debug logging for environment variables
console.log("Environment variables loaded:");
console.log(
  "ASTROLOGY_API_USER_ID:",
  process.env.ASTROLOGY_API_USER_ID ? "Present" : "Missing",
);
console.log(
  "ASTROLOGY_API_KEY:",
  process.env.ASTROLOGY_API_KEY ? "Present" : "Missing",
);
console.log(
  "OPENAI_API_KEY:",
  process.env.OPENAI_API_KEY ? "Present" : "Missing",
);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Simple in-memory user storage (replace with a database in production)
const users = new Map();

// Add a test user
users.set("test@example.com", {
  email: "test@example.com",
  password: "test123", // In production, this would be hashed
  name: "Test User",
  birthDate: "1990-01-01",
  birthTime: "12:00",
  birthPlace: "New York, USA",
});

// Login endpoint
app.post("/api/login", (req, res) => {
  try {
    console.log("Login request received:", {
      email: req.body?.email,
      hasPassword: !!req.body?.password,
    });
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }

    // Trim email
    const trimmedEmail = email.trim().toLowerCase();

    const user = users.get(trimmedEmail);
    if (!user) {
      console.log(`Login failed: User not found - ${trimmedEmail}`);
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
        token: null,
      });
    }

    if (user.password !== password) {
      console.log(`Login failed: Incorrect password for ${trimmedEmail}`);
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
        token: null,
      });
    }

    console.log(`Login successful for ${trimmedEmail}`);
    res.json({
      success: true,
      token: "demo-token-" + Date.now(),
      user: {
        email: user.email,
        name: user.name,
        birthDate: user.birthDate,
        birthTime: user.birthTime,
        birthPlace: user.birthPlace,
      },
    });
  } catch (error) {
    console.error("Login endpoint error:", error);
    return res.status(500).json({
      success: false,
      error: "An internal server error occurred",
    });
  }
});

// Signup endpoint
app.post("/api/signup", (req, res) => {
  try {
    console.log("Signup request received:", {
      email: req.body?.email,
      name: req.body?.name,
      hasPassword: !!req.body?.password,
      hasBirthData: !!(
        req.body?.birthDate &&
        req.body?.birthTime &&
        req.body?.birthPlace
      ),
    });
    const { email, password, name, birthDate, birthTime, birthPlace } =
      req.body;

    if (
      !email ||
      !password ||
      !name ||
      !birthDate ||
      !birthTime ||
      !birthPlace
    ) {
      return res.status(400).json({
        success: false,
        error: "All fields are required",
      });
    }

    // Trim and normalize email
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    const trimmedBirthPlace = birthPlace.trim();

    if (users.has(trimmedEmail)) {
      console.log(`Signup failed: User already exists - ${trimmedEmail}`);
      return res.status(409).json({
        success: false,
        error: "User already exists",
      });
    }

    const user = {
      email: trimmedEmail,
      password,
      name: trimmedName,
      birthDate,
      birthTime,
      birthPlace: trimmedBirthPlace,
    };

    users.set(trimmedEmail, user);
    console.log(`Signup successful for ${trimmedEmail}`);

    res.json({
      success: true,
      token: "demo-token-" + Date.now(),
      user: {
        email: user.email,
        name: user.name,
        birthDate: user.birthDate,
        birthTime: user.birthTime,
        birthPlace: user.birthPlace,
      },
    });
  } catch (error) {
    console.error("Signup endpoint error:", error);
    return res.status(500).json({
      success: false,
      error: "An internal server error occurred",
    });
  }
});

// Calculate birth chart (Swiss Ephemeris first; AstrologyAPI.com is the backup)
app.post("/api/birth-chart", async (req, res) => {
  console.log(
    "Received birth chart request body:",
    JSON.stringify(req.body, null, 2),
  );

  try {
    const {
      year,
      month,
      day,
      hour,
      minute,
      latitude,
      longitude,
      timezone,
      asteroids,
      unknownBirthTime,
    } = req.body;
    const timeUnknown = !!unknownBirthTime;

    // Log parsed values with validation
    const parsedYear = typeof year === "string" ? parseInt(year) : year;
    const parsedMonth = typeof month === "string" ? parseInt(month) : month;
    const parsedDay = typeof day === "string" ? parseInt(day) : day;
    const parsedHour = timeUnknown
      ? 12
      : typeof hour === "string"
        ? parseInt(hour)
        : hour;
    const parsedMinute = timeUnknown
      ? 0
      : typeof minute === "string"
        ? parseInt(minute)
        : minute;
    const parsedLat =
      typeof latitude === "string" ? parseFloat(latitude) : latitude;
    const parsedLon =
      typeof longitude === "string" ? parseFloat(longitude) : longitude;
    const parsedTz =
      typeof timezone === "string" ? parseFloat(timezone) : timezone;

    console.log("=== BACKEND: Parsed birth chart request ===");
    console.log("Parsed values:", {
      year: parsedYear,
      month: parsedMonth,
      day: parsedDay,
      hour: parsedHour,
      minute: parsedMinute,
      latitude: parsedLat,
      longitude: parsedLon,
      timezone: parsedTz,
    });
    console.log("===========================================");

    // Log validation checks
    console.log("Validation checks:", {
      dateValid:
        parsedYear > 1900 &&
        parsedYear < 2100 &&
        parsedMonth >= 1 &&
        parsedMonth <= 12 &&
        parsedDay >= 1 &&
        parsedDay <= 31,
      timeValid:
        parsedHour >= 0 &&
        parsedHour < 24 &&
        parsedMinute >= 0 &&
        parsedMinute < 60,
      coordinatesValid:
        parsedLat >= -90 &&
        parsedLat <= 90 &&
        parsedLon >= -180 &&
        parsedLon <= 180,
      timezoneValid: parsedTz >= -12 && parsedTz <= 14,
      houseSystem: "placidus", // Confirmed house system
    });

    const birthInput = validateBirthInput({
      year: parsedYear,
      month: parsedMonth,
      day: parsedDay,
      hour: parsedHour,
      minute: parsedMinute,
      latitude: parsedLat,
      longitude: parsedLon,
      timezone: parsedTz,
      unknownBirthTime: timeUnknown,
    });
    if (!birthInput.ok) {
      console.log("Missing or invalid fields:", birthInput.errors);
      return res.status(400).json({
        error: "Missing required fields",
        details: "Please provide all required birth data",
        received: req.body,
      });
    }

    try {
      const birthChart = await calculateNatalChart({
        year: parsedYear,
        month: parsedMonth,
        day: parsedDay,
        hour: birthInput.hour,
        minute: birthInput.minute,
        latitude: birthInput.latitude,
        longitude: birthInput.longitude,
        timezone: birthInput.timezone,
        asteroids,
        unknownBirthTime: timeUnknown,
      });

      console.log(
        "Transformed birth chart:",
        JSON.stringify(birthChart, null, 2),
      );

      birthChart.architecture = buildChartArchitecture(birthChart);
      birthChart.architectureTraditional = buildChartArchitecture(
        applyTraditionalChartView(birthChart),
      );

      const deterministicInterpretation =
        generateChartInterpretation(birthChart);
      const interpretationTemplate = formatInterpretationForAI(
        deterministicInterpretation,
        birthChart,
      );

      return res.json({
        ...birthChart,
        deterministicInterpretation: deterministicInterpretation,
        interpretationTemplate: interpretationTemplate,
        interpretation: interpretationTemplate,
      });
    } catch (apiError) {
      console.error("Full chart calculation error:", apiError);
      return res.status(500).json({
        error: "Failed to calculate birth chart",
        details: apiError.response?.data?.message || apiError.message,
        request: {
          date: `${year}-${month}-${day}`,
          time: `${hour}:${minute}`,
          latitude,
          longitude,
          timezone: timezone || 0,
        },
      });
    }
  } catch (error) {
    // Handle any other errors
    console.error("Unexpected error:", error);
    return res.status(500).json({
      error: "Unexpected error occurred",
      details: error.message,
      stack: error.stack,
    });
  }
});

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
function wantsChartInterpretation(message) {
  const lowerMessage = String(message || "").toLowerCase().trim();
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
    "chiron",
    "ceres",
    "pallas",
    "juno",
    "vesta",
    "ascendant",
    "midheaven",
    "rising",
    "aspect",
    "house",
    "transit",
  ];

  return interpretationKeywords.some((keyword) =>
    lowerMessage.includes(keyword),
  );
}

function isWholeSelfQuestion(message) {
  const t = String(message || "").toLowerCase().trim();
  const pats = [
    /tell me about myself/,
    /about myself/,
    /tell me about me\b/,
    /who am i\b/,
    /what am i like/,
    /describe me\b/,
    /describe myself/,
    /more about me\b/,
    /more about myself/,
    /what else about me/,
    /my personality/,
    /my traits/,
    /what does my (birth )?chart say about me/,
  ];
  return pats.some((p) => p.test(t));
}

function isOpenAIQuotaOrBillingError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode;
  const text = [err.message, err.code, err.error && err.error.message]
    .filter(Boolean)
    .join(" ");
  if (status === 429) return true;
  return /429|insufficient_quota|no credits remaining|billing/i.test(text);
}

function wrapOpenAIError(openaiErr) {
  const wrapped = new Error("[OpenAI create] " + (openaiErr.message || ""));
  wrapped.stack = openaiErr.stack;
  wrapped.status = openaiErr.status || openaiErr.statusCode;
  wrapped.code = openaiErr.code;
  return wrapped;
}

function buildLocalChartSynthesis(birthChart) {
  const reading = isTraditionalChart(birthChart)
    ? applyTraditionalChartView(birthChart)
    : birthChart;
  const planets = (reading && reading.planets) || {};
  const sun = planets.sun;
  const moon = planets.moon;
  const asc = birthChart && birthChart.angles && birthChart.angles.ascendant;
  const parts = [];
  try {
    const arch = ensureArchitecture(birthChart);
    if (arch && arch.ok) {
      const claims = arch.thesisClaims || [];
      if (claims.length) {
        parts.push(claims.join(" "));
      }
    }
  } catch (archErr) {
    console.warn("[CHAT] local architecture failed:", archErr.message);
  }
  if (sun && moon && asc) {
    parts.push(
      `Your Sun is in ${sun.sign} (house ${sun.house}), the Moon is in ${moon.sign} (house ${moon.house}), and the Ascendant is ${asc.sign}.`,
    );
  }
  try {
    const interp = generateChartInterpretation(reading);
    const ruler = interp.coreSynthesis && interp.coreSynthesis.chartRuler;
    if (ruler && !parts.some((p) => /chart is steered/i.test(p))) {
      parts.push(
        `The chart ruler is ${ruler.planet} in ${ruler.sign} in house ${ruler.house}.`,
      );
    }
    const themes = interp.keyThemes || [];
    if (themes.length) {
      parts.push(`Themes that stand out: ${themes.slice(0, 3).join("; ")}.`);
    }
  } catch (synthErr) {
    console.warn("[CHAT] local synthesis failed:", synthErr.message);
  }
  if (!parts.length) {
    parts.push("I can still read the stored chart, but I need a more specific question.");
  }
  return parts.join(" ");
}

function buildLocalChatReply(message, birthChart, conversationHistory) {
  if (!birthChart) {
    return "I need a birth chart loaded before I can answer that.";
  }
  if (
    isCasualMessage(message) &&
    !wantsChartInterpretation(message) &&
    !continuesEstablishedChartAnalysis(message, conversationHistory)
  ) {
    return "Hi — I'm here. Ask about a planet, house, or how the chart fits together.";
  }
  if (isFactualQuestion(message)) {
    const factual = answerFactualQuestion(message, birthChart);
    if (factual) return factual;
  }
  try {
    const asked = handleQuestion(message, birthChart);
    if (asked && asked.answer) return asked.answer;
  } catch (handlerErr) {
    console.warn("[CHAT] local handleQuestion failed:", handlerErr.message);
  }
  return buildLocalChartSynthesis(birthChart);
}

function sendLocalChatFallback(res, payload) {
  if (res.headersSent) return;
  const response = buildLocalChatReply(
    payload.message,
    payload.birthChart,
    payload.conversationHistory,
  );
  console.warn("[CHAT] Using local fallback (OpenAI unavailable)");
  return res.json({
    response,
    followUpSuggestions: [],
    followUpQuestion: null,
    usedLocalFallback: true,
  });
}

function fallbackPayloadFromReq(req) {
  const body = (req && req.body) || {};
  const birthChart = body.birthChart;
  if (birthChart && typeof birthChart === "object") {
    const system =
      String(body.chartSystem || birthChart.chartSystem || "modern").toLowerCase() ===
      "traditional"
        ? "traditional"
        : "modern";
    birthChart.chartSystem = system;
  }
  return {
    message: body.message,
    birthChart: birthChart,
    conversationHistory: body.conversationHistory || [],
  };
}

// Chat endpoint for follow-up questions (wrapped so async rejections return detailed 500 with stage/stack)
app.post("/api/chat", (req, res) => {
  console.log("[CHAT] *** Request received ***");
  let stage = "start";
  const send500 = (err) => {
    if (res.headersSent) return;
    console.error("\n*** 500 ERROR (chat) ***", err.message);
    console.error("*** Stage was:", stage);
    console.error("*** Stack:\n", err.stack);
    const stackLines = (err.stack || "").split("\n").slice(0, 15);
    res.status(500).json({
      error: "Failed to process chat message",
      details: err.message,
      stage: stage,
      stack: err.stack || undefined,
      stackPreview: stackLines,
      _debug: "send500-v2", // confirms new error handler is running
    });
  };
  return (async () => {
    try {
      const body = req.body || {};
      const message = body.message;
      const birthChart = body.birthChart;
      const conversationHistory = body.conversationHistory || [];
      const profileMemory = body.profileMemory || null;
      const chartSummary = body.chartSummary || null;
      const chatReading = resolveChatReading(body);
      const chartSystem = chatReading.chartSystem;
      const readingConfig = chatReading.readingConfig;
      const readingChart = chatReading.readingChart;
      stage = "after-body";

      if (!message || !birthChart) {
        return res.status(400).json({
          error: "Missing required fields",
          details: "Please provide both a message and birth chart data",
        });
      }

      if (isGibberishPrompt(message)) {
        console.log("[CHAT] Gibberish prompt — instant reply");
        return res.json({
          response: gibberishReply(),
          followUpSuggestions: [],
          followUpQuestion: null,
          isGibberish: true,
        });
      }

      const missingTraditionalBody = unavailableBodyReply(message, readingConfig);
      if (missingTraditionalBody) {
        return res.json({
          response: missingTraditionalBody,
          followUpSuggestions: [],
          followUpQuestion: null,
        });
      }

      if (isFactualQuestion(message)) {
        const factualAnswer = answerFactualQuestion(message, readingChart);
        if (factualAnswer) {
          console.log("[FACTUAL] Answered factual question deterministically");
          return res.json({
            response: factualAnswer,
            isFactual: true,
            followUpSuggestions: [],
            followUpQuestion: null,
          });
        }
      }

      // ⚠️ CHECK FOR GENERAL ASTROLOGY QUESTIONS FIRST (before any chart processing)
      // This ensures we handle general questions without any chart context
      const lowerMessage = message.toLowerCase().trim();

      // Pattern: "what does [planet] in [sign]" = general question
      const isGeneralQuestionPattern =
        (lowerMessage.includes("what does") ||
          lowerMessage.includes("tell me about") ||
          lowerMessage.includes("explain") ||
          lowerMessage.includes("what is") ||
          lowerMessage.includes("what are")) &&
        (lowerMessage.match(
          /\b(venus|sun|moon|mercury|mars|jupiter|saturn|uranus|neptune|pluto)\b/i,
        ) ||
          lowerMessage.match(
            /\b(scorpio|aries|taurus|gemini|cancer|leo|virgo|libra|sagittarius|capricorn|aquarius|pisces)\b/i,
          )) &&
        !lowerMessage.includes("my ") &&
        !lowerMessage.includes("my chart") &&
        !lowerMessage.includes("my birth") &&
        !lowerMessage.includes("my venus") &&
        !lowerMessage.includes("my sun") &&
        !lowerMessage.includes("my moon");

      if (isGeneralQuestionPattern) {
        console.log(
          "═══════════════════════════════════════════════════════════",
        );
        console.log(
          "[CHAT] 🎯 GENERAL QUESTION DETECTED - Handling separately from chart",
        );
        console.log("[CHAT] Original message:", message);
        console.log(
          "═══════════════════════════════════════════════════════════",
        );

        // Extract search query
        let searchQuery = message
          .replace(/^what (does|is|are) /i, "")
          .replace(/^tell me about /i, "")
          .replace(/^explain /i, "")
          .replace(/\?$/, "")
          .trim();

        console.log("[CHAT] Search query:", searchQuery);

        // Call function directly
        let functionResult;
        try {
          functionResult = await executeFunction("search_astrology_info", {
            query: searchQuery,
          });
          console.log(
            "[CHAT] Function result length:",
            functionResult?.length || 0,
          );
          if (functionResult) {
            console.log(
              "[CHAT] Function result preview:",
              functionResult.substring(0, 200),
            );
          }
        } catch (funcError) {
          console.error("[CHAT] Function error:", funcError);
          functionResult = null;
        }

        if (functionResult) {
          // Create response with ONLY the function result, NO chart data
          // DO NOT include conversation history for general questions
          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content:
                  "You are AstroGuide, an expert astrologer answering a GENERAL astrology question.\n\n" +
                  "⚠️ CRITICAL: This is a GENERAL educational question about astrology concepts. " +
                  "The user is asking 'What does [planet] in [sign] mean?' - they want to learn about the concept, NOT about their personal chart.\n\n" +
                  "ABSOLUTE RULES - FOLLOW THESE STRICTLY:\n" +
                  "1. NEVER mention the user's chart, their placements, or anything personal\n" +
                  "2. NEVER say 'your venus', 'your chart', 'in your chart', or any personal references\n" +
                  "3. Explain the concept GENERALLY - 'Venus in Scorpio means...' not 'Your Venus in Scorpio...'\n" +
                  "4. Write as if teaching astrology to a student who wants to understand the concept\n" +
                  "5. Use the provided information below to give a comprehensive, educational answer\n" +
                  "6. If you mention the concept, say 'Venus in Scorpio' not 'your Venus in Scorpio'\n\n" +
                  "You have been provided with detailed information about this astrology concept. " +
                  "Use ONLY this information to answer. Do NOT reference any chart data, birth data, or personal information.",
              },
              {
                role: "user",
                content: message,
              },
              {
                role: "assistant",
                content: `Here's what I have on this:\n\n${functionResult}\n\nI'll explain it in a clear, conversational way.`,
              },
            ],
            temperature: 0.7,
            max_tokens: 1000,
          });

          const completionPlainGeneral = JSON.parse(JSON.stringify(completion));
          const response = completionPlainGeneral.choices[0].message.content;

          // Check if response incorrectly mentions user's chart
          const responseLower = response.toLowerCase();
          const mentionsUserChart =
            responseLower.includes("your venus") ||
            responseLower.includes("your chart") ||
            responseLower.includes("in your chart") ||
            responseLower.includes("your placement");

          if (mentionsUserChart) {
            console.warn(
              "[CHAT] ⚠️ WARNING: Response mentions user's chart despite being general question!",
            );
            console.warn("[CHAT] Response:", response.substring(0, 300));
          }

          console.log(
            "═══════════════════════════════════════════════════════════",
          );
          console.log("[CHAT] ✅ General question answered successfully");
          console.log("[CHAT] Response length:", response.length);
          console.log("[CHAT] Mentions user chart:", mentionsUserChart);
          console.log("[CHAT] Response preview:", response.substring(0, 300));
          console.log(
            "═══════════════════════════════════════════════════════════",
          );

          // IMPORTANT: Return early - don't fall through to chart processing
          let followUpSuggestions = [];
          try {
            followUpSuggestions = await generateFollowUpSuggestionsLLM(
              openai,
              {
                userMessage: message,
                assistantResponse: response,
                birthChart,
                chartSummary,
                conversationHistory,
                isGeneralQuestion: true,
                lastMode: "general",
                preferredMode:
                  profileMemory && profileMemory.preferredMode === "advanced"
                    ? "advanced"
                    : "beginner",
              },
            );
          } catch (fuErr) {
            console.warn(
              "[CHAT] Follow-up suggestions (general) failed:",
              fuErr.message,
            );
          }
          return res.json({
            response: response,
            followUpSuggestions,
            followUpQuestion: followUpSuggestions[0] || null,
            usedExternalResources: true,
          });
        } else {
          console.log(
            "[CHAT] ⚠️ Function returned no result, falling through to normal flow",
          );
          console.log(
            "[CHAT] Function result was:",
            functionResult === null
              ? "null"
              : functionResult === undefined
                ? "undefined"
                : "empty string",
          );
        }
      } else {
        console.log(
          "[CHAT] Not a general question - processing as chart question",
        );
      }
      stage = "before-interpretation";
      // Prewritten interpretation prose stays on the birth-chart response for display
      // and on the local fallback if the model call fails. It is not model context.
      stage = "after-interpretation";

      // Check if this is a casual message or if user wants chart interpretation
      const isCasual = isCasualMessage(message);
      const wantsInterpretation = wantsChartInterpretation(message);

      // For casual messages, use a simpler system prompt that doesn't push chart information
      if (
        isCasual &&
        !wantsInterpretation &&
        !continuesEstablishedChartAnalysis(message, conversationHistory)
      ) {
        const casualSystemContent =
          "You are AstroGuide. Stay generally neutral and professional; otherwise respond in a natural, helpful way—no fixed persona script.\n\n" +
          "CASUAL MESSAGES:\n" +
          "Match the user's tone loosely (brief if they're brief). Don't volunteer chart interpretations, aspects, or placements unless they ask.\n" +
          "Keep greetings and small talk short. Avoid astrology jargon unless the user uses it first.";

        const messages = buildGenerationMessages(
          casualSystemContent,
          historyBeforeCurrentTurn(message, conversationHistory),
          message,
        );

        // Make API call
        const functions = getFunctionDefinitions();
        let completion;
        try {
          completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            functions: functions,
            function_call: "auto",
            temperature: 0.7,
            max_tokens: 500, // Shorter for casual messages
            presence_penalty: 0.1,
            frequency_penalty: 0.0,
          });
        } catch (openaiErr) {
          throw wrapOpenAIError(openaiErr);
        }

        const finalResponse = completion.choices[0].message.content || "";
        return res.json({
          response: String(finalResponse),
          followUpSuggestions: [],
          followUpQuestion: null,
        });
      }

      const route = routeChatIntent({
        message: message,
        history: conversationHistory,
      });
      const priorConversation = route.priorConversation;
      const questionForMode = route.questionForMode;
      const clickedAspect = route.clickedAspect;
      const aspectMode = route.aspectMode;
      const chartAnalysisMode = route.chartAnalysisMode;
      const chartMode = route.chartMode;
      const topic = route.topic;
      const topicMode = route.topicMode;
      const thesisMode = route.thesisMode;
      if (chartAnalysisMode) {
        console.log("[CHAT] CHART_ANALYSIS intent — inspect chart as a system");
      }
      let architectureBlock = "";
      let thesisText = "";
      let topicLens = "";
      let aspectLens = "";
      let knowledgeStructures = null;
      let chartAnalysisProgression = null;
      try {
        const arch = ensureArchitecture(readingChart);
        if (arch && arch.ok) {
          knowledgeStructures = structuresFromArchitecture(arch);
          if (route.progressionEligible) {
            const analysisState = buildAnalysisState(
              arch,
              priorConversation,
              route,
            );
            chartAnalysisProgression = analysisState.focus;
            console.log(
              "[CHAT] CHART_ANALYSIS focus:",
              analysisState.currentFocus,
              analysisState.progressionPhase,
            );
          }
          thesisText = formatLockedClaimsForModel(arch, {
            portrait: thesisMode,
          });
          if (topicMode) {
            topicLens = formatTopicLensForModel(arch, topic, birthChart);
          } else if (aspectMode) {
            aspectLens = formatAspectLensForModel(
              arch,
              clickedAspect,
              birthChart,
            );
          } else if (chartMode || chartAnalysisMode) {
            architectureBlock = formatArchitectureForAI(arch);
          }
        }
      } catch (archErr) {
        console.warn("[CHAT] architecture build failed:", archErr.message);
      }

      // Web and architecture dumps only when the user asked about the chart itself.
      let webInterpretations = "";
      if (chartMode && route.outsideResearch) {
        // Check if web interpretations are already cached in the birth chart
        if (
          birthChart.webInterpretations &&
          birthChart.webInterpretations.length > 0
        ) {
          console.log("[CHAT] Using cached web interpretations");
          webInterpretations = birthChart.webInterpretations;
        } else {
          try {
            console.log(
              "[CHAT] Gathering supplemental web notes because the user asked for outside research...",
            );
            webInterpretations =
              await gatherChartInterpretationsFromWeb(birthChart);
            console.log(
              "[CHAT] Web interpretations length:",
              webInterpretations.length,
            );
            // Cache the web interpretations in the birth chart object for future use
            // Note: This won't persist across requests, but will help within a session
            birthChart.webInterpretations = webInterpretations;
          } catch (err) {
            console.warn(
              "[CHAT] Web gathering failed, continuing with chart facts only:",
              err.message,
            );
          }
        }
      } else {
        console.log(
          "[CHAT] Skipping web interpretations - user doesn't want full chart interpretation",
        );
      }

      let chartFactsOnly;
      try {
        chartFactsOnly = formatBirthChartForChatGPT(readingChart);
      } catch (formatErr) {
        console.error(
          "[CHAT] formatBirthChartForChatGPT failed:",
          formatErr.message,
          formatErr.stack,
        );
        chartFactsOnly =
          "Chart data (summary): " +
          (birthChart.birthData
            ? `Date: ${birthChart.birthData.date} ${birthChart.birthData.time}`
            : "unknown") +
          ". " +
          (birthChart.planets
            ? `Planets: ${Object.entries(birthChart.planets)
                .map(([p, d]) => `${p} in ${d.sign || "?"}`)
                .join("; ")}`
            : "");
      }
      stage = "after-chart-facts";
      const maxWebLen = 12000;
      const webBlock =
        webInterpretations && webInterpretations.length > maxWebLen
          ? webInterpretations.slice(0, maxWebLen) +
            "\n[... truncated for length ...]"
          : webInterpretations || "";
      const webSection = webInterpretations
        ? "--- WEB-SOURCED INTERPRETATIONS (supplemental only; chart facts and curated knowledge stay primary) ---\n" +
          webBlock +
          "\n--- END WEB INTERPRETATIONS ---"
        : "--- No web interpretations were retrieved. Use CHART FACTS, the architecture, and any curated knowledge in this prompt. Call search_astrology_info only if the user explicitly asks for outside research. ---";

      // Log so we can confirm chart data is being sent (Astrology API data is in chartFactsOnly)
      console.log(
        "[CHAT] Chart facts length:",
        (chartFactsOnly || "").length,
        "chars; birthData present:",
        !!birthChart?.birthData,
      );

      // Preselected evidence for this question. It is context, not a reply outline.
      let prioritizedBlock = "";
      if (chartMode) {
        try {
          const { prioritizedBlock: block } = getPrioritizedChartPoints(
            readingChart,
            message,
            readingChart.currentTransits || null,
          );
          prioritizedBlock = block;
        } catch (err) {
          console.warn("[CHAT] getPrioritizedChartPoints failed:", err.message);
        }
      }

      const profileMemoryBlock = buildProfileMemoryBlock(profileMemory, {
        chartAnalysisMode,
      });

      // System content is composed from prompt_layers.js (system rules, interpreter rules, response templates, runtime context)
      const systemContent = composeSystemContent({
        profileMemoryBlock,
        architectureBlock,
        thesisMode,
        thesisText,
        topicMode,
        chartAnalysisMode,
        topic,
        topicLens,
        aspectMode,
        aspectLens,
        prioritizedBlock: prioritizedBlock || "",
        chartFactsOnly,
        webSection: thesisMode
          ? "Do not use web sources this turn. Stay with the thesis."
          : chartAnalysisMode
            ? "Do not use web sources this turn. Stay with computed architecture and chart facts."
          : topicMode || aspectMode
            ? "Web is color only this turn. Do not build the answer from blogs."
            : webSection,
        hasPrioritized:
          !!prioritizedBlock &&
          !thesisMode &&
          !topicMode &&
          !aspectMode &&
          !chartAnalysisMode,
        preferredMode:
          profileMemory && profileMemory.preferredMode === "advanced"
            ? "advanced"
            : "beginner",
        sensitivityFlags:
          profileMemory && Array.isArray(profileMemory.sensitivityFlags)
            ? profileMemory.sensitivityFlags
            : [],
        chartSummary:
          chartSummary && typeof chartSummary === "object"
            ? chartSummary
            : null,
        unknownBirthTime: !!(birthChart && birthChart.unknownBirthTime),
        chartSystem,
        readingConfig,
        predictionMode: isPredictionQuestion(message),
        question: questionForMode,
        structures: knowledgeStructures,
        chartAnalysisProgression,
      });

      const advancedMode =
        profileMemory && profileMemory.preferredMode === "advanced";
      const userContent = chartAnalysisMode
        ? message
        : thesisMode
        ? message +
          (advancedMode
            ? "\n\n[Expert synthesis. Analyze how architecture factors interact. Use precise terms and geometry. Do not define standard vocabulary. Do not paste internal claims. No pedagogical filler.]"
            : "\n\n[This is a general question about the person, not about the chart. Do not search the web. Do not name planets, houses, signs, or aspects. Internal claims are constraints only—write the whole reply in everyday conversational language. Do not paste or echo those claims.]")
        : topicMode
          ? message +
            (advancedMode
              ? "\n\n[Expert life-area cut. Stay on this topic. Analyze house, ruler, dignity, reception, and conditioning aspects. Show hierarchy and the interpretive chain. Do not define terms. Do not tour the whole chart.]"
              : "\n\n[This is a life-area question. Answer that area in everyday language. Re-anchor to the internal claims, then stay on this topic. Do not name planets, houses, or aspects unless the user already did. Do not reprint the portrait. Do not tour the whole chart.]")
          : aspectMode
            ? message +
              (advancedMode
                ? "\n\n[Expert aspect cut. Cite type, orb, applying/separating, dignity, houses, rulerships, and any configuration. Show why the contact ranks as it does. Do not define “square” or convert it into an intro metaphor.]"
                : "\n\n[This is a clicked aspect. Answer that connection. Re-anchor to the internal claims, then stay with these two needs. Do not reprint the portrait. Do not tour the whole chart.]")
            : message;
      const messages = buildGenerationMessages(
        systemContent,
        priorConversation,
        userContent,
      );

      stage = "before-openai";
      const functions = getFunctionDefinitions();
      let completion;
      let usedExternalResources = false;
      let memoryUpdate = null;
      let chartSummaryUpdate = null;

      try {
        const createArgs = {
          model: "gpt-4o",
          messages: messages,
          temperature: 0.7,
          max_tokens: thesisMode ? 700 : chartAnalysisMode ? 1200 : 1000,
          presence_penalty: 0.1,
          frequency_penalty: 0.0,
        };
        if (!thesisMode) {
          createArgs.functions = functions;
          createArgs.function_call = "auto";
        }
        completion = await openai.chat.completions.create(createArgs);
      } catch (openaiErr) {
        throw wrapOpenAIError(openaiErr);
      }

      let completionPlain;
      try {
        completionPlain = JSON.parse(JSON.stringify(completion));
      } catch (_) {
        completionPlain = completion;
      }
      const messageResponse = completionPlain.choices[0].message;
      const functionCall = messageResponse.function_call;
      const hasFunctionCall = functionCall && functionCall.name;

      if (hasFunctionCall) {
        usedExternalResources = true;
        const functionName = functionCall.name;
        let functionArgs = {};
        try {
          functionArgs = JSON.parse(functionCall.arguments || "{}");
        } catch (parseError) {
          console.error("[CHAT] Error parsing function arguments:", parseError);
        }

        if (functionName === "update_profile_memory") {
          memoryUpdate = functionArgs;
        }
        if (functionName === "save_chart_summary") {
          chartSummaryUpdate = functionArgs;
        }

        let functionResult;
        try {
          functionResult = await executeFunction(functionName, functionArgs);
        } catch (execError) {
          console.error(
            "[CHAT] Error executing " + functionName + ":",
            execError,
          );
          functionResult = { error: String(execError.message) };
        }

        messages.push({
          role: "assistant",
          content: "",
          function_call: functionCall,
        });
        messages.push({
          role: "function",
          name: functionName,
          content: JSON.stringify(functionResult),
        });

        // Second call: now that we have real function results in the context,
        // force a plain natural-language response (no more tool calls).
        completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: messages,
          temperature: 0.7,
          max_tokens: 1400,
          presence_penalty: 0.1,
          frequency_penalty: 0.0,
        });
      }

      stage = "after-openai";
      let completionFinal;
      try {
        completionFinal = JSON.parse(JSON.stringify(completion));
      } catch (_) {
        completionFinal = completion;
      }
      const rawContent = completionFinal.choices[0].message.content;
      let finalResponse = rawContent != null ? String(rawContent) : "";

      console.log("[CHAT] Sending response:", {
        responseLength: finalResponse.length,
        usedExternalResources: usedExternalResources,
        messagePreview: message.substring(0, 50),
      });

      let followUpSuggestions = [];
      try {
        followUpSuggestions = await generateFollowUpSuggestionsLLM(openai, {
          userMessage: message,
          assistantResponse: finalResponse,
          birthChart,
          chartSummary,
          conversationHistory,
          isGeneralQuestion: false,
          preferredMode:
            profileMemory && profileMemory.preferredMode === "advanced"
              ? "advanced"
              : "beginner",
          lastMode: thesisMode
            ? "portrait"
            : topicMode
              ? "topic"
              : aspectMode
                ? "aspect"
                : chartAnalysisMode
                  ? "chart_analysis"
                  : chartMode
                    ? "chart"
                    : "portrait",
        });
      } catch (fuErr) {
        console.warn(
          "[CHAT] Follow-up suggestions (chart reply) failed:",
          fuErr.message,
        );
      }

      return res.json({
        response: String(finalResponse),
        followUpSuggestions,
        followUpQuestion: followUpSuggestions[0] || null,
        ...(memoryUpdate != null && Object.keys(memoryUpdate).length > 0
          ? { memoryUpdate }
          : {}),
        ...(chartSummaryUpdate != null &&
        Object.keys(chartSummaryUpdate).length > 0
          ? { chartSummaryUpdate }
          : {}),
      });
    } catch (error) {
      if (isOpenAIQuotaOrBillingError(error)) {
        return sendLocalChatFallback(res, fallbackPayloadFromReq(req));
      }
      send500(error);
    }
  })().catch((err) => {
    if (isOpenAIQuotaOrBillingError(err)) {
      return sendLocalChatFallback(res, fallbackPayloadFromReq(req));
    }
    send500(err);
  });
}); // handler returns promise so .catch(send500) handles async rejections

// Debug: run chat flow without OpenAI to find "Assignment to constant variable"
app.get("/api/chat-debug", async (req, res) => {
  try {
    const birthChart = req.body?.birthChart || {
      birthData: {
        date: "1990-01-01",
        time: "12:00",
        location: { latitude: 40, longitude: -74, timezone: -5 },
      },
      angles: {
        ascendant: { sign: "Leo", degree: 10, element: "Fire" },
        midheaven: { sign: "Taurus", degree: 5, element: "Earth" },
      },
      planets: {
        sun: { sign: "Capricorn", degree: 25, element: "Earth", house: 10 },
        moon: { sign: "Cancer", degree: 12, element: "Water", house: 4 },
      },
      houses: [],
      aspects: [],
    };
    const message = "hello";
    const webInterpretations = "";
    let chartFactsOnly;
    try {
      chartFactsOnly = formatBirthChartForChatGPT(birthChart);
    } catch (e) {
      chartFactsOnly = "chart summary";
    }
    const maxWebLen = 12000;
    const webBlock =
      webInterpretations && webInterpretations.length > maxWebLen
        ? webInterpretations.slice(0, maxWebLen) + "\n[...]"
        : webInterpretations || "";
    const webSection = webInterpretations
      ? "--- WEB ---\n" + webBlock + "\n---"
      : "--- No web ---";
    const systemContent =
      "You are AstroGuide.\n\n--- CHART ---\n" +
      chartFactsOnly +
      "\n---\n\n" +
      webSection;
    const messages = [
      { role: "system", content: systemContent },
      { role: "user", content: message },
    ];
    return res.json({
      ok: true,
      systemContentLength: systemContent.length,
      messagesCount: messages.length,
    });
  } catch (err) {
    console.error("[CHAT-DEBUG] Error:", err);
    return res
      .status(500)
      .json({
        error: err.message,
        stack: (err.stack || "").split("\n").slice(0, 12),
      });
  }
});

// Add a test endpoint
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend server is running" });
});

// Diagnostic endpoint to test general question detection
app.post("/api/test-general-question", (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message required" });
  }

  const lowerMessage = message.toLowerCase().trim();
  const isGeneralQuestionPattern =
    (lowerMessage.includes("what does") ||
      lowerMessage.includes("tell me about") ||
      lowerMessage.includes("explain") ||
      lowerMessage.includes("what is") ||
      lowerMessage.includes("what are")) &&
    (lowerMessage.match(
      /\b(venus|sun|moon|mercury|mars|jupiter|saturn|uranus|neptune|pluto)\b/i,
    ) ||
      lowerMessage.match(
        /\b(scorpio|aries|taurus|gemini|cancer|leo|virgo|libra|sagittarius|capricorn|aquarius|pisces)\b/i,
      )) &&
    !lowerMessage.includes("my ") &&
    !lowerMessage.includes("my chart") &&
    !lowerMessage.includes("my birth") &&
    !lowerMessage.includes("my venus") &&
    !lowerMessage.includes("my sun") &&
    !lowerMessage.includes("my moon");

  return res.json({
    message: message,
    isGeneralQuestion: isGeneralQuestionPattern,
    analysis: {
      hasQuestionWords:
        lowerMessage.includes("what does") ||
        lowerMessage.includes("tell me about") ||
        lowerMessage.includes("explain"),
      hasPlanet: !!lowerMessage.match(
        /\b(venus|sun|moon|mercury|mars|jupiter|saturn|uranus|neptune|pluto)\b/i,
      ),
      hasSign: !!lowerMessage.match(
        /\b(scorpio|aries|taurus|gemini|cancer|leo|virgo|libra|sagittarius|capricorn|aquarius|pisces)\b/i,
      ),
      hasMy: lowerMessage.includes("my "),
    },
  });
});

// Static frontend after all /api routes so API handlers always run first
app.use(
  express.static(path.join(__dirname, "../frontend"), {
    etag: false,
    lastModified: false,
    setHeaders(res, filePath) {
      if (/\.html?$/i.test(filePath)) {
        res.setHeader("Cache-Control", "no-store");
      }
    },
  }),
);

// Catch-all error handler so 500s are logged and returned safely
app.use((err, req, res, next) => {
  console.error("\n*** 500 ERROR (global handler) ***", err.message);
  console.error("*** Stack:\n", err.stack);
  if (!res.headersSent) {
    const stackLines = (err.stack || "").split("\n").slice(0, 15);
    res.status(500).json({
      error: "Server error",
      details: err.message,
      stage: err.stage || null,
      stack: err.stack || undefined,
      stackPreview: stackLines,
      _debug: "global-handler",
    });
  }
});

// Listen on default host so both IPv4 (LAN, 127.0.0.1) and IPv6 (::1 “localhost”) hit this app.
// (Binding only 0.0.0.0 can leave some PC browsers connecting to localhost via IPv6 without a listener.)
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(
    `Same machine: try http://127.0.0.1:${port} if localhost misbehaves. Phone (same Wi‑Fi): http://<this-PC-LAN-IP>:${port}`,
  );
  console.log("Available endpoints:");
  console.log("- POST /api/login");
  console.log("- POST /api/signup");
  console.log("- POST /api/birth-chart");
  console.log("- POST /api/chat");
  console.log("- GET /api/test");
});
