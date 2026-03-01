// Quick test to verify function calling works
// Run with: node backend/test_function_calling.js

const { executeFunction } = require("./external_resources");

async function test() {
  console.log("Testing function calling...\n");

  // Test 1: Venus in Scorpio
  console.log("Test 1: 'venus in scorpio mean'");
  const result1 = await executeFunction("search_astrology_info", {
    query: "venus in scorpio mean",
  });
  console.log("Result:", result1?.substring(0, 300));
  console.log("\n");

  // Test 2: Just Venus
  console.log("Test 2: 'venus'");
  const result2 = await executeFunction("search_astrology_info", {
    query: "venus",
  });
  console.log("Result:", result2?.substring(0, 200));
  console.log("\n");

  // Test 3: Just Scorpio
  console.log("Test 3: 'scorpio'");
  const result3 = await executeFunction("search_astrology_info", {
    query: "scorpio",
  });
  console.log("Result:", result3?.substring(0, 200));
}

test().catch(console.error);
