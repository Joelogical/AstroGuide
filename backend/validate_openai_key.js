/**
 * Validate that OPENAI_API_KEY is set and accepted by the OpenAI API.
 * Run from project root: node backend/validate_openai_key.js
 */
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const openai = require("./openai_service");

async function validate() {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.trim() === "") {
    console.error("FAIL: OPENAI_API_KEY is missing or empty in .env");
    process.exit(1);
  }
  console.log("OPENAI_API_KEY: set (length " + key.length + ", starts with " + key.substring(0, 7) + "...)");

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      max_tokens: 10,
    });
    const raw = completion.choices[0]?.message?.content;
    const content = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((p) => (p?.type === "text" ? p.text : "")).join("") : "";
    console.log("API response:", content ? content.trim() : "(empty)");
    console.log("SUCCESS: Key is valid. Model responded.");
  } catch (err) {
    const status = err.status ?? err.statusCode;
    const msg = err.message || String(err);
    console.error("FAIL: OpenAI API error");
    console.error("  Status:", status ?? "(none)");
    console.error("  Message:", msg);
    if (status === 401) {
      console.error("  → Key is invalid, expired, or revoked. Create a new key at https://platform.openai.com/api-keys");
    } else if (status === 429) {
      console.error("  → Rate limit or quota exceeded. Check https://platform.openai.com/usage");
    }
    process.exit(1);
  }
}

validate();
