# Quick Vercel Setup Guide

## ✅ Railway Backend Status: RUNNING

**Railway URL:** `https://api-production-adbf.up.railway.app`
- Health endpoint: `/health` ✓
- Chat endpoint: `/api/llm/chat` ✓
- CORS configured for `*.vercel.app` ✓

## 🚀 Update Vercel Environment Variables

### Step 1: Go to Vercel Dashboard

1. Visit: https://vercel.com/dashboard
2. Select your **Aeris Chat** project
3. Click **Settings** → **Environment Variables**

### Step 2: Add/Update These Variables

#### Required Variables:

| Variable Name | Value |
|--------------|-------|
| `NEXT_PUBLIC_BACKEND_API_URL` | `https://api-production-adbf.up.railway.app` |
| `LLM_API_KEY` | (Same API key you used in Railway) |

### Step 3: Set Environment Scope

Make sure to set these for:
- ✅ **Production**
- ✅ **Preview** (optional, for preview deployments)
- ✅ **Development** (optional, for local dev)

### Step 4: Save and Redeploy

1. Click **Save** after adding variables
2. Go to **Deployments** tab
3. Click **⋯** (three dots) on latest deployment
4. Click **Redeploy**

Or wait for auto-redeploy if enabled.

## ✅ Verification Steps

### 1. Test Railway Backend (Already Done)
```powershell
.\test-railway-backend.ps1
```

### 2. Check Vercel Environment Variables

After redeploy, verify variables are loaded:
- Go to Vercel → Your Project → Settings → Environment Variables
- Confirm both variables are listed

### 3. Test from Vercel App

1. Open your Vercel app URL
2. Open Browser DevTools (F12) → **Network** tab
3. Send a test message in chat
4. Look for `/api/chat` request:
   - Should show **200 OK**
   - Should call Railway backend
   - Should return AI response

## 🐛 Troubleshooting

### If you see CORS errors:
- Railway CORS is already configured for `*.vercel.app` ✓
- Make sure your Vercel domain matches the pattern

### If you see 503 errors:
- Check Railway dashboard → Logs
- Verify Railway service is running (it is! ✓)
- Check Railway URL is correct

### If you see 401 errors:
- Verify `LLM_API_KEY` matches in both Vercel and Railway
- Check Railway environment variables

### If environment variables don't work:
- Make sure variables are set for **Production** environment
- Redeploy after adding variables
- Check variable names match exactly (case-sensitive)

## 📋 Quick Checklist

- [x] Railway backend deployed and running
- [x] Railway URL confirmed: `https://api-production-adbf.up.railway.app`
- [ ] Vercel `NEXT_PUBLIC_BACKEND_API_URL` updated
- [ ] Vercel `LLM_API_KEY` updated
- [ ] Vercel app redeployed
- [ ] Test chat from Vercel app
- [ ] Verify messages save to Supabase

## 🎯 Expected Result

After setup, your chat should work end-to-end:
1. User sends message → Vercel frontend
2. Vercel `/api/chat` → Railway `/api/llm/chat`
3. Railway processes with LLM
4. Response → Vercel → Supabase (save)
5. User sees AI response

## 📝 Notes

- Railway is running on port 8080 (Railway sets PORT automatically)
- Your code expects `/api/llm/chat` endpoint (matches Railway ✓)
- CORS allows `*.vercel.app` (configured ✓)
- API key must match in both services

