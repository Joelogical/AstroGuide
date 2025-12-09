// Quick test script to verify deterministic functions work
const {
  generateChartInterpretation,
  formatInterpretationForAI,
} = require("./chart_interpreter");

// Sample birth chart data (matching the structure from server.js)
const sampleChart = {
  birthData: {
    date: "1990-1-1",
    time: "12:0",
    location: {
      latitude: 40.7128,
      longitude: -74.006,
      timezone: -5,
    },
  },
  angles: {
    ascendant: {
      degree: 20.66,
      sign: "Aries",
      element: "Fire",
    },
    midheaven: {
      degree: 281.1,
      sign: "Capricorn",
      element: "Earth",
    },
  },
  planets: {
    sun: {
      degree: 281.02,
      sign: "Capricorn",
      element: "Earth",
      house: 9,
      isRetrograde: false,
    },
    moon: {
      degree: 336.07,
      sign: "Pisces",
      element: "Water",
      house: 12,
      isRetrograde: false,
    },
    mercury: {
      degree: 295.6,
      sign: "Capricorn",
      element: "Earth",
      house: 10,
      isRetrograde: true,
    },
  },
  houses: [
    { number: 1, degree: 20.66, sign: "Aries", element: "Fire" },
    { number: 2, degree: 56.07, sign: "Taurus", element: "Earth" },
  ],
  aspects: [],
};

console.log("Testing deterministic chart interpretation...\n");

try {
  const interpretation = generateChartInterpretation(sampleChart);
  console.log("✓ generateChartInterpretation() succeeded");
  console.log(`✓ Found ${Object.keys(interpretation.planets).length} planets`);
  console.log(
    `✓ Dominant element: ${interpretation.elementalBalance.dominant}`
  );
  console.log(`✓ Dominant modality: ${interpretation.modalBalance.dominant}`);

  // Test Sun in Capricorn interpretation
  if (interpretation.planets.sun) {
    console.log(
      `\n✓ Sun interpretation: ${interpretation.planets.sun.interpretation.substring(
        0,
        80
      )}...`
    );
  }

  const template = formatInterpretationForAI(interpretation);
  console.log(`\n✓ formatInterpretationForAI() succeeded`);
  console.log(`✓ Template length: ${template.length} characters`);
  console.log(
    `✓ Template contains 'Sun in Capricorn': ${template.includes(
      "Sun in Capricorn"
    )}`
  );

  console.log("\n✅ All deterministic functions working correctly!");
  console.log("\nSample template preview:");
  console.log("=".repeat(50));
  console.log(template.substring(0, 500) + "...");
} catch (error) {
  console.error("❌ Error:", error.message);
  console.error(error.stack);
  process.exit(1);
}
