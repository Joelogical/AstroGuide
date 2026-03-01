# Function Calling Debug Guide

## Current Issue

When asking "What does Venus in Scorpio mean?", the bot responds with the user's chart data (e.g., "Your Venus is in Cancer") instead of explaining the general concept.

## What Should Happen

1. **Detection**: System detects it's a general astrology question (no "my")
2. **Function Call**: Calls `search_astrology_info("venus in scorpio mean")`
3. **Result**: Gets information about Venus in Scorpio from knowledge base
4. **Response**: AI explains the general concept, NOT the user's chart

## Debugging Steps

### 1. Check Server Logs

When you ask "What does Venus in Scorpio mean?", you should see:

```
[CHAT] Detected general astrology question, forcing function call
[CHAT] Question details: { message: "...", isGeneral: true }
[CHAT] Forcing function call with query: "venus in scorpio mean"
[EXTERNAL] Executing function: search_astrology_info
[EXTERNAL] Searching for: venus in scorpio mean
[CHAT] Function executed successfully. Result length: XXX
[CHAT] Function result preview: VENUS in SCORPIO:...
[CHAT] General astrology question answered using external resources
```

### 2. Test the Function Directly

Run the test script:
```bash
node backend/test_function_calling.js
```

This will show if the function is returning the correct data.

### 3. Check Detection Logic

The detection should catch:
- ✅ "what does venus in scorpio mean" → General question
- ❌ "what sign is my venus in" → User's chart question

### 4. Verify System Prompt

For general questions, the system prompt should:
- ✅ Explicitly say "NOT about their specific birth chart"
- ✅ Tell AI to use ONLY the provided information
- ✅ NOT include the user's chart interpretation template

## Common Issues

### Issue 1: Detection Not Triggering

**Symptoms**: No "[CHAT] Detected general astrology question" in logs

**Fix**: Check the detection logic in `server.js` around line 1285-1312

### Issue 2: Function Not Returning Data

**Symptoms**: "[CHAT] Function result received: null" or empty

**Fix**: 
- Check if `astrology_rules.js` has the required functions
- Test function directly: `node backend/test_function_calling.js`
- Check for errors in function execution

### Issue 3: AI Still Using Chart Data

**Symptoms**: Response mentions user's chart despite function call

**Fix**: 
- System prompt should explicitly exclude chart data for general questions
- Check that the system prompt doesn't include `interpretationTemplate` for general questions

## Current Implementation

The system now:
1. ✅ Detects general astrology questions (no "my")
2. ✅ Forces function call directly (bypasses OpenAI function calling)
3. ✅ Uses a system prompt that excludes chart data
4. ✅ Logs everything for debugging

## Next Steps if Still Not Working

1. **Check the actual logs** - What do you see in the server console?
2. **Test the function** - Run `node backend/test_function_calling.js`
3. **Check the response** - What is the AI actually returning?

## Manual Test

Try asking these questions and check the logs:

1. "What does Venus in Scorpio mean?" → Should trigger function call
2. "What sign is my Venus in?" → Should use chart data (no function call)
3. "Tell me about Saturn returns" → Should trigger function call

The logs will show exactly what's happening at each step.
