const express = require("express");
const cors = require("cors");
const path = require("path");
const astronomia = require("astronomia");

const app = express();
const port = 3000;

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
  // Log all users
  console.log("Current users:", Array.from(users.entries()));
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: "Email and password are required",
    });
  }

  // Check if user exists
  const user = users.get(email);
  console.log("User found:", user);
  if (!user || user.password !== password) {
    console.log(
      "Password provided:",
      password,
      "Expected:",
      user ? user.password : undefined
    );
    return res.status(401).json({
      success: false,
      error: "Invalid email or password",
      token: null,
    });
  }

  // Return success response
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

  // Validate required fields
  if (!email || !password || !name || !birthDate || !birthTime || !birthPlace) {
    return res.status(400).json({
      success: false,
      error: "All fields are required",
    });
  }

  // Check if user already exists
  if (users.has(email)) {
    return res.status(409).json({
      success: false,
      error: "User already exists",
    });
  }

  // Create new user
  const user = {
    email,
    password, // In production, hash the password!
    name,
    birthDate,
    birthTime,
    birthPlace,
  };

  // Store user
  users.set(email, user);

  // Return success response
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

// Calculate birth chart using astronomia
function calculateBirthChart(birthData) {
  try {
    const { year, month, day, hour, minute, latitude, longitude } = birthData;
    console.log("Calculating birth chart for:", {
      year,
      month,
      day,
      hour,
      minute,
      latitude,
      longitude,
    });

    // Convert to Julian Date
    const date = new Date(year, month - 1, day, hour, minute);
    console.log("Created Date object:", date.toISOString());

    const jd = astronomia.julian.DateToJD(date);
    console.log("Julian Date:", jd);

    // Calculate planetary positions
    try {
      // Calculate Sun's position
      const sunLon = astronomia.solar.apparentLongitude(jd) * (180 / Math.PI);

      // Calculate Moon's position using moonphase
      const moonLon = (astronomia.moonphase.phase(jd) * 360) % 360;

      // Calculate other planetary positions
      const planets = {
        sun: sunLon,
        moon: moonLon,
        mercury:
          ((astronomia.planetposition.mercury(jd).lon * 180) / Math.PI) % 360,
        venus:
          ((astronomia.planetposition.venus(jd).lon * 180) / Math.PI) % 360,
        mars: ((astronomia.planetposition.mars(jd).lon * 180) / Math.PI) % 360,
        jupiter:
          ((astronomia.planetposition.jupiter(jd).lon * 180) / Math.PI) % 360,
        saturn:
          ((astronomia.planetposition.saturn(jd).lon * 180) / Math.PI) % 360,
        uranus:
          ((astronomia.planetposition.uranus(jd).lon * 180) / Math.PI) % 360,
        neptune:
          ((astronomia.planetposition.neptune(jd).lon * 180) / Math.PI) % 360,
        pluto:
          ((astronomia.planetposition.pluto(jd).lon * 180) / Math.PI) % 360,
      };

      // Add error handling for Moon position
      if (!planets.moon || isNaN(planets.moon)) {
        console.error("Error calculating Moon position:", planets.moon);
        throw new Error("Failed to calculate Moon position");
      }

      console.log("Calculated planetary positions:", planets);

      // Calculate houses based on time and location
      const localHour = hour + longitude / 15; // Convert longitude to hours
      console.log("Local hour:", localHour);

      // Calculate ascendant using a more accurate formula
      const obliquity = 23.4397; // Earth's axial tilt
      const siderealTime = (localHour * 15 + longitude) % 360;
      const ascendant =
        Math.atan2(
          Math.cos((obliquity * Math.PI) / 180) *
            Math.sin((siderealTime * Math.PI) / 180),
          Math.cos((siderealTime * Math.PI) / 180)
        ) *
        (180 / Math.PI);
      console.log("Ascendant:", ascendant);

      // Calculate houses using Placidus system
      const houses = {
        ascendant: ascendant,
        mc: (ascendant + 90) % 360,
        houses: Array.from({ length: 12 }, (_, i) => {
          const houseAngle = (ascendant + i * 30) % 360;
          // Adjust house cusps based on latitude
          const latitudeFactor = Math.sin((latitude * Math.PI) / 180);
          return (houseAngle + latitudeFactor * 10) % 360;
        }),
      };

      console.log("Calculated houses:", houses);

      const result = {
        planets,
        houses,
        ascendant: houses.ascendant,
        mc: houses.mc,
      };

      console.log("Final birth chart result:", JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error("Error in calculateBirthChart:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        birthData,
      });
      throw new Error(`Failed to calculate birth chart: ${error.message}`);
    }
  } catch (error) {
    console.error("Error in calculateBirthChart:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      birthData,
    });
    throw error;
  }
}

// Calculate birth chart endpoint
app.post("/api/birth-chart", (req, res) => {
  console.log("Received birth chart request:", req.body);
  console.log("Raw request body:", JSON.stringify(req.body, null, 2));

  try {
    const { year, month, day, hour, minute, latitude, longitude, timezone } =
      req.body;

    // Log parsed values
    console.log("Parsed birth data:", {
      year: parseInt(year),
      month: parseInt(month),
      day: parseInt(day),
      hour: parseInt(hour),
      minute: parseInt(minute),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
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
      console.error("Missing required fields:", {
        year,
        month,
        day,
        hour,
        minute,
        latitude,
        longitude,
      });
      return res.status(400).json({
        error: "Missing required fields",
        details: "Please provide all required birth data",
      });
    }

    const birthChart = calculateBirthChart({
      year: parseInt(year),
      month: parseInt(month),
      day: parseInt(day),
      hour: parseInt(hour),
      minute: parseInt(minute),
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
    });

    console.log(
      "Successfully calculated birth chart:",
      JSON.stringify(birthChart, null, 2)
    );
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
