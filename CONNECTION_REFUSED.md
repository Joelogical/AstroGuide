# "Connection Refused" Fix

**Connection refused** means the frontend is trying to reach the backend at `http://localhost:3000`, but nothing is listening there. The backend server must be running.

## Fix: Start the backend server

**Option A – From the project root (recommended)**

1. Open a terminal.
2. Go to your project folder (the one that contains the `backend` and `frontend` folders):
   ```bash
   cd c:\Users\jm_sm\Personal-projects\AstroGuide
   ```
3. Start the server:
   ```bash
   npm start
   ```

**Option B – From the backend folder**

1. Open a terminal.
2. Go to the backend folder:
   ```bash
   cd c:\Users\jm_sm\Personal-projects\AstroGuide\backend
   ```
3. Start the server:
   ```bash
   node server.js
   ```

4. You should see:
   ```
   Server running at http://localhost:3000
   ```

5. **Leave this terminal open.** Then open or refresh the app in your browser. The red “Connection refused” banner should turn green “Server connected”.

## If you still get connection refused

- **Wrong folder?** Run the commands above from the project root so that `cd backend` lands in the real backend folder.
- **Different port?** If you set `PORT=3001` (or another number) in `backend/.env`, the server runs on that port. The frontend is hardcoded to `http://localhost:3000` — either use `PORT=3000` or change the URLs in `frontend/index.html` and `frontend/landing.html` to match (e.g. `http://localhost:3001`).
- **Firewall?** Ensure nothing is blocking localhost.

## Quick check

In a browser or with curl:
```bash
curl http://localhost:3000/api/test
```
If the server is running, you get a response. If you get "connection refused", the server is not running.
