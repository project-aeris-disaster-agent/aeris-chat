# Testing Flask Backend Integration

This guide helps you verify that your Flask backend is properly connected to the Next.js chat application.

## Prerequisites

1. Flask backend running at `http://localhost:8000`
2. `.env.local` file configured with:
   ```
   NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000
   LLM_API_KEY=your_local_api_key
   ```
3. Next.js development server (optional for endpoint testing)

## Quick Test Methods

### Method 1: PowerShell Test Script (Recommended)

Run the provided test script:

```powershell
.\test-backend.ps1
```

This script will:
- Load configuration from `.env.local`
- Test the health endpoint (`/health`)
- Test the chat endpoint (`/api/llm/chat`) with `Authorization: Bearer <LLM_API_KEY>`
- Verify environment variable configuration
- Test the Next.js API route integration

### Method 2: Manual PowerShell Testing

#### Test Health Endpoint
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health" -Method GET
```

Expected: Should return a response (may be empty or JSON)

#### Test Chat Endpoint Directly
```powershell
$body = @{
    messages = @(
        @{
            role = "user"
            content = "Hello, this is a test"
        }
    )
} | ConvertTo-Json

$headers = @{
    Authorization = "Bearer $env:LLM_API_KEY"  # Or load from .env.local
    "Content-Type" = "application/json"
}

Invoke-RestMethod -Uri "http://localhost:8000/api/llm/chat" -Method POST -Headers $headers -Body $body
```

Expected: Should return a JSON response with the AI's message

### Method 3: Using Browser Developer Tools

1. Start your Next.js dev server: `npm run dev`
2. Open browser to `http://localhost:3000`
3. Open Developer Tools (F12) → Network tab
4. Send a message in the chat interface
5. Look for the `/api/chat` request and check:
   - Request payload (should include `sessionId` and `messages`)
   - Response status (should be 200)
   - Response body (should contain `message` field)

### Method 4: Using curl (if available)

```bash
# Health check
curl http://localhost:8000/health

# Chat endpoint
curl -X POST http://localhost:8000/api/llm/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LLM_API_KEY" \
  -d '{"messages": [{"role": "user", "content": "Hello"}]}'
```

## Expected Flask Backend Response Format

Your Flask backend should return JSON in one of these formats:

```json
{
  "message": "AI response text here"
}
```

Or:

```json
{
  "content": "AI response text here"
}
```

Or:

```json
{
  "response": "AI response text here"
}
```

The Next.js API route will automatically handle these formats.

## Troubleshooting

### Error: "Unauthorized"
- `LLM_API_KEY` is missing or incorrect
- Ensure the Authorization header is being sent (`Bearer <LLM_API_KEY>`)
- Check if your Flask-CORS configuration allows requests from `http://localhost:3000`

### Error: "Backend service is currently unavailable"
- Flask backend is not running
- Check if Flask is listening on port 8000
- Verify the URL in `.env.local` matches your Flask backend URL

### Error: "Request timeout"
- Backend is taking too long to respond (>30 seconds)
- Check Flask backend logs for errors
- Verify LLM/agent processing is working correctly

### Error: "Unable to connect to backend service"
- CORS is not properly configured in Flask
- Flask backend might be blocking the request
- Check Flask-CORS configuration to allow `http://localhost:3000`

## Flask-CORS Configuration Example

Make sure your Flask backend has CORS configured:

```python
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])  # Allow Next.js dev server

# Or for production:
# CORS(app, origins=["https://your-vercel-app.vercel.app"])
```

## Testing in Production

When deploying to Vercel:

1. Set `NEXT_PUBLIC_BACKEND_API_URL` in Vercel environment variables
2. Use your Railway backend URL (e.g., `https://your-app.railway.app`)
3. Ensure Flask-CORS allows requests from your Vercel domain
4. Test using the same methods above, but with production URLs

## Next Steps After Testing

Once endpoints are verified:
1. Test full chat flow in the browser
2. Verify messages are saved to Supabase
3. Test error scenarios (backend down, network issues)
4. Verify timeout handling works correctly

