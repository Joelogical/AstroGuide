# 500 Error Troubleshooting

A **500 error** on localhost:3000 means the server is running but something threw an error while handling your request.

## 1. See the error in the app (after the latest fix)

When a 500 happens **on the chat endpoint**, the bot’s reply in the chat now shows the **exact error message** from the server (e.g. `Invalid API Key`, `birthChart.birthData is undefined`).

- Send a message so the 500 happens again.
- Read the **bot’s last message** in the chat. It will say something like:  
  `Server error (500): [the real error] — Check backend/.env...`
- **Copy that error message** (the part after `500): ` and before ` — Check`) and use it to fix the issue or share it for help.

You can also open **Developer Tools (F12) → Network tab**, click the red failed request to `api/chat`, then open **Response** to see the full JSON (including `details`, `code`, `name`).

## 2. Check the server terminal

When a 500 happens, the server also logs the error. **Look at the terminal where you ran `npm start`**. You should see lines like:

- `Error in chat endpoint: ...`
- `Chat error stack: ...`
- Or `[CHAT] formatBirthChartForChatGPT failed: ...`

The **message** and **stack** tell you what broke.

## 3. Common causes

| Cause | What you see in terminal | Fix |
|-------|---------------------------|-----|
| **Missing or invalid OpenAI API key** | Error about OpenAI / 401 / invalid key | Add a valid `OPENAI_API_KEY` in `backend/.env`. |
| **Birth chart data missing or wrong shape** | `formatBirthChartForChatGPT failed` or "Cannot read property of undefined" | Recalculate your chart from the app (Recalculate Chart). If you never calculated a chart, do that before sending a chat message. |
| **Astrology API credentials** | Error when calling AstrologyAPI / birth-chart | Set `ASTROLOGY_API_USER_ID` and `ASTROLOGY_API_KEY` in `backend/.env`. |
| **Network / external service down** | Timeout or connection error to OpenAI or Wikipedia | Check internet; try again later. |

## 4. What was changed to reduce 500s

- **Chart formatting** – If formatting the birth chart for the AI fails, the server now falls back to a short summary instead of crashing.
- **Error logging** – The chat endpoint logs the full error and stack so you can see the cause in the terminal.
- **Safer template** – `formatBirthChartForChatGPT` now handles missing or partial chart data without throwing.

## 5. If it still returns 500

1. Reproduce the 500 (e.g. send a message or recalculate chart).
2. In the **same moment**, check the **server terminal** (where `npm start` is running).
3. Copy the **error message** and **stack trace** (if shown).
4. Share that output so we can see exactly which line and which value caused the error.

The server does **not** send the full stack trace in the HTTP response (for security). The details are only in the terminal log.
