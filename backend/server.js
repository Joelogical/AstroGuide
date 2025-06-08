const express = require("express");
const cors = require("cors");
const path = require("path");

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

// Simple birth chart calculation (placeholder)
function calculateBirthChart(birthData) {
  // This is a simplified version - in a real implementation,
  // you would use proper astronomical calculations
  const { year, month, day, hour, minute, latitude, longitude } = birthData;

  // Convert date to a simple numeric value for demonstration
  const dateValue = year * 10000 + month * 100 + day;
  const timeValue = hour * 100 + minute;

  // Generate some sample planetary positions
  const planets = {
    sun: (dateValue % 360) + timeValue / 100,
    moon: ((dateValue + 30) % 360) + timeValue / 100,
    mercury: ((dateValue + 60) % 360) + timeValue / 100,
    venus: ((dateValue + 90) % 360) + timeValue / 100,
    mars: ((dateValue + 120) % 360) + timeValue / 100,
    jupiter: ((dateValue + 150) % 360) + timeValue / 100,
    saturn: ((dateValue + 180) % 360) + timeValue / 100,
    uranus: ((dateValue + 210) % 360) + timeValue / 100,
    neptune: ((dateValue + 240) % 360) + timeValue / 100,
    pluto: ((dateValue + 270) % 360) + timeValue / 100,
  };

  // Calculate houses (simplified)
  const houses = {
    ascendant: (longitude + timeValue) % 360,
    mc: (longitude + 90) % 360,
    houses: Array.from({ length: 12 }, (_, i) => (longitude + i * 30) % 360),
  };

  return {
    planets,
    houses,
    ascendant: houses.ascendant,
    mc: houses.mc,
  };
}

// Calculate birth chart endpoint
app.post("/api/birth-chart", (req, res) => {
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

    console.log("Successfully calculated birth chart");
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
