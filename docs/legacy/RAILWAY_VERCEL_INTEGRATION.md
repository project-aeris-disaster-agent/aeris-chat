# Railway to Vercel Integration Guide

## ✅ Railway Backend Deployed

**Railway Service URL:** `https://api-production-adbf.up.railway.app`

## 🔧 Step 1: Update Vercel Environment Variables

### Via Vercel Dashboard (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add/Update the following variables:

#### Required Variables:

```
NEXT_PUBLIC_BACKEND_API_URL = https://api-production-adbf.up.railway.app
LLM_API_KEY = (your LLM API key - same as Railway)
```

#### Optional (if not already set):

```
NEXT_PUBLIC_SUPABASE_URL = (your Supabase URL)
NEXT_PUBLIC_SUPABASE_ANON_KEY = (your Supabase anon key)
SUPABASE_SERVICE_ROLE_KEY = (your Supabase service role key)
```

### Via Vercel CLI (Alternative)

```bash
vercel env add NEXT_PUBLIC_BACKEND_API_URL production
# Enter: https://api-production-adbf.up.railway.app

vercel env add LLM_API_KEY production
# Enter: (your API key)
```

## 🚀 Step 2: Redeploy Vercel

After updating environment variables:

1. **Automatic:** Vercel will auto-redeploy if you have auto-deploy enabled
2. **Manual:** Go to **Deployments** → Click **Redeploy** on latest deployment

## ✅ Step 3: Verify Railway Backend is Working

Run the test script:

```powershell
.\test-railway-backend.ps1
```

Or test manually:

```powershell
# Test health endpoint
Invoke-RestMethod -Uri "https://api-production-adbf.up.railway.app/health" -Method GET

# Test chat endpoint (requires API key)
$headers = @{
    Authorization = "Bearer YOUR_API_KEY"
    "Content-Type" = "application/json"
}
$body = @{
    messages = @(
        @{ role = "user"; content = "Hello" }
    )
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://api-production-adbf.up.railway.app/api/llm/chat" -Method POST -Headers $headers -Body $body
```

## 🔍 Step 4: Test Full Integration

1. Open your Vercel app URL
2. Open Browser DevTools (F12) → **Network** tab
3. Send a message in the chat interface
4. Look for `/api/chat` request:
   - Should show status 200
   - Should call Railway backend
   - Should return AI response

## 🐛 Troubleshooting

### Issue: CORS Errors

**Symptom:** Browser console shows CORS errors

**Solution:** Ensure Railway backend has CORS configured for your Vercel domain:

```python
# In your Flask backend
CORS(app, origins=[
    "http://localhost:3000",
    "https://your-app.vercel.app",
    "https://*.vercel.app"  # For preview deployments
])
```

### Issue: 503 Service Unavailable

**Symptom:** Vercel returns 503 when calling backend

**Possible causes:**
1. Railway service not deployed/running
2. Wrong Railway URL
3. Railway service crashed

**Solution:**
- Check Railway dashboard → Logs
- Verify service is running
- Test Railway URL directly

### Issue: 401 Unauthorized

**Symptom:** Backend returns 401

**Solution:**
- Verify `LLM_API_KEY` matches in both Vercel and Railway
- Check Railway environment variables
- Ensure API key is correct

### Issue: Timeout Errors

**Symptom:** Request times out after 30 seconds

**Solution:**
- Check Railway logs for slow LLM responses
- Consider increasing timeout in `app/api/chat/route.ts` (currently 30s)
- Check Railway service resources

### Issue: Environment Variables Not Updating

**Symptom:** Changes not reflected after redeploy

**Solution:**
1. Ensure variables are set for correct environment (Production/Preview/Development)
2. Redeploy after adding variables
3. Clear Vercel cache if needed

## 📋 Verification Checklist

- [ ] Railway backend is deployed and accessible
- [ ] Health endpoint returns 200: `https://api-production-adbf.up.railway.app/health`
- [ ] Vercel environment variables updated:
  - [ ] `NEXT_PUBLIC_BACKEND_API_URL` = Railway URL
  - [ ] `LLM_API_KEY` = API key
- [ ] Vercel app redeployed
- [ ] Test chat functionality from Vercel app
- [ ] Check browser console for errors
- [ ] Verify messages are saved to Supabase

## 🎯 Expected Flow

```
User → Vercel Frontend → /api/chat (Next.js API Route)
  ↓
Next.js API Route → Railway Backend (/api/llm/chat)
  ↓
Railway Backend → LLM Processing
  ↓
Response → Next.js API Route → Supabase (save message)
  ↓
Response → Vercel Frontend → User sees AI response
```

## 📝 Notes

- Railway URL: `https://api-production-adbf.up.railway.app`
- Your code expects endpoint: `/api/llm/chat`
- API key must match in both Vercel and Railway
- CORS must allow your Vercel domain
- Railway free tier has limitations - monitor usage

## 🚨 Important Reminders

1. **Never commit API keys** to git
2. **Use environment variables** for all sensitive data
3. **Test locally first** before deploying
4. **Monitor Railway logs** for errors
5. **Check Railway billing** if on free tier

## 📞 Next Steps After Integration

1. Monitor Railway logs for errors
2. Set up Railway alerts for downtime
3. Consider adding rate limiting
4. Monitor costs on Railway dashboard
5. Set up custom domain (optional)

