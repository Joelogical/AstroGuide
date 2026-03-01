# Login Troubleshooting Guide

## Common Login Issues and Solutions

### 1. "Cannot connect to server" Error

**Problem**: The backend server is not running.

**Solution**:
1. Make sure you're in the `backend` directory
2. Start the server:
   ```bash
   cd backend
   node server.js
   ```
3. You should see: `Server running at http://localhost:3000`
4. Keep this terminal window open while using the app

### 2. "Invalid email or password" Error

**Problem**: The user doesn't exist or password is incorrect.

**Solutions**:

#### Option A: Use the Test Account
The app comes with a test user pre-configured:
- **Email**: `test@example.com`
- **Password**: `test123`

#### Option B: Create a New Account
1. Click the "Sign Up" tab
2. Fill in all fields:
   - Name
   - Email
   - Password
   - Birth Date
   - Birth Time
   - Birth Place (e.g., "New York, USA")
3. Click "Sign Up"

**Important Note**: Users are stored in memory, so if you restart the server, all users (except the test user) will be lost. The test user is recreated each time the server starts.

### 3. "User already exists" Error (Signup)

**Problem**: You're trying to sign up with an email that's already registered.

**Solutions**:
1. Use a different email address
2. Or log in with the existing account
3. Note: If the server was restarted, only the test user exists

### 4. Network Errors

**Problem**: Connection issues between frontend and backend.

**Solutions**:
1. Check that the server is running on `http://localhost:3000`
2. Check browser console (F12) for detailed error messages
3. Make sure no firewall is blocking localhost connections
4. Try refreshing the page

### 5. Form Validation Errors

**Problem**: Missing or invalid form fields.

**Solutions**:
- Make sure all fields are filled in
- Email must be in valid format (e.g., `user@example.com`)
- Birth date and time must be selected
- Birth place must be entered (e.g., "City, Country")

## Testing the Login System

### Quick Test Steps:

1. **Start the server**:
   ```bash
   cd backend
   node server.js
   ```

2. **Open the app**:
   - Navigate to `http://localhost:3000/landing.html`
   - Or `http://localhost:3000` (if it redirects)

3. **Test Login**:
   - Email: `test@example.com`
   - Password: `test123`
   - Click "Login"

4. **Test Signup**:
   - Click "Sign Up" tab
   - Fill in all fields
   - Click "Sign Up"

### Check Server Logs

The server logs all login/signup attempts. Watch the terminal where the server is running:

- ✅ Success: `Login successful for test@example.com`
- ❌ Failure: `Login failed: User not found - email@example.com`

## Important Notes

### In-Memory Storage

**Current Limitation**: User accounts are stored in memory, not a database. This means:
- ✅ Users persist during the same server session
- ❌ Users are lost when the server restarts
- ✅ Test user (`test@example.com`) is recreated on each server start

**Future Improvement**: For production, you'll want to use a database (MongoDB, PostgreSQL, etc.) to persist users.

### Email Case Sensitivity

The system now normalizes emails to lowercase, so:
- `Test@Example.com` = `test@example.com`
- Both will work the same way

### Password Security

**Current**: Passwords are stored in plain text (for demo purposes).

**Production**: You should hash passwords using bcrypt or similar before storing.

## Debugging Tips

1. **Check Browser Console** (F12):
   - Look for JavaScript errors
   - Check Network tab for API requests
   - Verify request/response data

2. **Check Server Logs**:
   - All login/signup attempts are logged
   - Errors include stack traces

3. **Test API Directly**:
   ```bash
   # Test login endpoint
   curl -X POST http://localhost:3000/api/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"test123"}'
   ```

## Still Having Issues?

1. Make sure the server is running
2. Check that you're using the correct URL (`http://localhost:3000`)
3. Verify the test credentials: `test@example.com` / `test123`
4. Check browser console for detailed error messages
5. Check server terminal for backend errors

## Recent Improvements

The login system has been improved with:
- ✅ Better error messages
- ✅ Network error detection
- ✅ Input validation
- ✅ Loading states
- ✅ Email normalization
- ✅ Better logging

If you're still experiencing issues after trying these solutions, check the server logs and browser console for specific error messages.
