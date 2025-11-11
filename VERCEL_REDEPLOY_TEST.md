# Vercel Redeploy & Test Guide

## ✅ Pre-Deployment Checklist

Before redeploying, ensure:
- [x] Railway backend is running: `https://api-production-adbf.up.railway.app`
- [ ] Vercel environment variables are set:
  - `NEXT_PUBLIC_BACKEND_API_URL` = `https://api-production-adbf.up.railway.app`
  - `LLM_API_KEY` = (your API key)

## 🚀 Option 1: Redeploy via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard:**
   - Visit: https://vercel.com/dashboard
   - Select your project

2. **Verify Environment Variables:**
   - Go to **Settings** → **Environment Variables**
   - Confirm both variables are set:
     - `NEXT_PUBLIC_BACKEND_API_URL`
     - `LLM_API_KEY`

3. **Redeploy:**
   - Go to **Deployments** tab
   - Click **⋯** (three dots) on the latest deployment
   - Click **Redeploy**
   - Wait for deployment to complete (usually 1-2 minutes)

## 🚀 Option 2: Redeploy via CLI

If you want to use CLI, first link the project:

```powershell
# Link project (if not already linked)
vercel link

# Then deploy
vercel --prod
```

## ✅ Post-Deployment Testing

### Step 1: Get Your Vercel URL

After redeploy, note your Vercel app URL (usually shown in dashboard or deployment logs).

### Step 2: Test Railway Backend Directly

```powershell
# Test health endpoint
Invoke-RestMethod -Uri "https://api-production-adbf.up.railway.app/health"
```

### Step 3: Test Full Integration

1. **Open your Vercel app** in browser
2. **Open DevTools** (F12) → **Network** tab
3. **Send a test message** in the chat
4. **Check the `/api/chat` request:**
   - Status should be **200 OK**
   - Request should go to Railway backend
   - Response should contain AI message

### Step 4: Verify in Browser Console

Check for any errors:
- CORS errors → Railway CORS config issue
- 503 errors → Railway service down
- 401 errors → API key mismatch
- Timeout errors → Railway slow response

## 🐛 Common Issues & Solutions

### Issue: Environment Variables Not Working

**Check:**
- Variables are set for **Production** environment
- Variable names match exactly (case-sensitive)
- Redeployed after adding variables

### Issue: 503 Service Unavailable

**Check:**
- Railway dashboard → Logs (is service running?)
- Railway URL is correct: `https://api-production-adbf.up.railway.app`
- Test Railway health endpoint directly

### Issue: 401 Unauthorized

**Check:**
- `LLM_API_KEY` matches in both Vercel and Railway
- API key is correct and not expired

### Issue: CORS Errors

**Check:**
- Railway CORS allows your Vercel domain
- Railway logs show CORS errors
- Your Vercel domain matches `*.vercel.app` pattern

## 📋 Testing Checklist

- [ ] Railway backend health check passes
- [ ] Vercel environment variables set
- [ ] Vercel app redeployed
- [ ] Vercel app loads successfully
- [ ] Chat interface loads
- [ ] Test message sends successfully
- [ ] AI response received
- [ ] Messages saved to Supabase
- [ ] No errors in browser console
- [ ] No errors in Vercel logs

## 🎯 Expected Flow After Deployment

```
1. User opens Vercel app
2. User sends message → Frontend calls /api/chat
3. Next.js API route → Calls Railway /api/llm/chat
4. Railway processes → Returns AI response
5. Next.js saves to Supabase → Returns to frontend
6. User sees AI response
```

## 📝 Quick Test Commands

```powershell
# Test Railway health
Invoke-RestMethod -Uri "https://api-production-adbf.up.railway.app/health"

# Test Railway chat (requires API key)
$headers = @{
    Authorization = "Bearer YOUR_API_KEY"
    "Content-Type" = "application/json"
}
$body = @{
    messages = @(
        @{ role = "user"; content = "Test" }
    )
} | ConvertTo-Json
Invoke-RestMethod -Uri "https://api-production-adbf.up.railway.app/api/llm/chat" -Method POST -Headers $headers -Body $body
```

## 🚨 Important Notes

- Railway URL: `https://api-production-adbf.up.railway.app`
- Endpoint: `/api/llm/chat`
- API key must match in Vercel and Railway
- CORS configured for `*.vercel.app`
- Deployment usually takes 1-2 minutes

