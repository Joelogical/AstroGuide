// Test the complete flow for general astrology questions
// Run with: node backend/test_general_question_flow.js

const { executeFunction } = require("./external_resources");

async function testCompleteFlow() {
  console.log("Testing complete flow for 'What does Venus in Scorpio mean?'\n");
  console.log("=".repeat(80));

  // Step 1: Test detection
  const message = "what does venus in scorpio mean";
  const lowerMessage = message.toLowerCase().trim();
  const isGeneralQuestionPattern =
    (lowerMessage.includes("what does") ||
      lowerMessage.includes("tell me about") ||
      lowerMessage.includes("explain") ||
      lowerMessage.includes("what is") ||
      lowerMessage.includes("what are")) &&
    (lowerMessage.match(/\b(venus|sun|moon|mercury|mars|jupiter|saturn|uranus|neptune|pluto)\b/i) ||
      lowerMessage.match(/\b(scorpio|aries|taurus|gemini|cancer|leo|virgo|libra|sagittarius|capricorn|aquarius|pisces)\b/i)) &&
    !lowerMessage.includes("my ") &&
    !lowerMessage.includes("my chart") &&
    !lowerMessage.includes("my birth") &&
    !lowerMessage.includes("my venus") &&
    !lowerMessage.includes("my sun") &&
    !lowerMessage.includes("my moon");

  console.log("Step 1: Detection Test");
  console.log("-".repeat(80));
  console.log("Message:", message);
  console.log("Is General Question:", isGeneralQuestionPattern);
  console.log("✅ Detection:", isGeneralQuestionPattern ? "PASS" : "FAIL");
  console.log();

  if (!isGeneralQuestionPattern) {
    console.log("❌ Detection failed! Check the pattern matching logic.");
    return;
  }

  // Step 2: Test query extraction
  let searchQuery = message
    .replace(/^what (does|is|are) /i, "")
    .replace(/^tell me about /i, "")
    .replace(/^explain /i, "")
    .replace(/\?$/, "")
    .trim();

  console.log("Step 2: Query Extraction");
  console.log("-".repeat(80));
  console.log("Original:", message);
  console.log("Extracted Query:", searchQuery);
  console.log("✅ Extraction:", searchQuery ? "PASS" : "FAIL");
  console.log();

  // Step 3: Test function call
  console.log("Step 3: Function Call");
  console.log("-".repeat(80));
  try {
    const functionResult = await executeFunction("search_astrology_info", {
      query: searchQuery,
    });

    console.log("Function executed successfully");
    console.log("Result length:", functionResult?.length || 0);
    console.log("Result preview:", functionResult?.substring(0, 300));
    console.log();

    // Check if result contains planet-sign combination
    const hasPlanetSignCombo =
      functionResult?.includes("VENUS in SCORPIO") ||
      functionResult?.includes("Venus in Scorpio");

    console.log("Step 4: Result Validation");
    console.log("-".repeat(80));
    console.log("Has planet-sign combination:", hasPlanetSignCombo);
    console.log("✅ Function Result:", hasPlanetSignCombo ? "PASS" : "FAIL");

    if (!hasPlanetSignCombo) {
      console.log("⚠️  WARNING: Function returned planet-only info, not combination!");
      console.log("This means the planet-sign combination check isn't working.");
    }

    console.log();
    console.log("=".repeat(80));
    console.log("SUMMARY:");
    console.log("- Detection:", isGeneralQuestionPattern ? "✅ PASS" : "❌ FAIL");
    console.log("- Query Extraction:", searchQuery ? "✅ PASS" : "❌ FAIL");
    console.log("- Function Call:", functionResult ? "✅ PASS" : "❌ FAIL");
    console.log("- Planet-Sign Combo:", hasPlanetSignCombo ? "✅ PASS" : "❌ FAIL");

    if (
      isGeneralQuestionPattern &&
      searchQuery &&
      functionResult &&
      hasPlanetSignCombo
    ) {
      console.log();
      console.log("✅ ALL TESTS PASSED - The flow should work!");
      console.log("If it's still not working in the app, check:");
      console.log("1. Server was restarted");
      console.log("2. Server logs show detection triggering");
      console.log("3. No errors in function execution");
    } else {
      console.log();
      console.log("❌ SOME TESTS FAILED - Check the issues above");
    }
  } catch (error) {
    console.error("❌ Function call failed:", error);
  }
}

testCompleteFlow().catch(console.error);
