const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");

const app = express();
const port = 3000;

// Prokerala API credentials
const CLIENT_ID = "1189e38e-fc89-4960-ba84-ff3106f00da0";
const CLIENT_SECRET = "JMtUTh2PiUYCAFcrEWEfhFTzeKAYEiA0MsARPiZ5";
let accessToken = null;
let tokenExpiry = null;

// Function to get access token
async function getAccessToken() {
  try {
    // Check if we have a valid token
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
      return accessToken;
    }

    // Get new token
    const response = await axios.post(
      "https://api.prokerala.com/token",
      `grant_type=client_credentials&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    accessToken = response.data.access_token;
    // Set token expiry to 50 minutes (giving 10-minute buffer)
    tokenExpiry = Date.now() + (response.data.expires_in - 600) * 1000;

    return accessToken;
  } catch (error) {
    console.error("Error getting access token:", error);
    throw error;
  }
}

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the root directory
app.use(express.static(path.join(__dirname, "..")));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Simple in-memory user storage (replace with a database in production)
const users = new Map();

// Add a test user
users.set("jmsmith.coding@gmail.com", {
  email: "jmsmith.coding@gmail.com",
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

// Calculate birth chart endpoint using API
app.post("/api/birth-chart", async (req, res) => {
  console.log("Received birth chart request:", req.body);

  try {
    const { year, month, day, hour, minute, latitude, longitude, timezone } =
      req.body;

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
      return res.status(400).json({
        error: "Missing required fields",
        details: "Please provide all required birth data",
      });
    }

    // Get access token
    const token = await getAccessToken();

    // Format datetime for API
    const datetime = `${year}-${month.toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}T${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}:00${timezone ? `+${timezone}` : "+00:00"}`;
    const coordinates = `${latitude},${longitude}`;

    // Call the astrological API
    const response = await axios.get(
      "https://api.prokerala.com/v2/astrology/kundli",
      {
        params: {
          ayanamsa: 1, // Lahiri ayanamsa
          coordinates: coordinates,
          datetime: datetime,
        },
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Transform the API response to match our expected format
    const birthChart = {
      planets: {
        sun: response.data.planets.sun.longitude,
        moon: response.data.planets.moon.longitude,
        mercury: response.data.planets.mercury.longitude,
        venus: response.data.planets.venus.longitude,
        mars: response.data.planets.mars.longitude,
        jupiter: response.data.planets.jupiter.longitude,
        saturn: response.data.planets.saturn.longitude,
        uranus: response.data.planets.uranus.longitude,
        neptune: response.data.planets.neptune.longitude,
        pluto: response.data.planets.pluto.longitude,
      },
      houses: {
        ascendant: response.data.houses.ascendant,
        mc: response.data.houses.mc,
        houses: response.data.houses.cusps,
      },
      ascendant: response.data.houses.ascendant,
      mc: response.data.houses.mc,
    };

    // Process and return the API response
    res.json(birthChart);
  } catch (error) {
    console.error("Error calculating birth chart:", error);
    res.status(500).json({
      error: "Error calculating birth chart",
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
  console.log("- GET /api/test");
});
