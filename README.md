# AstroGuide

A modern web application for Western astrology calculations and interpretations using AstrologyAPI.com.

## Features

- User authentication (signup/login)
- Birth chart calculations
- Planetary positions
- House positions
- Ascendant and Midheaven calculations
- Modern, responsive UI

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- AstrologyAPI.com account and API credentials

## Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/AstroGuide.git
cd AstroGuide
```

2. Install backend dependencies:

```bash
cd backend
npm install
```

3. Create a `.env` file in the backend directory with your AstrologyAPI.com credentials:

```
ASTROLOGY_API_USER_ID=your_user_id_here
ASTROLOGY_API_KEY=your_api_key_here
PORT=3000
```

4. Start the backend server:

```bash
node server.js
```

5. Open the frontend:

- Navigate to `http://localhost:3000` in your web browser
- The application will serve the frontend files automatically

## Project Structure

```
AstroGuide/
├── frontend/           # Frontend files
│   ├── index.html     # Main application page
│   ├── landing.html   # Login/signup page
│   └── styles.css     # Global styles
├── backend/           # Backend server
│   ├── server.js      # Express server
│   ├── package.json   # Backend dependencies
│   └── .env          # Environment variables
└── README.md         # This file
```

## API Endpoints

- `POST /api/login` - User login
- `POST /api/signup` - User registration
- `POST /api/birth-chart` - Calculate birth chart
- `GET /api/test` - Test endpoint

## Development

- Frontend files are served statically from the `frontend` directory
- Backend server runs on port 3000 by default
- CORS is enabled for local development
- Environment variables are loaded from `.env` file

## Security Notes

- In production, implement proper password hashing
- Use HTTPS
- Implement rate limiting
- Add input validation
- Use a proper database instead of in-memory storage

## License

MIT License
