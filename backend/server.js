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

    // Log parsed values
    console.log("Parsed values:", {
      year: typeof year === "string" ? parseInt(year) : year,
      month: typeof month === "string" ? parseInt(month) : month,
      day: typeof day === "string" ? parseInt(day) : day,
      hour: typeof hour === "string" ? parseInt(hour) : hour,
      minute: typeof minute === "string" ? parseInt(minute) : minute,
      latitude: typeof latitude === "string" ? parseFloat(latitude) : latitude,
      longitude:
        typeof longitude === "string" ? parseFloat(longitude) : longitude,
      timezone: timezone,
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

      // Get ChatGPT interpretation
      const interpretation = await getBirthChartInterpretation(birthChart);

      // Add interpretation to the response
      const response = {
        ...birthChart,
        interpretation: interpretation.success
          ? interpretation.interpretation
          : null,
        interpretationError: !interpretation.success
          ? interpretation.error
          : null,
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

    // Format the birth chart data for ChatGPT
    const formattedData = formatBirthChartForChatGPT(birthChart);

    // Create the messages array for the chat completion
    const messages = [
      {
        role: "system",
        content: generateSystemPrompt(formattedData),
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
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000,
      presence_penalty: 0.6,
      frequency_penalty: 0.3,
    });

    // Return the response
    return res.json({
      response: completion.choices[0].message.content,
    });
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
