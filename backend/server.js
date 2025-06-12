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

    // Get access token
    console.log("Getting access token...");
    const token = await getAccessToken();
    console.log("Got access token:", token.substring(0, 20) + "...");

    // Format datetime for API
    const timezoneOffset = timezone
      ? `${timezone >= 0 ? "+" : "-"}${Math.abs(timezone)
          .toString()
          .padStart(2, "0")}:00`
      : "+00:00";
    const datetime = `${year}-${month.toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}T${hour.toString().padStart(2, "0")}:${minute
      .toString()
      .padStart(2, "0")}:00${timezoneOffset}`;
    const coordinates = `${latitude},${longitude}`;

    console.log(
      "Making API request to:",
      "https://api.prokerala.com/v2/astrology/western-chart"
    );
    console.log("Request params:", {
      coordinates: coordinates,
      datetime: datetime,
      house_system: "placidus",
    });

    const response = await axios.get(
      "https://api.prokerala.com/v2/astrology/western-chart",
      {
        params: {
          coordinates: coordinates,
          datetime: datetime,
          house_system: "placidus",
        },
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("API Response:", JSON.stringify(response.data, null, 2));

    // Check if we have a valid response
    if (!response.data) {
      console.error("No data in API response");
      throw new Error("No data in API response");
    }

    // Log the structure of the response
    console.log("Response structure:", {
      hasData: !!response.data,
      keys: Object.keys(response.data),
      hasPlanets: !!response.data.planets,
      hasHouses: !!response.data.houses,
      planetKeys: response.data.planets
        ? Object.keys(response.data.planets)
        : [],
      houseKeys: response.data.houses ? Object.keys(response.data.houses) : [],
      houseSystem: response.data.house_system,
    });

    // Transform the API response to match our expected format
    const birthChart = {
      planets: {
        sun: response.data.planets?.sun?.longitude || 0,
        moon: response.data.planets?.moon?.longitude || 0,
        mercury: response.data.planets?.mercury?.longitude || 0,
        venus: response.data.planets?.venus?.longitude || 0,
        mars: response.data.planets?.mars?.longitude || 0,
        jupiter: response.data.planets?.jupiter?.longitude || 0,
        saturn: response.data.planets?.saturn?.longitude || 0,
        uranus: response.data.planets?.uranus?.longitude || 0,
        neptune: response.data.planets?.neptune?.longitude || 0,
        pluto: response.data.planets?.pluto?.longitude || 0,
      },
      houses: {
        ascendant: response.data.houses?.ascendant || 0,
        mc: response.data.houses?.mc || 0,
        houses: response.data.houses?.cusps || Array(12).fill(0),
      },
      ascendant: response.data.houses?.ascendant || 0,
      mc: response.data.houses?.mc || 0,
      house_system: response.data.house_system || "placidus",
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
      url: "https://api.prokerala.com/v2/astrology/western-chart",
      params: {
        coordinates: coordinates,
        datetime: datetime,
        house_system: "placidus",
      },
    });

    // Return a more detailed error response
    return res.status(500).json({
      error: "Failed to calculate birth chart",
      details: apiError.response?.data || apiError.message,
      request: {
        datetime,
        coordinates,
        house_system: "placidus",
      },
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
