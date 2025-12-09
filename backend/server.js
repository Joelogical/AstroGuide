const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
require("dotenv").config();
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

// Debug logging for environment variables
console.log("Environment variables loaded:");
console.log(
  "ASTROLOGY_API_USER_ID:",
  process.env.ASTROLOGY_API_USER_ID ? "Present" : "Missing"
);
console.log(
  "ASTROLOGY_API_KEY:",
  process.env.ASTROLOGY_API_KEY ? "Present" : "Missing"
);
console.log(
  "OPENAI_API_KEY:",
  process.env.OPENAI_API_KEY ? "Present" : "Missing"
);

const app = express();
const port = process.env.PORT || 3000;

// AstrologyAPI.com credentials
const USER_ID = process.env.ASTROLOGY_API_USER_ID;
const API_KEY = process.env.ASTROLOGY_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the frontend directory
app.use(express.static(path.join(__dirname, "../frontend")));

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
  console.log("Login request received:", req.body);
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Email and password are required",
    });
  }

  const user = users.get(email);
  if (!user || user.password !== password) {
    return res.status(401).json({
      success: false,
      error: "Invalid email or password",
      token: null,
    });
  }

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
});

// Signup endpoint
app.post("/api/signup", (req, res) => {
  console.log("Signup request received:", req.body);
  const { email, password, name, birthDate, birthTime, birthPlace } = req.body;

  if (!email || !password || !name || !birthDate || !birthTime || !birthPlace) {
    return res.status(400).json({
      success: false,
      error: "All fields are required",
    });
  }

  if (users.has(email)) {
    return res.status(409).json({
      success: false,
      error: "User already exists",
    });
  }

  const user = {
    email,
    password,
    name,
    birthDate,
    birthTime,
    birthPlace,
  };

  users.set(email, user);

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

// Function to calculate aspects between planets
function calculateAspects(planets) {
  const aspects = [];
  const aspectOrbs = {
    conjunction: 8, // 0° ± 8°
    sextile: 6, // 60° ± 6°
    square: 8, // 90° ± 8°
    trine: 8, // 120° ± 8°
    opposition: 8, // 180° ± 8°
  };

  const planetNames = Object.keys(planets);

  for (let i = 0; i < planetNames.length; i++) {
    for (let j = i + 1; j < planetNames.length; j++) {
      const planet1 = planetNames[i];
      const planet2 = planetNames[j];
      const angle1 = planets[planet1];
      const angle2 = planets[planet2];

      // Calculate the angle between planets
      let angle = Math.abs(angle1 - angle2);
      if (angle > 180) {
        angle = 360 - angle;
      }

      // Check for each aspect type
      for (const [aspect, orb] of Object.entries(aspectOrbs)) {
        const targetAngle =
          aspect === "conjunction"
            ? 0
            : aspect === "sextile"
            ? 60
            : aspect === "square"
            ? 90
            : aspect === "trine"
            ? 120
            : aspect === "opposition"
            ? 180
            : 0;

        if (Math.abs(angle - targetAngle) <= orb) {
          aspects.push({
            planet1,
            planet2,
            aspect,
            angle: Math.abs(angle1 - angle2),
            orb: Math.abs(angle - targetAngle),
          });
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
    JSON.stringify(req.body, null, 2)
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
        }
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
        }
      );

      console.log(
        "Planets API Response:",
        JSON.stringify(planetsResponse.data, null, 2)
      );
      console.log(
        "Houses API Response:",
        JSON.stringify(housesResponse.data, null, 2)
      );

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
              planetsResponse.data.find((p) => p.name === "Ascendant")?.sign
            ),
          },
          midheaven: {
            degree: housesResponse.data.midheaven || 0,
            sign: getSignFromDegree(housesResponse.data.midheaven),
            element: getElementFromSign(
              getSignFromDegree(housesResponse.data.midheaven)
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
              (p) => p.name === planet
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
          })
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
              aspect.planet1.charAt(0).toUpperCase() + aspect.planet1.slice(1)
          )?.sign,
          planet2Sign: planetsResponse.data.find(
            (p) =>
              p.name ===
              aspect.planet2.charAt(0).toUpperCase() + aspect.planet2.slice(1)
          )?.sign,
          planet1Element: getElementFromSign(
            planetsResponse.data.find(
              (p) =>
                p.name ===
                aspect.planet1.charAt(0).toUpperCase() + aspect.planet1.slice(1)
            )?.sign
          ),
          planet2Element: getElementFromSign(
            planetsResponse.data.find(
              (p) =>
                p.name ===
                aspect.planet2.charAt(0).toUpperCase() + aspect.planet2.slice(1)
            )?.sign
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
          (s) => normalizedDegree >= s.start && normalizedDegree < s.end
        );
        return sign ? sign.name : "Unknown";
      }

      // Log the raw API responses for debugging
      console.log("Raw Planets Response:", planetsResponse.data);
      console.log("Raw Houses Response:", housesResponse.data);
      console.log(
        "Transformed birth chart:",
        JSON.stringify(birthChart, null, 2)
      );

      // Generate deterministic interpretation using hardcoded rules
      const deterministicInterpretation =
        generateChartInterpretation(birthChart);
      const interpretationTemplate = formatInterpretationForAI(
        deterministicInterpretation,
        birthChart
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
 * Generate contextually relevant follow-up question based on user's message and response
 * @param {string} userMessage - The user's original message
 * @param {string} aiResponse - The AI's response
 * @param {object} birthChart - The birth chart data
 * @returns {string|null} Follow-up question (null if not needed)
 */
function generateFollowUpQuestion(userMessage, aiResponse, birthChart) {
  const message = userMessage.toLowerCase();
  const response = aiResponse.toLowerCase();

  console.log("[FOLLOWUP] Generating follow-up for:", {
    userMessage: userMessage.substring(0, 50),
    responseLength: aiResponse.length,
    messageLength: message.length,
  });

  // Don't generate follow-up for very short responses or simple acknowledgments
  // But be more lenient - if it's a substantial question, always provide a follow-up
  const isSubstantialQuestion =
    message.length > 20 &&
    (message.includes("tell me") ||
      message.includes("what") ||
      message.includes("how") ||
      message.includes("why") ||
      message.includes("explain") ||
      message.includes("describe") ||
      message.includes("about") ||
      message.includes("myself") ||
      message.includes("about me"));

  console.log("[FOLLOWUP] Is substantial question:", isSubstantialQuestion);

  // For substantial questions, always provide a follow-up (be more lenient)
  // NEVER return null early for substantial questions - let the safety nets handle it
  if (!isSubstantialQuestion && aiResponse.length < 100) {
    // For non-substantial questions, require longer responses
    console.log("[FOLLOWUP] Skipping - response too short and not substantial");
    return null;
  }

  // For substantial questions, continue even if response is short (safety nets will handle it)
  if (isSubstantialQuestion && aiResponse.length < 30) {
    console.log(
      "[FOLLOWUP] Warning - substantial question but response extremely short, will use safety net"
    );
    // Don't return null - let the safety nets generate a question
  }

  // Don't generate follow-up if user's message was very short (like "thanks" or "ok")
  if (message.length < 10) {
    return null;
  }

  // Don't generate follow-up for simple yes/no responses or acknowledgments
  const shortResponses = [
    "thanks",
    "thank you",
    "ok",
    "okay",
    "got it",
    "i see",
    "cool",
    "nice",
  ];
  if (
    shortResponses.some(
      (short) => message === short || message.startsWith(short + " ")
    )
  ) {
    return null;
  }

  // Extract topic keywords from user message with more specific patterns
  const topicKeywords = {
    sun: [
      "sun",
      "identity",
      "ego",
      "self",
      "who am i",
      "personality",
      "tell me about myself",
      "about me",
      "who i am",
    ],
    moon: ["moon", "emotion", "feeling", "mood", "nurturing", "mother"],
    mercury: [
      "mercury",
      "communication",
      "thinking",
      "mind",
      "intellect",
      "learning",
    ],
    venus: [
      "venus",
      "love",
      "relationship",
      "romance",
      "beauty",
      "values",
      "attraction",
    ],
    mars: ["mars", "action", "drive", "passion", "anger", "aggression", "sex"],
    jupiter: [
      "jupiter",
      "luck",
      "expansion",
      "philosophy",
      "growth",
      "optimism",
    ],
    saturn: [
      "saturn",
      "discipline",
      "responsibility",
      "challenge",
      "limitation",
      "structure",
    ],
    uranus: [
      "uranus",
      "change",
      "innovation",
      "rebellion",
      "freedom",
      "unpredictable",
    ],
    neptune: [
      "neptune",
      "dream",
      "illusion",
      "spirituality",
      "creativity",
      "confusion",
    ],
    pluto: [
      "pluto",
      "transformation",
      "power",
      "intensity",
      "control",
      "obsession",
    ],
    ascendant: [
      "ascendant",
      "rising",
      "appearance",
      "first impression",
      "outer self",
    ],
    midheaven: [
      "midheaven",
      "career",
      "public",
      "reputation",
      "vocation",
      "10th house",
    ],
    aspects: [
      "aspect",
      "square",
      "trine",
      "opposition",
      "conjunction",
      "sextile",
    ],
    houses: [
      "house",
      "1st",
      "2nd",
      "3rd",
      "4th",
      "5th",
      "6th",
      "7th",
      "8th",
      "9th",
      "10th",
      "11th",
      "12th",
    ],
    relationships: [
      "relationship",
      "partner",
      "marriage",
      "compatibility",
      "love life",
      "dating",
      "romance",
      "boyfriend",
      "girlfriend",
      "spouse",
      "attraction",
      "what i want in a partner",
      "my ideal partner",
    ],
    career: [
      "career",
      "work",
      "job",
      "profession",
      "vocation",
      "success",
      "workplace",
      "colleagues",
      "boss",
      "employment",
    ],
    challenges: [
      "challenge",
      "difficulty",
      "problem",
      "struggle",
      "weakness",
      "negative",
      "issue",
      "trouble",
    ],
    strengths: ["strength", "talent", "gift", "positive", "good", "strong"],
    family: [
      "family",
      "parents",
      "mother",
      "father",
      "siblings",
      "children",
      "home",
    ],
    friends: ["friends", "friendship", "social", "group", "community"],
    money: [
      "money",
      "financial",
      "finances",
      "wealth",
      "income",
      "savings",
      "budget",
    ],
    health: ["health", "wellness", "physical", "body", "illness", "healing"],
  };

  // Determine primary topic - check for multiple matches and prioritize
  let primaryTopic = null;
  let topicName = null;
  let matchedKeywords = [];

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    const matches = keywords.filter((keyword) => message.includes(keyword));
    if (matches.length > 0) {
      matchedKeywords.push({ topic, matches, count: matches.length });
    }
  }

  // Sort by number of matches and select the most relevant topic
  if (matchedKeywords.length > 0) {
    matchedKeywords.sort((a, b) => b.count - a.count);
    primaryTopic = matchedKeywords[0].topic;
    topicName = primaryTopic.charAt(0).toUpperCase() + primaryTopic.slice(1);
  }

  // Generate follow-up questions based on topic - make them more specific and actionable
  const followUpQuestions = {
    sun: [
      "Would you like me to elaborate on anything specific about your identity or self-expression?",
      "Should I explain how your Sun sign affects your relationships or career?",
      "Do you have questions about how your core personality manifests in your life?",
      "Is there anything else about your identity you'd like to explore?",
    ],
    moon: [
      "Would you like me to elaborate on anything specific about your emotional nature?",
      "Should I explain more about how your Moon affects your relationships or reactions?",
      "Do you have questions about managing your emotional needs or patterns?",
      "Is there anything else about your feelings or emotional responses you'd like to explore?",
    ],
    mercury: [
      "Would you like me to elaborate on anything specific about your communication or thinking?",
      "Should I explain more about how your mental processes affect your relationships or work?",
      "Do you have questions about your learning style or how you process information?",
      "Is there anything else about your communication patterns you'd like to explore?",
    ],
    venus: [
      "Would you like me to elaborate on anything specific about your love life?",
      "Should I explain more about what you need in relationships?",
      "Do you have questions about your attraction patterns or relationship values?",
      "Is there anything else about your approach to love and partnerships you'd like to explore?",
      "Would you like to know more about how your chart affects your romantic connections?",
    ],
    mars: [
      "Would you like me to elaborate on anything specific about your drive or motivation?",
      "Should I explain more about how you handle conflict or assert yourself?",
      "Do you have questions about managing your energy, passion, or anger?",
      "Is there anything else about your action style or assertiveness you'd like to explore?",
    ],
    jupiter: [
      "Would you like me to elaborate on anything specific about your growth or opportunities?",
      "Should I explain more about your philosophical outlook or where you find expansion?",
      "Do you have questions about your beliefs or where luck appears in your life?",
      "Is there anything else about your optimistic nature you'd like to explore?",
    ],
    saturn: [
      "Would you like me to elaborate on anything specific about your challenges or responsibilities?",
      "Should I explain more about the lessons your Saturn brings or how to work with them?",
      "Do you have questions about your discipline, structure, or areas of limitation?",
      "Is there anything else about your growth through challenges you'd like to explore?",
    ],
    uranus: [
      "Would you like me to elaborate on anything specific about your need for freedom or change?",
      "Should I explain more about how you handle innovation or unpredictability?",
      "Do you have questions about your rebellious side or unconventional approach?",
      "Is there anything else about your unique expression or independence you'd like to explore?",
    ],
    neptune: [
      "Would you like me to elaborate on anything specific about your intuition or spirituality?",
      "Should I explain more about how you navigate between dreams and reality?",
      "Do you have questions about your creative side or spiritual connection?",
      "Is there anything else about your imagination or sensitivity you'd like to explore?",
    ],
    pluto: [
      "Would you like me to elaborate on anything specific about your transformation or intensity?",
      "Should I explain more about how you handle power, control, or deep change?",
      "Do you have questions about your emotional depth or regenerative capacity?",
      "Is there anything else about your transformative nature you'd like to explore?",
    ],
    ascendant: [
      "Would you like me to elaborate on anything specific about your outer personality?",
      "Should I explain more about how your Ascendant affects first impressions or appearance?",
      "Do you have questions about how others perceive you versus your inner self?",
      "Is there anything else about your public persona you'd like to explore?",
    ],
    midheaven: [
      "Would you like me to elaborate on anything specific about your career or public image?",
      "Should I explain more about your professional calling or life direction?",
      "Do you have questions about your reputation or how you're seen professionally?",
      "Is there anything else about your career path you'd like to explore?",
    ],
    aspects: [
      "Would you like me to elaborate on anything specific about how your planets interact?",
      "Should I explain more about working with these aspects or aspect patterns?",
      "Do you have questions about how these aspects manifest in your life?",
      "Is there anything else about the relationships between your planets you'd like to explore?",
    ],
    houses: [
      "Would you like me to elaborate on anything specific about this life area?",
      "Should I explain more about how this house placement affects your daily life?",
      "Do you have questions about the themes or experiences in this house?",
      "Is there anything else about this area of your life you'd like to explore?",
    ],
    relationships: [
      "Would you like me to elaborate on your relationship patterns?",
      "Should I explain what you need in a partner?",
      "Do you have questions about compatibility with specific signs?",
      "Is there anything else about your approach to relationships you'd like to know?",
    ],
    career: [
      "Would you like me to elaborate on anything specific about your career?",
      "Should I explain more about your work style or professional strengths?",
      "Do you have questions about career paths that might suit you?",
      "Is there anything else about your professional life you'd like to explore?",
      "Would you like to know more about how your chart influences your work?",
    ],
    challenges: [
      "Would you like me to elaborate on anything specific about these challenges?",
      "Should I explain more about how to work with or transform these difficulties?",
      "Do you have questions about the growth opportunities in these challenges?",
      "Is there anything else about navigating these patterns you'd like to explore?",
    ],
    strengths: [
      "Would you like me to elaborate on anything specific about these strengths?",
      "Should I explain more about how these talents manifest in your life?",
      "Do you have questions about developing or maximizing these gifts?",
      "Is there anything else about your natural abilities you'd like to explore?",
    ],
    family: [
      "Would you like me to elaborate on anything specific about your family dynamics?",
      "Should I explain more about your relationship with family members?",
      "Do you have questions about your home life or family patterns?",
      "Is there anything else about your family relationships you'd like to explore?",
    ],
    friends: [
      "Would you like me to elaborate on anything specific about your friendships?",
      "Should I explain more about your social patterns or group connections?",
      "Do you have questions about your friendships or community involvement?",
      "Is there anything else about your social life you'd like to explore?",
    ],
    money: [
      "Would you like me to elaborate on anything specific about your finances?",
      "Should I explain more about your relationship with money or resources?",
      "Do you have questions about your financial patterns or values?",
      "Is there anything else about your material security you'd like to explore?",
    ],
    health: [
      "Would you like me to elaborate on anything specific about your health?",
      "Should I explain more about your physical well-being or body awareness?",
      "Do you have questions about health patterns in your chart?",
      "Is there anything else about your wellness you'd like to explore?",
    ],
  };

  // Select appropriate follow-up question - make it more specific to the user's question
  let question;

  // PRIORITY: Check for "about me" type questions first, regardless of primaryTopic
  if (
    message.includes("about me") ||
    message.includes("tell me about") ||
    message.includes("myself") ||
    (message.includes("tell me") && message.includes("about"))
  ) {
    const generalQuestions = [
      "Would you like me to elaborate on anything specific about your personality or chart?",
      "Do you have questions about your relationships, career, or personal growth?",
      "Is there a particular area of your life you'd like to explore deeper?",
      "Would you like to know more about your strengths, challenges, or how your planets interact?",
    ];
    question =
      generalQuestions[Math.floor(Math.random() * generalQuestions.length)];
    console.log("[FOLLOWUP] Using 'about me' question (priority)");
  } else if (primaryTopic && followUpQuestions[primaryTopic]) {
    // Select from topic-specific questions - use the first one as it's most relevant
    const questions = followUpQuestions[primaryTopic];
    question = questions[Math.floor(Math.random() * questions.length)];
    console.log("[FOLLOWUP] Using topic-specific question for:", primaryTopic);
  } else {
    // Only use generic questions if we truly can't determine the topic
    // And make them more specific based on response content
    if (
      response.includes("relationship") ||
      response.includes("love") ||
      response.includes("partner")
    ) {
      question =
        "Would you like me to elaborate on anything specific about your relationships?";
    } else if (
      response.includes("career") ||
      response.includes("work") ||
      response.includes("professional")
    ) {
      question =
        "Would you like me to elaborate on anything specific about your career?";
    } else if (
      response.includes("challenge") ||
      response.includes("difficulty") ||
      response.includes("struggle")
    ) {
      question =
        "Would you like me to elaborate on anything specific about these challenges?";
    } else if (
      response.includes("strength") ||
      response.includes("talent") ||
      response.includes("gift")
    ) {
      question =
        "Would you like me to elaborate on anything specific about these strengths?";
    } else {
      // Truly generic fallback - but make it more engaging
      // For "about me" or general questions, provide more specific options
      if (
        message.includes("about me") ||
        message.includes("tell me about") ||
        message.includes("myself")
      ) {
        const generalQuestions = [
          "Would you like me to elaborate on anything specific about your personality or chart?",
          "Do you have questions about your relationships, career, or personal growth?",
          "Is there a particular area of your life you'd like to explore deeper?",
          "Would you like to know more about your strengths, challenges, or how your planets interact?",
        ];
        question =
          generalQuestions[Math.floor(Math.random() * generalQuestions.length)];
      } else {
        const genericQuestions = [
          "Would you like me to elaborate on anything specific about this?",
          "Do you have questions about any particular aspect of this?",
          "Is there anything else about this topic you'd like to explore?",
        ];
        question =
          genericQuestions[Math.floor(Math.random() * genericQuestions.length)];
      }
    }
  }

  // For substantial questions, ALWAYS provide a follow-up (this should have been handled above, but double-check)
  if (!question && isSubstantialQuestion) {
    // Check if it's an "about me" type question
    if (
      message.includes("about me") ||
      message.includes("tell me about") ||
      message.includes("myself") ||
      (message.includes("tell me") && message.includes("about"))
    ) {
      const generalQuestions = [
        "Would you like me to elaborate on anything specific about your personality or chart?",
        "Do you have questions about your relationships, career, or personal growth?",
        "Is there a particular area of your life you'd like to explore deeper?",
        "Would you like to know more about your strengths, challenges, or how your planets interact?",
      ];
      question =
        generalQuestions[Math.floor(Math.random() * generalQuestions.length)];
      console.log("[FOLLOWUP] Using 'about me' fallback question (safety net)");
    } else {
      question =
        "Would you like me to elaborate on anything specific about this?";
      console.log(
        "[FOLLOWUP] Using generic fallback for substantial question (safety net)"
      );
    }
  }

  // Ensure we always return a question for substantial responses (backup)
  if (!question && aiResponse.length >= 100) {
    question =
      "Would you like me to elaborate on anything specific about this?";
    console.log("[FOLLOWUP] Using length-based fallback");
  }

  console.log("[FOLLOWUP] Final question before final check:", question);

  // ABSOLUTE FINAL SAFETY: if we have a substantial question and no follow-up yet, create one
  // This should NEVER happen if the above logic works, but just in case...
  if (!question && isSubstantialQuestion) {
    if (
      message.includes("about me") ||
      message.includes("tell me about") ||
      message.includes("myself") ||
      (message.includes("tell me") && message.includes("about"))
    ) {
      question =
        "Would you like me to elaborate on anything specific about your personality or chart?";
      console.log(
        "[FOLLOWUP] ABSOLUTE FINAL SAFETY: Using 'about me' question"
      );
    } else {
      question =
        "Would you like me to elaborate on anything specific about this?";
      console.log("[FOLLOWUP] ABSOLUTE FINAL SAFETY: Using generic question");
    }
  }

  // If STILL no question and response is substantial, create a generic one
  if (!question && aiResponse.length >= 50) {
    question =
      "Would you like me to elaborate on anything specific about this?";
    console.log(
      "[FOLLOWUP] FINAL FALLBACK: Using generic question based on response length"
    );
  }

  console.log("[FOLLOWUP] Final question:", question);
  console.log("[FOLLOWUP] Returning:", question ? "QUESTION" : "NULL");
  console.log("[FOLLOWUP] isSubstantialQuestion:", isSubstantialQuestion);
  console.log("[FOLLOWUP] aiResponse.length:", aiResponse.length);

  // ABSOLUTE GUARANTEE: For substantial questions, NEVER return null
  if (!question && isSubstantialQuestion) {
    console.log(
      "[FOLLOWUP] ERROR: Substantial question but no follow-up generated! Creating emergency fallback."
    );
    question =
      "Would you like me to elaborate on anything specific about this?";
  }

  // Final check - if we somehow still don't have a question for a substantial response, create one
  if (!question && aiResponse.length >= 30) {
    console.log(
      "[FOLLOWUP] ERROR: No question generated but response is substantial! Creating emergency fallback."
    );
    question =
      "Would you like me to elaborate on anything specific about this?";
  }

  console.log("[FOLLOWUP] Final return value:", question);
  return question || null;
}

// Chat endpoint for follow-up questions
app.post("/api/chat", async (req, res) => {
  try {
    const { message, birthChart, conversationHistory } = req.body;

    if (!message || !birthChart) {
      return res.status(400).json({
        error: "Missing required fields",
        details: "Please provide both a message and birth chart data",
      });
    }

    // Check if this is a factual question that can be answered deterministically
    if (isFactualQuestion(message)) {
      const factualAnswer = answerFactualQuestion(message, birthChart);
      if (factualAnswer) {
        console.log("[FACTUAL] Answered factual question deterministically");
        const followUpQuestion = generateFollowUpQuestion(
          message,
          factualAnswer,
          birthChart
        );
        return res.json({
          response: factualAnswer,
          isFactual: true,
          followUpQuestion: followUpQuestion,
        });
      }
      // If it matched a pattern but couldn't answer, fall through to AI
    }

    // Generate deterministic interpretation if not already present
    let interpretationTemplate;
    if (birthChart.interpretationTemplate) {
      // Use existing deterministic template
      interpretationTemplate = birthChart.interpretationTemplate;
    } else if (birthChart.deterministicInterpretation) {
      // Format existing deterministic interpretation
      interpretationTemplate = formatInterpretationForAI(
        birthChart.deterministicInterpretation,
        birthChart
      );
    } else {
      // Generate new deterministic interpretation from raw chart data
      const deterministicInterpretation =
        generateChartInterpretation(birthChart);
      interpretationTemplate = formatInterpretationForAI(
        deterministicInterpretation,
        birthChart
      );
    }

    // Create the messages array for the chat completion
    // AI now receives the deterministic template, not raw data
    const messages = [
      {
        role: "system",
        content: generateSystemPrompt(interpretationTemplate),
      },
    ];

    // Add conversation history if available
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }

    // Add the current message
    messages.push({
      role: "user",
      content: message,
    });

    // Make the API call to OpenAI
    // Adjusted parameters for comprehensive, detailed responses
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.7, // Higher for more varied, detailed responses
      max_tokens: 1000, // Increased significantly to allow comprehensive responses (400-600 words)
      presence_penalty: 0.1, // Lower to allow natural flow
      frequency_penalty: 0.0, // No penalty to allow full expression
    });

    // Generate contextually relevant follow-up question
    let followUpQuestion;
    try {
      followUpQuestion = generateFollowUpQuestion(
        message,
        completion.choices[0].message.content,
        birthChart
      );
    } catch (error) {
      console.error("[CHAT] Error generating follow-up question:", error);
      // Fallback: if there's an error, still try to generate a basic follow-up
      if (
        message.toLowerCase().includes("tell me") ||
        message.toLowerCase().includes("about")
      ) {
        followUpQuestion =
          "Would you like me to elaborate on anything specific about this?";
      }
    }

    // Ensure followUpQuestion is always a string or null, never undefined
    const finalFollowUp = followUpQuestion || null;

    console.log("[CHAT] Sending response with follow-up:", {
      responseLength: completion.choices[0].message.content.length,
      hasFollowUp: !!finalFollowUp,
      followUpQuestion: finalFollowUp?.substring(0, 50),
      followUpQuestionType: typeof finalFollowUp,
      followUpQuestionValue: finalFollowUp,
      messagePreview: message.substring(0, 50),
    });

    // Return the response with follow-up question
    // ALWAYS include followUpQuestion field, even if null
    const responseObj = {
      response: completion.choices[0].message.content,
      followUpQuestion: finalFollowUp,
    };

    console.log(
      "[CHAT] Response object:",
      JSON.stringify({
        ...responseObj,
        response: responseObj.response.substring(0, 50) + "...",
      })
    );

    return res.json(responseObj);
  } catch (error) {
    console.error("Error in chat endpoint:", error);
    return res.status(500).json({
      error: "Failed to process chat message",
      details: error.message,
    });
  }
});

// Add a test endpoint
app.get("/api/test", (req, res) => {
  res.json({ message: "Backend server is running" });
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log("Available endpoints:");
  console.log("- POST /api/login");
  console.log("- POST /api/signup");
  console.log("- POST /api/birth-chart");
  console.log("- POST /api/chat");
  console.log("- GET /api/test");
});
