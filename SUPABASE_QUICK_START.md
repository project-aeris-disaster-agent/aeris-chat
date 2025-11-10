# Supabase Setup - Quick Reference

## ✅ What's Been Completed

1. **Supabase CLI Installed** (v2.54.11)
   - Installed via Scoop package manager
   - Available in your terminal

2. **Project Initialized**
   - Supabase configuration created (`supabase/config.toml`)
   - Migration file created (`supabase/migrations/20251110011229_initial_schema.sql`)
   - Database schema ready to deploy

## 📋 Next Steps (Follow in Order)

### Step 1: Login to Supabase CLI

Open a **new terminal window** (important: new window to get updated PATH) and run:

```bash
supabase login
```

This will:
- Open your browser
- Ask you to authenticate with Supabase
- Save your credentials locally

**Alternative** (if browser doesn't open):
```bash
# Get token from: https://supabase.com/dashboard/account/tokens
supabase login --token YOUR_ACCESS_TOKEN
```

### Step 2: Create Supabase Project

1. Go to: https://supabase.com/dashboard
2. Click **"New Project"**
3. Fill in:
   - **Name**: `aeris-chat` (or your choice)
   - **Database Password**: ⚠️ **SAVE THIS PASSWORD** - you'll need it!
   - **Region**: Choose closest to your users
   - **Plan**: Free tier is fine for development
4. Wait 1-2 minutes for project creation

### Step 3: Link Local Project to Remote

After project is created:

1. Go to: **Settings** → **General** in your Supabase dashboard
2. Copy the **Reference ID** (looks like: `abcdefghijklmnop`)

Then in terminal:
```bash
cd "E:\NPC\06 AERIS CHAT"
supabase link --project-ref YOUR_PROJECT_REF_ID
```

### Step 4: Get Your Credentials

From Supabase Dashboard → **Settings** → **API**:

1. **Project URL**: `https://xxxxx.supabase.co`
2. **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
3. **service_role key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (keep secret!)

### Step 5: Create `.env.local` File

Create `.env.local` in your project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Backend LLM API (configure later)
NEXT_PUBLIC_LLM_API_URL=
LLM_API_KEY=

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 6: Apply Database Schema

**Option A: Using Supabase Dashboard (Easiest)**

1. Go to **SQL Editor** in Supabase dashboard
2. Copy contents from `supabase/migrations/20251110011229_initial_schema.sql`
3. Paste and click **Run**

**Option B: Using CLI (Recommended)**

```bash
supabase db push
```

This will apply all migrations to your remote database.

### Step 7: Verify Setup

1. Install dependencies:
```bash
npm install
```

2. Start dev server:
```bash
npm run dev
```

3. Visit: http://localhost:3000
4. Try signing up/logging in

## 🔍 Verify Everything Works

### Check Database Tables

In Supabase Dashboard → **Table Editor**, you should see:
- ✅ `users` table
- ✅ `chat_sessions` table  
- ✅ `messages` table

### Check Authentication

1. Visit http://localhost:3000/login
2. Try creating an account
3. Check Supabase Dashboard → **Authentication** → **Users** to see your new user

### Check Row Level Security

In Supabase Dashboard → **Authentication** → **Policies**, verify:
- Users can only access their own data
- All tables have RLS enabled

## 🐛 Troubleshooting

### "Command not found: supabase"
- Open a **new terminal window** (PATH needs to refresh)
- Or restart your terminal/PowerShell

### "Not logged in"
- Run `supabase login` in a new terminal
- Make sure browser opens for authentication

### "Project not linked"
- Verify you copied the correct Project Reference ID
- Check: `supabase projects list` to see your projects

### Database connection errors
- Verify `.env.local` has correct credentials
- Check Supabase dashboard → Settings → API
- Make sure you've applied the schema (Step 6)

### Authentication not working
- Check browser console for errors
- Verify RLS policies are created
- Check Supabase Dashboard → Authentication → Users

## 📚 Useful Commands

```bash
# Check Supabase status
supabase status

# List your projects
supabase projects list

# View migration history
supabase migration list

# Reset local database (if using local dev)
supabase db reset

# Generate TypeScript types from database
supabase gen types typescript --local > lib/supabase/database.types.ts
```

## 🎯 What's Next?

After completing these steps:
1. ✅ Database is set up
2. ✅ Authentication is configured
3. ✅ Ready to build chat interface!

Proceed to Phase 2: Building the Chat Interface components.

