const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(".")); // Serve static files from current directory

// In-memory user storage (replace with database in production)
const users = [];

// JWT secret (use environment variable in production)
const JWT_SECRET = "your-secret-key";

// Signup endpoint
app.post("/api/signup", async (req, res) => {
  try {
    console.log("Signup request received:", req.body); // Debug log

    const { email, password, name, birthDate, birthTime, birthPlace } =
      req.body;

    // Check if user already exists
    if (users.find((user) => user.email === email)) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = {
      id: users.length + 1,
      email,
      password: hashedPassword,
      name,
      birthDate,
      birthTime,
      birthPlace,
      isNewUser: true,
    };

    users.push(user);

    // Create token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: "24h",
    });

    // Return user data (excluding password) and token
    const { password: _, ...userWithoutPassword } = user;

    const response = {
      success: true,
      user: userWithoutPassword,
      token: token,
      redirectTo: "/disclaimer.html",
    };

    console.log("Signup response:", JSON.stringify(response, null, 2)); // Debug log
    res.json(response);
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({
      success: false,
      error: "Error creating user",
      redirectTo: "/landing.html",
    });
  }
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  try {
    // Log the entire request
    console.log("=== Login Request Details ===");
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body:", JSON.stringify(req.body, null, 2));
    console.log("Method:", req.method);
    console.log("URL:", req.url);
    console.log("==========================");

    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      console.log("Missing required fields:", {
        hasEmail: !!email,
        hasPassword: !!password,
        emailLength: email ? email.length : 0,
        passwordLength: password ? password.length : 0,
      });
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
        redirectTo: "/landing.html",
      });
    }

    // Log current users in memory
    console.log(
      "Current users in memory:",
      users.map((u) => ({
        id: u.id,
        email: u.email,
        hasPassword: !!u.password,
      }))
    );

    // Find user
    const user = users.find((u) => u.email === email);
    if (!user) {
      console.log("User not found:", {
        requestedEmail: email,
        availableEmails: users.map((u) => u.email),
      });
      return res.status(400).json({
        success: false,
        error: "User not found",
        redirectTo: "/landing.html",
      });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    console.log("Password validation:", {
      email: user.email,
      passwordValid: validPassword,
      providedPasswordLength: password.length,
    });

    if (!validPassword) {
      console.log("Invalid password for user:", email);
      return res.status(400).json({
        success: false,
        error: "Invalid password",
        redirectTo: "/landing.html",
      });
    }

    // Create token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: "24h",
    });

    // Return user data (excluding password) and token
    const { password: _, ...userWithoutPassword } = user;

    const response = {
      success: true,
      user: userWithoutPassword,
      token: token,
      redirectTo: "/index.html",
    };

    console.log("Login successful:", {
      email: user.email,
      userId: user.id,
      tokenGenerated: !!token,
      responseStructure: Object.keys(response),
      timestamp: new Date().toISOString(),
    });

    // Validate response structure before sending
    if (
      !response.success ||
      !response.token ||
      !response.user ||
      !response.redirectTo
    ) {
      console.error("Invalid response structure:", response);
      throw new Error("Invalid response structure");
    }

    res.json(response);
  } catch (error) {
    console.error("Login error:", {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    res.status(500).json({
      success: false,
      error: "Error logging in",
      redirectTo: "/landing.html",
    });
  }
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
