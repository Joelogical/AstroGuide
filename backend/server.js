const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
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
  composeSystemContent,
} = require("./prompt_layers");
const { generateFollowUpSuggestionsLLM } = require("./followup_suggestions");

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

// AstrologyAPI.com credentials
const USER_ID = process.env.ASTROLOGY_API_USER_ID;
const API_KEY = process.env.ASTROLOGY_API_KEY;

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

// Function to generate AstrologyAPI.com authentication
function generateAuth() {
  // Create base64 encoded credentials
  const credentials = Buffer.from(`${USER_ID}:${API_KEY}`).toString("base64");

  // Debug logging for authentication
  console.log("Generated Auth Header:", {
    userId: USER_ID,
    credentialsLength: credentials.length,
  });

  return {
    Authorization: `Basic ${credentials}`,
    "Content-Type": "application/json",
  };
}

// Function to calculate aspects between planets (major + minor for depth)
function calculateAspects(planets) {
  const aspects = [];
  // Major aspects (wider orbs)
  const major = {
    conjunction: { angle: 0, orb: 8 },
    sextile: { angle: 60, orb: 6 },
    square: { angle: 90, orb: 8 },
    trine: { angle: 120, orb: 8 },
    opposition: { angle: 180, orb: 8 },
  };
  // Minor aspects (tighter orbs; add nuance, don't overwhelm)
  const minor = {
    semisextile: { angle: 30, orb: 2.5 },
    semisquare: { angle: 45, orb: 2 },
    sesquiquadrate: { angle: 135, orb: 2 },
    quincunx: { angle: 150, orb: 2.5 },
  };
  const aspectOrbs = { ...major, ...minor };

  const planetNames = Object.keys(planets);

  for (let i = 0; i < planetNames.length; i++) {
    for (let j = i + 1; j < planetNames.length; j++) {
      const planet1 = planetNames[i];
      const planet2 = planetNames[j];
      const angle1 = planets[planet1];
      const angle2 = planets[planet2];

      let angle = Math.abs(angle1 - angle2);
      if (angle > 180) {
        angle = 360 - angle;
      }

      for (const [aspectName, { angle: targetAngle, orb }] of Object.entries(
        aspectOrbs,
      )) {
        if (Math.abs(angle - targetAngle) <= orb) {
          aspects.push({
            planet1,
            planet2,
            aspect: aspectName,
            angle: Math.abs(angle1 - angle2),
            orb: Math.abs(angle - targetAngle),
          });
          break; // one aspect per pair (closest match if multiple)
        }
      }
    }
  }

  return aspects;
}

// Calculate birth chart endpoint using AstrologyAPI.com
app.post("/api/birth-chart", async (req, res) => {
  console.log(
    "Received birth chart request body:",
    JSON.stringify(req.body, null, 2),
  );

  try {
    const { year, month, day, hour, minute, latitude, longitude, timezone } =
      req.body;

    // Log parsed values with validation
    const parsedYear = typeof year === "string" ? parseInt(year) : year;
    const parsedMonth = typeof month === "string" ? parseInt(month) : month;
    const parsedDay = typeof day === "string" ? parseInt(day) : day;
    const parsedHour = typeof hour === "string" ? parseInt(hour) : hour;
    const parsedMinute = typeof minute === "string" ? parseInt(minute) : minute;
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
    console.log("Sending to AstrologyAPI.com:", {
      day: parseInt(day),
      month: parseInt(month),
      year: parseInt(year),
      hour: parseInt(hour),
      min: parseInt(minute),
      lat: parseFloat(latitude),
      lon: parseFloat(longitude),
      tzone: parseFloat(timezone || 0),
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

    // Validate required fields
    if (
      !year ||
      !month ||
      !day ||
      hour === undefined ||
      minute === undefined ||
      !latitude ||
      !longitude
    ) {
      console.log("Missing or invalid fields:", {
        year: !year,
        month: !month,
        day: !day,
        hour: hour === undefined,
        minute: minute === undefined,
        latitude: !latitude,
        longitude: !longitude,
      });
      return res.status(400).json({
        error: "Missing required fields",
        details: "Please provide all required birth data",
        received: req.body,
      });
    }

    // Make API request to AstrologyAPI.com
    console.log("Making API request to AstrologyAPI.com...");
    try {
      // First, get planetary positions using the tropical endpoint
      const planetsResponse = await axios.post(
        "https://json.astrologyapi.com/v1/planets/tropical",
        {
          day: parseInt(day),
          month: parseInt(month),
          year: parseInt(year),
          hour: parseInt(hour),
          min: parseInt(minute),
          lat: parseFloat(latitude),
          lon: parseFloat(longitude),
          tzone: parseFloat(timezone || 0),
        },
        {
          headers: generateAuth(),
        },
      );

      // Then, get house positions using the tropical endpoint
      // Note: AstrologyAPI.com defaults to Placidus house system if not specified
      // To use a different system, add 'house_system' parameter (e.g., 'placidus', 'koch', 'equal', 'whole_signs')
      const housesResponse = await axios.post(
        "https://json.astrologyapi.com/v1/house_cusps/tropical",
        {
          day: parseInt(day),
          month: parseInt(month),
          year: parseInt(year),
          hour: parseInt(hour),
          min: parseInt(minute),
          lat: parseFloat(latitude),
          lon: parseFloat(longitude),
          tzone: parseFloat(timezone || 0),
          house_system: "placidus", // Explicitly specify Placidus (default, but being explicit)
        },
        {
          headers: generateAuth(),
        },
      );

      console.log(
        "Planets API Response:",
        JSON.stringify(planetsResponse.data, null, 2),
      );
      console.log(
        "Houses API Response:",
        JSON.stringify(housesResponse.data, null, 2),
      );

      // Check if API returned an error instead of data
      if (
        planetsResponse.data.status === false ||
        !Array.isArray(planetsResponse.data)
      ) {
        throw new Error(
          `AstrologyAPI.com error: ${
            planetsResponse.data.msg ||
            "Invalid API credentials. Please set ASTROLOGY_API_USER_ID and ASTROLOGY_API_KEY in your .env file."
          }`,
        );
      }

      if (housesResponse.data.status === false) {
        throw new Error(
          `AstrologyAPI.com error: ${
            housesResponse.data.msg || "Invalid API credentials"
          }`,
        );
      }

      // Transform the API responses to match our expected format
      const birthChart = {
        // Basic birth data
        birthData: {
          date: `${year}-${month}-${day}`,
          time: `${hour}:${minute}`,
          location: {
            latitude,
            longitude,
            timezone,
          },
        },
        // Angular points
        angles: {
          ascendant: {
            degree: housesResponse.data.ascendant || 0,
            sign:
              planetsResponse.data.find((p) => p.name === "Ascendant")?.sign ||
              "Unknown",
            element: getElementFromSign(
              planetsResponse.data.find((p) => p.name === "Ascendant")?.sign,
            ),
          },
          midheaven: {
            degree: housesResponse.data.midheaven || 0,
            sign: getSignFromDegree(housesResponse.data.midheaven),
            element: getElementFromSign(
              getSignFromDegree(housesResponse.data.midheaven),
            ),
          },
        },
        // Planetary positions with additional data
        planets: Object.fromEntries(
          [
            "Sun",
            "Moon",
            "Mercury",
            "Venus",
            "Mars",
            "Jupiter",
            "Saturn",
            "Uranus",
            "Neptune",
            "Pluto",
          ].map((planet) => {
            const planetData = planetsResponse.data.find(
              (p) => p.name === planet,
            );
            return [
              planet.toLowerCase(),
              {
                degree: planetData?.fullDegree || 0,
                sign: planetData?.sign || "Unknown",
                element: getElementFromSign(planetData?.sign),
                house: planetData?.house || 0,
                isRetrograde: planetData?.isRetro === "true",
                speed: planetData?.speed || 0,
              },
            ];
          }),
        ),
        // House cusps with signs and elements
        houses: housesResponse.data.houses.map((house, index) => ({
          number: index + 1,
          degree: house.degree,
          sign: house.sign,
          element: getElementFromSign(house.sign),
        })),
        // Aspects with additional data
        aspects: calculateAspects({
          sun:
            planetsResponse.data.find((p) => p.name === "Sun")?.fullDegree || 0,
          moon:
            planetsResponse.data.find((p) => p.name === "Moon")?.fullDegree ||
            0,
          mercury:
            planetsResponse.data.find((p) => p.name === "Mercury")
              ?.fullDegree || 0,
          venus:
            planetsResponse.data.find((p) => p.name === "Venus")?.fullDegree ||
            0,
          mars:
            planetsResponse.data.find((p) => p.name === "Mars")?.fullDegree ||
            0,
          jupiter:
            planetsResponse.data.find((p) => p.name === "Jupiter")
              ?.fullDegree || 0,
          saturn:
            planetsResponse.data.find((p) => p.name === "Saturn")?.fullDegree ||
            0,
          uranus:
            planetsResponse.data.find((p) => p.name === "Uranus")?.fullDegree ||
            0,
          neptune:
            planetsResponse.data.find((p) => p.name === "Neptune")
              ?.fullDegree || 0,
          pluto:
            planetsResponse.data.find((p) => p.name === "Pluto")?.fullDegree ||
            0,
        }).map((aspect) => ({
          ...aspect,
          planet1Sign: planetsResponse.data.find(
            (p) =>
              p.name ===
              aspect.planet1.charAt(0).toUpperCase() + aspect.planet1.slice(1),
          )?.sign,
          planet2Sign: planetsResponse.data.find(
            (p) =>
              p.name ===
              aspect.planet2.charAt(0).toUpperCase() + aspect.planet2.slice(1),
          )?.sign,
          planet1Element: getElementFromSign(
            planetsResponse.data.find(
              (p) =>
                p.name ===
                aspect.planet1.charAt(0).toUpperCase() +
                  aspect.planet1.slice(1),
            )?.sign,
          ),
          planet2Element: getElementFromSign(
            planetsResponse.data.find(
              (p) =>
                p.name ===
                aspect.planet2.charAt(0).toUpperCase() +
                  aspect.planet2.slice(1),
            )?.sign,
          ),
        })),
      };

      // Helper function to get element from sign
      function getElementFromSign(sign) {
        const elements = {
          Aries: "Fire",
          Leo: "Fire",
          Sagittarius: "Fire",
          Taurus: "Earth",
          Virgo: "Earth",
          Capricorn: "Earth",
          Gemini: "Air",
          Libra: "Air",
          Aquarius: "Air",
          Cancer: "Water",
          Scorpio: "Water",
          Pisces: "Water",
        };
        return elements[sign] || "Unknown";
      }

      // Helper function to get sign from degree
      function getSignFromDegree(degree) {
        const signs = [
          { name: "Aries", start: 0, end: 30 },
          { name: "Taurus", start: 30, end: 60 },
          { name: "Gemini", start: 60, end: 90 },
          { name: "Cancer", start: 90, end: 120 },
          { name: "Leo", start: 120, end: 150 },
          { name: "Virgo", start: 150, end: 180 },
          { name: "Libra", start: 180, end: 210 },
          { name: "Scorpio", start: 210, end: 240 },
          { name: "Sagittarius", start: 240, end: 270 },
          { name: "Capricorn", start: 270, end: 300 },
          { name: "Aquarius", start: 300, end: 330 },
          { name: "Pisces", start: 330, end: 360 },
        ];
        const normalizedDegree = ((degree % 360) + 360) % 360;
        const sign = signs.find(
          (s) => normalizedDegree >= s.start && normalizedDegree < s.end,
        );
        return sign ? sign.name : "Unknown";
      }

      // Log the raw API responses for debugging
      console.log("Raw Planets Response:", planetsResponse.data);
      console.log("Raw Houses Response:", housesResponse.data);
      console.log(
        "Transformed birth chart:",
        JSON.stringify(birthChart, null, 2),
      );

      // Generate deterministic interpretation using hardcoded rules
      const deterministicInterpretation =
        generateChartInterpretation(birthChart);
      const interpretationTemplate = formatInterpretationForAI(
        deterministicInterpretation,
        birthChart,
      );

      // Add deterministic interpretation to the response
      const response = {
        ...birthChart,
        deterministicInterpretation: deterministicInterpretation,
        interpretationTemplate: interpretationTemplate,
        // Keep raw interpretation field for backward compatibility, but use deterministic template
        interpretation: interpretationTemplate,
      };

      // Return the transformed API response
      return res.json(response);
    } catch (apiError) {
      // Log the full error details
      console.error("Full API Error:", apiError);
      console.error("API Error Response:", apiError.response?.data);
      console.error("API Error Status:", apiError.response?.status);
      console.error("API Error Headers:", apiError.response?.headers);
      console.error("API Request Details:", {
        url: "https://json.astrologyapi.com/v1/planets/tropical",
        body: {
          day: parseInt(day),
          month: parseInt(month),
          year: parseInt(year),
          hour: parseInt(hour),
          min: parseInt(minute),
          lat: parseFloat(latitude),
          lon: parseFloat(longitude),
          tzone: parseFloat(timezone || 0),
        },
      });

      // Return a more detailed error response
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
        apiError: {
          status: apiError.response?.status,
          data: apiError.response?.data,
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
      stage = "after-body";

      if (!message || !birthChart) {
        return res.status(400).json({
          error: "Missing required fields",
          details: "Please provide both a message and birth chart data",
        });
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

      // Generate deterministic interpretation if not already present (needed for system prompt)
      let interpretationTemplate;
      if (birthChart.interpretationTemplate) {
        interpretationTemplate = birthChart.interpretationTemplate;
      } else if (birthChart.deterministicInterpretation) {
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

      // Note: General question check already happened above at the start of the function
      // If we reach here, it's not a general question, so process as chart question

      // Check if this is a factual question that can be answered deterministically
      if (isFactualQuestion(message)) {
        const factualAnswer = answerFactualQuestion(message, birthChart);
        if (factualAnswer) {
          console.log("[FACTUAL] Answered factual question deterministically");
          let followUpSuggestions = [];
          try {
            followUpSuggestions = await generateFollowUpSuggestionsLLM(
              openai,
              {
                userMessage: message,
                assistantResponse: factualAnswer,
                birthChart,
                chartSummary,
                conversationHistory,
                isGeneralQuestion: false,
              },
            );
          } catch (fuErr) {
            console.warn(
              "[CHAT] Follow-up suggestions (factual) failed:",
              fuErr.message,
            );
          }
          return res.json({
            response: factualAnswer,
            isFactual: true,
            followUpSuggestions,
            followUpQuestion: followUpSuggestions[0] || null,
          });
        }
        // If it matched a pattern but couldn't answer, fall through to AI
      }

      stage = "after-interpretation";

      // Check if this is a casual message or if user wants chart interpretation
      const isCasual = isCasualMessage(message);
      const wantsInterpretation = wantsChartInterpretation(
        message,
        conversationHistory,
      );

      // For casual messages, use a simpler system prompt that doesn't push chart information
      if (isCasual && !wantsInterpretation) {
        const casualSystemContent =
          "You are AstroGuide. Stay generally neutral and professional; otherwise respond in a natural, helpful way—no fixed persona script.\n\n" +
          "CASUAL MESSAGES:\n" +
          "Match the user's tone loosely (brief if they're brief). Don't volunteer chart interpretations, aspects, or placements unless they ask.\n" +
          "Keep greetings and small talk short. Avoid astrology jargon unless the user uses it first.";

        const messages = [
          {
            role: "system",
            content: casualSystemContent,
          },
        ];

        // Add conversation history
        if (conversationHistory && conversationHistory.length > 0) {
          for (const m of conversationHistory) {
            const content = m.content == null ? "" : String(m.content);
            const msg = { role: m.role, content };
            if (m.role === "function" && m.name) msg.name = m.name;
            if (m.role === "assistant" && m.function_call)
              msg.function_call = m.function_call;
            messages.push(msg);
          }
        }

        // Add current message
        messages.push({
          role: "user",
          content: message,
        });

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
          const wrapped = new Error(
            "[OpenAI create] " + (openaiErr.message || ""),
          );
          wrapped.stack = openaiErr.stack;
          throw wrapped;
        }

        const finalResponse = completion.choices[0].message.content || "";
        return res.json({
          response: String(finalResponse),
          followUpSuggestions: [],
          followUpQuestion: null,
        });
      }

      // PRIMARY SOURCE FOR INTERPRETATION: gather from the web (broad breadth of resources)
      // Hardcoded data is used for chart facts only; web is main for interpretation.
      // ONLY gather web interpretations if user wants chart interpretation (not for simple questions)
      let webInterpretations = "";
      if (wantsInterpretation) {
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
              "[CHAT] Gathering chart interpretations from web (primary source)...",
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
        chartFactsOnly = formatBirthChartForChatGPT(birthChart);
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
        ? "--- WEB-SOURCED INTERPRETATIONS (primary for interpretation) ---\n" +
          webBlock +
          "\n--- END WEB INTERPRETATIONS ---"
        : "--- No web interpretations were available for this chart. You may call search_astrology_info() for specific placements (e.g. 'Sun in Leo interpretation') to get interpretation content. ---";

      // Log so we can confirm chart data is being sent (Astrology API data is in chartFactsOnly)
      console.log(
        "[CHAT] Chart facts length:",
        (chartFactsOnly || "").length,
        "chars; birthData present:",
        !!birthChart?.birthData,
      );

      // Ranking and weighting: pass only highest-value chart points so the model gives 3 reasons, 2 caveats—not 25 scattered facts
      let prioritizedBlock = "";
      if (wantsInterpretation) {
        try {
          const { prioritizedBlock: block } = getPrioritizedChartPoints(
            birthChart,
            message,
            birthChart.currentTransits || null,
          );
          prioritizedBlock = block;
        } catch (err) {
          console.warn("[CHAT] getPrioritizedChartPoints failed:", err.message);
        }
      }

      const profileMemoryBlock = buildProfileMemoryBlock(profileMemory);

      // System content is composed from prompt_layers.js (system rules, interpreter rules, response templates, runtime context)
      const systemContent = composeSystemContent({
        profileMemoryBlock,
        prioritizedBlock: prioritizedBlock || "",
        chartFactsOnly,
        webSection,
        hasPrioritized: !!prioritizedBlock,
        preferredMode:
          profileMemory && profileMemory.preferredMode
            ? profileMemory.preferredMode
            : null,
        chartSummary:
          chartSummary && typeof chartSummary === "object"
            ? chartSummary
            : null,
      });

      const messages = [
        {
          role: "system",
          content: systemContent,
        },
      ];

      // Add conversation history if available (sanitize so content is never null)
      // Skip assistant messages that asked for birth data so the model doesn't repeat that
      if (conversationHistory && conversationHistory.length > 0) {
        for (const m of conversationHistory) {
          const content = m.content == null ? "" : String(m.content);
          const contentLower = content.toLowerCase();
          if (m.role === "assistant") {
            const isAskingForBirthData =
              contentLower.includes("birth date") ||
              contentLower.includes("birth time") ||
              contentLower.includes("birth location") ||
              contentLower.includes("provide me with those details");
            const isChecklistFormat =
              content.includes("###") ||
              /\*\*\s*\d+\./.test(content) ||
              content.includes("**1.") ||
              content.includes("**2.") ||
              content.includes("Let's delve") ||
              content.includes("These aspects offer a glimpse") ||
              content.includes(
                "If you have specific questions, feel free to share",
              );
            if (isAskingForBirthData || isChecklistFormat) continue; // omit so model doesn't repeat checklist style
          }
          const msg = { role: m.role, content };
          if (m.role === "function" && m.name) msg.name = m.name;
          if (m.role === "assistant" && m.function_call)
            msg.function_call = m.function_call;
          messages.push(msg);
        }
      }

      // Add the current message with a format reminder so every turn enforces prose-only and web use (avoids checklist slip on follow-ups)
      // Detect repeated prompts so the model deepens instead of repeating basics (topic-agnostic)
      function isRepeatPrompt(currentMsg, history) {
        const text = String(currentMsg || "").toLowerCase();
        if (text.length < 8) return false;
        const stop = new Set([
          "the",
          "a",
          "an",
          "and",
          "or",
          "but",
          "to",
          "of",
          "in",
          "on",
          "for",
          "with",
          "at",
          "from",
          "by",
          "about",
          "as",
          "is",
          "are",
          "was",
          "were",
          "be",
          "been",
          "being",
          "i",
          "me",
          "my",
          "you",
          "your",
          "we",
          "our",
          "it",
          "this",
          "that",
          "these",
          "those",
          "what",
          "why",
          "how",
          "when",
          "where",
          "tell",
          "explain",
          "please",
        ]);
        function tokens(s) {
          return String(s || "")
            .toLowerCase()
            .replace(/[^a-z0-9\\s]/g, " ")
            .split(/\\s+/)
            .filter((w) => w && w.length > 2 && !stop.has(w));
        }
        function jaccard(a, b) {
          const A = new Set(a);
          const B = new Set(b);
          if (A.size === 0 || B.size === 0) return 0;
          let inter = 0;
          for (const x of A) if (B.has(x)) inter++;
          const union = A.size + B.size - inter;
          return union ? inter / union : 0;
        }
        const curTok = tokens(text);
        const recentUser = (history || [])
          .filter((m) => m && m.role === "user" && m.content)
          .slice(-10);
        for (const m of recentUser) {
          const prev = String(m.content || "").toLowerCase();
          if (!prev) continue;
          if (prev === text) return true;
          if (
            (prev.includes(text) || text.includes(prev)) &&
            Math.min(prev.length, text.length) > 18
          )
            return true;
          const sim = jaccard(curTok, tokens(prev));
          if (sim >= 0.45) return true;
        }
        return false;
      }
      const isRepeatedPrompt = isRepeatPrompt(message, conversationHistory);

      const userContent =
        message +
        (isRepeatedPrompt
          ? "\n\n[NOTE: The user is repeating or re-asking a similar question. Do NOT repeat prior basic explanations. Go deeper: add new angles (rulership chains, dispositors, aspect networks/patterns, dignity/retrograde, dominant planets/houses, repeating themes). Use MORE targeted web searches (search_astrology_info/search_web_astrology) based on the exact wording of this question so the answer adds new insight instead of rephrasing the same content.]"
          : "") +
        "\n\n[Reply in plain paragraphs only—no numbers (1. 2. 3.), no ### or **headers**, no one topic per paragraph. Weave themes together. When interpreting the chart, use web search (search_astrology_info) for placements you discuss so the reply stays varied and non-generic.]";
      messages.push({
        role: "user",
        content: userContent,
      });

      stage = "before-openai";
      const functions = getFunctionDefinitions();
      let completion;
      let usedExternalResources = false;
      let memoryUpdate = null;
      let chartSummaryUpdate = null;

      try {
        completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: messages,
          functions: functions,
          function_call: "auto",
          temperature: 0.7,
          max_tokens: 1000,
          presence_penalty: 0.1,
          frequency_penalty: 0.0,
        });
      } catch (openaiErr) {
        const wrapped = new Error(
          "[OpenAI create] " + (openaiErr.message || ""),
        );
        wrapped.stack = openaiErr.stack;
        throw wrapped;
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
      const finalResponse = rawContent != null ? String(rawContent) : "";

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
      send500(error);
    }
  })().catch(send500);
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
    let webInterpretations = "";
    try {
      webInterpretations = await gatherChartInterpretationsFromWeb(birthChart);
    } catch (e) {
      webInterpretations = "";
    }
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
app.use(express.static(path.join(__dirname, "../frontend")));

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
