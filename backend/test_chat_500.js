// Run: node backend/test_chat_500.js
// Reproduces the chat flow to find "Assignment to constant variable" error

const { formatBirthChartForChatGPT } = require("./chatgpt_template");
const { gatherChartInterpretationsFromWeb } = require("./external_resources");
const { generateChartInterpretation, formatInterpretationForAI } = require("./chart_interpreter");

// Minimal birth chart (like from API)
const birthChart = {
  birthData: {
    date: "1990-01-15",
    time: "12:00",
    location: { latitude: 40.7, longitude: -74, timezone: -5 },
  },
  angles: {
    ascendant: { sign: "Leo", degree: 10, element: "Fire" },
    midheaven: { sign: "Taurus", degree: 5, element: "Earth" },
  },
  planets: {
    sun: { sign: "Capricorn", degree: 25, element: "Earth", house: 10, isRetrograde: false },
    moon: { sign: "Cancer", degree: 12, element: "Water", house: 4, isRetrograde: false },
    mercury: { sign: "Capricorn", degree: 20, element: "Earth", house: 10, isRetrograde: false },
    venus: { sign: "Sagittarius", degree: 15, element: "Fire", house: 9, isRetrograde: false },
    mars: { sign: "Scorpio", degree: 8, element: "Water", house: 8, isRetrograde: false },
    jupiter: { sign: "Cancer", degree: 20, element: "Water", house: 4, isRetrograde: false },
    saturn: { sign: "Capricorn", degree: 14, element: "Earth", house: 10, isRetrograde: false },
    uranus: { sign: "Capricorn", degree: 4, element: "Earth", house: 9, isRetrograde: false },
    neptune: { sign: "Capricorn", degree: 12, element: "Earth", house: 9, isRetrograde: false },
    pluto: { sign: "Scorpio", degree: 14, element: "Water", house: 8, isRetrograde: false },
  },
  houses: Array.from({ length: 12 }, (_, i) => ({
    number: i + 1,
    degree: i * 30,
    sign: "Aries",
    element: "Fire",
  })),
  aspects: [],
};

async function run() {
  console.log("1. generateChartInterpretation...");
  const det = generateChartInterpretation(birthChart);
  console.log("2. formatInterpretationForAI...");
  const _tpl = formatInterpretationForAI(det, birthChart);
  console.log("3. formatBirthChartForChatGPT...");
  const chartFactsOnly = formatBirthChartForChatGPT(birthChart);
  console.log("4. gatherChartInterpretationsFromWeb...");
  const webInterpretations = await gatherChartInterpretationsFromWeb(birthChart);
  console.log("5. Building systemContent...");
  const maxWebLen = 12000;
  const webBlock = webInterpretations && webInterpretations.length > maxWebLen
    ? webInterpretations.slice(0, maxWebLen) + "\n[... truncated ...]"
    : (webInterpretations || "");
  const webSection = webInterpretations
    ? "--- WEB-SOURCED ---\n" + webBlock + "\n--- END ---"
    : "--- No web interpretations ---";
  const systemContent =
    "You are AstroGuide.\n\n" +
    "--- CHART FACTS ---\n" + chartFactsOnly + "\n--- END ---\n\n" +
    webSection;
  console.log("Done. systemContent length:", systemContent.length);
}

run().catch((err) => {
  console.error("Error:", err.message);
  console.error("Stack:", err.stack);
  process.exit(1);
});
