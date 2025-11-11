# Quick Redeploy & Test Steps

## Step 1: Verify Railway Backend ✓
Railway URL: https://api-production-adbf.up.railway.app
Status: Running (confirmed from logs)

## Step 2: Update Vercel Environment Variables

Go to: https://vercel.com/dashboard
1. Select your project
2. Settings → Environment Variables
3. Ensure these are set:
   - NEXT_PUBLIC_BACKEND_API_URL = https://api-production-adbf.up.railway.app
   - LLM_API_KEY = (your API key)

## Step 3: Redeploy Vercel

Via Dashboard:
1. Go to Deployments tab
2. Click ⋯ on latest deployment
3. Click Redeploy
4. Wait 1-2 minutes

## Step 4: Test

1. Open your Vercel app URL
2. Open DevTools (F12) → Network tab
3. Send a test message
4. Check /api/chat request for 200 status

