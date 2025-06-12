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
  const timestamp = Math.floor(Date.now() / 1000);
  const hash = require("crypto")
    .createHash("sha256")
    .update(`${USER_ID}${timestamp}${API_KEY}`)
    .digest("hex");

  const authHeader = `Basic ${Buffer.from(`${USER_ID}:${hash}`).toString(
    "base64"
  )}`;

  // Debug logging for authentication
  console.log("Generated Auth Header:", {
    timestamp,
    userId: USER_ID,
    hashLength: hash.length,
    authHeaderLength: authHeader.length,
  });

  return {
    Authorization: authHeader,
    "Content-Type": "application/json",
  };
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

    // Format date and time for AstrologyAPI.com
    const date = `${year}-${month.toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}`;
    const time = `${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}`;

    // Make API request to AstrologyAPI.com
    console.log("Making API request to AstrologyAPI.com...");
    try {
      const response = await axios.post(
        "https://json.astrologyapi.com/v1/planets",
        {
          day: day,
          month: month,
          year: year,
          hour: hour,
          min: minute,
          lat: latitude,
          lon: longitude,
          tzone: timezone || 0,
        },
        {
          headers: generateAuth(),
        }
      );

      console.log("API Response:", JSON.stringify(response.data, null, 2));

      // Transform the API response to match our expected format
      const birthChart = {
        planets: {
          sun: response.data.sun?.longitude || 0,
          moon: response.data.moon?.longitude || 0,
          mercury: response.data.mercury?.longitude || 0,
          venus: response.data.venus?.longitude || 0,
          mars: response.data.mars?.longitude || 0,
          jupiter: response.data.jupiter?.longitude || 0,
          saturn: response.data.saturn?.longitude || 0,
          uranus: response.data.uranus?.longitude || 0,
          neptune: response.data.neptune?.longitude || 0,
          pluto: response.data.pluto?.longitude || 0,
        },
        houses: {
          ascendant: response.data.ascendant || 0,
          mc: response.data.mc || 0,
          houses: response.data.houses || Array(12).fill(0),
        },
        ascendant: response.data.ascendant || 0,
        mc: response.data.mc || 0,
        house_system: "placidus",
      };

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
        url: "https://json.astrologyapi.com/v1/planets",
        params: {
          day,
          month,
          year,
          hour,
          min: minute,
          lat: latitude,
          lon: longitude,
          tzone: timezone || 0,
        },
      });

      // Return a more detailed error response
      return res.status(500).json({
        error: "Failed to calculate birth chart",
        details: apiError.response?.data?.message || apiError.message,
        request: {
          date,
          time,
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
