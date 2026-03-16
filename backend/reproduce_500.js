/**
 * Reproduce the "Assignment to constant variable" error by running
 * the same code path as POST /api/chat for message "hello".
 * Run: node reproduce_500.js
 * The stack trace will show the exact line causing the error.
 */
require("dotenv").config();

const openai = require("./openai_service");
const {
  getFunctionDefinitions,
  executeFunction,
  gatherChartInterpretationsFromWeb,
} = require("./external_resources");
const { formatBirthChartForChatGPT } = require("./chatgpt_template");
const {
  generateChartInterpretation,
  formatInterpretationForAI,
} = require("./chart_interpreter");
const {
  isFactualQuestion,
  answerFactualQuestion,
} = require("./factual_questions");

const birthChart = {
  birthData: {
    date: "1990-01-01",
    time: "12:00",
    location: { latitude: 40, longitude: -74, timezone: -5 },
  },
  angles: {
    ascendant: { sign: "Leo", degree: 10, element: "Fire" },
    midheaven: { sign: "Taurus", degree: 5, element: "Earth" },
  },
  planets: {
    sun: { sign: "Capricorn", degree: 25, element: "Earth", house: 10 },
    moon: { sign: "Cancer", degree: 12, element: "Water", house: 4 },
  },
  houses: [],
  aspects: [],
};
const message = "hello";
// Simulate real client: 11 history items (role + content)
const conversationHistory = Array.from({ length: 11 }, (_, i) =>
  i % 2 === 0
    ? { role: "user", content: `user message ${i}` }
    : { role: "assistant", content: `assistant message ${i}` },
);

async function run() {
  console.log("1. interpretationTemplate...");
  let interpretationTemplate;
  if (birthChart.interpretationTemplate) {
    interpretationTemplate = birthChart.interpretationTemplate;
  } else if (birthChart.deterministicInterpretation) {
    interpretationTemplate = formatInterpretationForAI(
      birthChart.deterministicInterpretation,
      birthChart,
    );
  } else {
    const deterministicInterpretation = generateChartInterpretation(birthChart);
    interpretationTemplate = formatInterpretationForAI(
      deterministicInterpretation,
      birthChart,
    );
  }
  console.log("   OK");

  console.log("2. isFactualQuestion...");
  const factual = isFactualQuestion(message);
  console.log("   ", factual);

  if (factual) {
    const ans = answerFactualQuestion(message, birthChart);
    console.log("   answer:", ans ? "yes" : "no");
  }

  console.log("3. gatherChartInterpretationsFromWeb...");
  let webInterpretations = "";
  try {
    webInterpretations = await gatherChartInterpretationsFromWeb(birthChart);
  } catch (e) {
    webInterpretations = "";
  }
  console.log("   OK, length:", webInterpretations.length);

  console.log("4. formatBirthChartForChatGPT...");
  const chartFactsOnly = formatBirthChartForChatGPT(birthChart);
  console.log("   OK");

  console.log("5. Build systemContent & messages...");
  const maxWebLen = 12000;
  const webBlock =
    webInterpretations && webInterpretations.length > maxWebLen
      ? webInterpretations.slice(0, maxWebLen) + "\n[...]"
      : webInterpretations || "";
  const webSection = webInterpretations
    ? "--- WEB ---\n" + webBlock + "\n---"
    : "--- No web ---";
  const systemContent =
    "You are AstroGuide.\n\n--- CHART ---\n" +
    chartFactsOnly +
    "\n---\n\n" +
    webSection;
  const messages = [{ role: "system", content: systemContent }];
  if (conversationHistory && conversationHistory.length > 0) {
    messages.push(...conversationHistory);
  }
  messages.push({ role: "user", content: message });
  console.log("   OK");

  console.log("6. getFunctionDefinitions & tools...");
  const functionDefs = getFunctionDefinitions();
  const tools = functionDefs.map((f) => ({ type: "function", function: f }));
  console.log("   OK, tools:", tools.length);

  console.log("7. openai.chat.completions.create...");
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: messages,
    tools: tools,
    tool_choice: "auto",
    temperature: 0.7,
    max_tokens: 1000,
    presence_penalty: 0.1,
    frequency_penalty: 0.0,
  });
  console.log("   OK");

  const finalResponse = completion.choices[0].message.content ?? "";
  console.log("8. finalResponse length:", finalResponse.length);
  console.log(
    "\nSuccess – no error in this flow. Error may be in generateFollowUpQuestion or elsewhere.",
  );
}

run().catch((err) => {
  console.error("\n*** ERROR ***");
  console.error(err.message);
  console.error("\nFull stack:\n", err.stack);
  process.exit(1);
});
