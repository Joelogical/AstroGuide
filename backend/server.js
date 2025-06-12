const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

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
        planets: {
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
        },
        houses: {
          ascendant: housesResponse.data.ascendant || 0,
          mc: housesResponse.data.midheaven || 0,
          houses:
            housesResponse.data.houses.map((h) => h.degree) ||
            Array(12).fill(0),
        },
        ascendant: housesResponse.data.ascendant || 0,
        mc: housesResponse.data.midheaven || 0,
        house_system: "placidus",
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
        }),
      };

      // Log the raw API responses for debugging
      console.log("Raw Planets Response:", planetsResponse.data);
      console.log("Raw Houses Response:", housesResponse.data);
      console.log(
        "Transformed birth chart:",
        JSON.stringify(birthChart, null, 2)
      );

      // Return the transformed API response
      return res.json(birthChart);
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
  console.log("- GET /api/test");
});
