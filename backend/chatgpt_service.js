const OpenAI = require("openai");
const {
  chatGPTTemplate,
  formatBirthChartForChatGPT,
} = require("./chatgpt_template");

// Initialize OpenAI configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getBirthChartInterpretation(birthChart) {
  try {
    // Format the birth chart data
    const formattedData = formatBirthChartForChatGPT(birthChart);

    // Create the messages array for the chat completion
    const messages = [
      {
        role: "system",
        content: chatGPTTemplate.system,
      },
      {
        role: "user",
        content: chatGPTTemplate.user.replace(
          "{{BIRTH_CHART_DATA}}",
          formattedData
        ),
      },
    ];

    // Make the API call to OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      temperature: 0.7, // Balanced between creativity and accuracy
      max_tokens: 2000, // Adjust based on your needs
      presence_penalty: 0.6, // Encourage diverse interpretations
      frequency_penalty: 0.3, // Reduce repetition
    });

    // Extract and return the interpretation
    return {
      success: true,
      interpretation: completion.choices[0].message.content,
      usage: completion.usage,
    };
  } catch (error) {
    console.error("Error getting birth chart interpretation:", error);
    return {
      success: false,
      error: error.message || "Failed to get birth chart interpretation",
    };
  }
}

module.exports = {
  getBirthChartInterpretation,
};
