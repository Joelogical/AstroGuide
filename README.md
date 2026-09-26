# AstroGuide

Western natal charts and conversational interpretation. The wheel is calculated locally with Swiss Ephemeris; chat uses the computed architecture (ruler, dignities, aspects, configurations) rather than a generic sign-by-sign dump.

## Features

- Natal charts from birth date, time, and place (Swiss Ephemeris; AstrologyAPI.com only if that engine fails or `CHART_ENGINE=astrologyapi`)
- Interactive wheel: planets, houses, aspects, optional asteroids, hover and click-to-ask
- **Modern** charts (outers + asteroids) or **Traditional** (Sun through Saturn, classical rulerships only)
- Unknown birth time: planets and aspects still calculate; houses and rising are not treated as real (wheel shows 0° Aries rising as a placeholder)
- Chat that stays with the natal chart:
  - Personal questions describe the person
  - “Analyze my chart” / “what stands out” inspect the chart as a technical system (`CHART_ANALYSIS`)
  - Named placements and clicked aspects stay on that factor
- Beginner or Advanced language, plus optional softer / strengths-focused tone
- No event prediction; timing questions are redirected to potential already in the chart
- Login and signup are still in the app; **Skip for now** is a temporary guest path

## Prerequisites

- Node.js 18+ and npm
- An [OpenAI](https://platform.openai.com/) API key for chat
- Optional: [AstrologyAPI.com](https://astrologyapi.com/) credentials (fallback natal engine)

## Setup

1. Clone the repository:

```bash
git clone https://github.com/Joelogical/AstroGuide.git
cd AstroGuide
```

2. Install dependencies:

```bash
npm install
cd backend
npm install
cd ..
```

3. Create `backend/.env`:

```
OPENAI_API_KEY=your_openai_api_key
PORT=3000

# Optional natal fallback (used automatically if Swiss Ephemeris fails)
ASTROLOGY_API_USER_ID=your_user_id
ASTROLOGY_API_KEY=your_api_key

# Optional: force AstrologyAPI instead of Swiss Ephemeris
# CHART_ENGINE=astrologyapi
```

4. Start the server from the repo root:

```bash
npm start
```

Or `cd backend && node server.js`.

5. Open [http://localhost:3000](http://localhost:3000) (or [http://127.0.0.1:3000](http://127.0.0.1:3000) if `localhost` misbehaves). The Express app serves `frontend/` and the API.

Do not open `frontend/*.html` as a file or via Live Server (port 5500); the page will send you to the Express origin.

## Project structure

```
AstroGuide/
├── frontend/
│   ├── index.html      # Chart wheel, profiles, chat
│   ├── landing.html    # Login, signup, temporary skip
│   └── styles.css
├── backend/
│   ├── server.js                 # Express API
│   ├── birth_chart_service.js    # Swiss Ephemeris, then AstrologyAPI fallback
│   ├── chart_architecture.js     # Computed natal structure
│   ├── chart_analysis.js         # CHART_ANALYSIS intent
│   ├── traditional_chart.js      # Seven-planet / classical rulers
│   ├── prediction_guard.js       # No forecasts
│   ├── prompt_layers.js          # Chat system prompts
│   └── .env                      # Local secrets (not committed)
└── README.md
```

## API

- `POST /api/login` — log in
- `POST /api/signup` — register
- `POST /api/birth-chart` — calculate a natal chart
- `POST /api/chat` — interpret from the saved chart
- `GET /api/test` — health check

Auth is in-memory for local use. Profiles and charts live in the browser.

## License

MIT
