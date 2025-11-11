# Supabase Setup Guide

## Step 1: Login to Supabase CLI

Open a new terminal/PowerShell window and run:

```bash
supabase login
```

This will open your browser to authenticate. After logging in, you'll get an access token.

**Alternative**: If you have an access token, you can set it as an environment variable:
```bash
$env:SUPABASE_ACCESS_TOKEN="your_access_token_here"
```

## Step 2: Create a Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Fill in:
   - **Name**: aeris-chat (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is fine for development

4. Wait for the project to be created (takes 1-2 minutes)

## Step 3: Link Your Local Project to Supabase

After your project is created:

1. Go to your project settings: https://supabase.com/dashboard/project/[your-project-id]/settings/general
2. Copy your **Project Reference ID** (looks like: `abcdefghijklmnop`)

Then in your terminal, run:

```bash
cd "E:\NPC\06 AERIS CHAT"
supabase link --project-ref your-project-ref-id
```

## Step 4: Get Your Supabase Credentials

From your Supabase dashboard:

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

## Step 5: Set Up Environment Variables

Create a `.env.local` file in your project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (from Settings → API → service_role key)

# Backend API (Flask)
# For local development:
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000
LLM_API_KEY=your_llm_api_key
# For production (Railway): Set this in Vercel environment variables with your Railway backend URL and API key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Step 6: Initialize Supabase in Your Project

Run this command to initialize Supabase:

```bash
supabase init
```

This creates a `supabase` folder with configuration files.

## Step 7: Set Up Database Schema

You have two options:

### Option A: Using Supabase Dashboard (Easier)

1. Go to your Supabase dashboard
2. Click on **SQL Editor**
3. Open the file `supabase/schema.sql` from this project
4. Copy and paste the entire SQL into the editor
5. Click **Run** to execute

### Option B: Using Supabase CLI Migrations (Recommended for production)

1. Create a migration file:
```bash
supabase migration new initial_schema
```

2. Copy the contents of `supabase/schema.sql` into the newly created migration file in `supabase/migrations/`

3. Apply the migration:
```bash
supabase db push
```

## Step 8: Verify Setup

Test your connection by running:

```bash
npm run dev
```

Then visit http://localhost:3000 and try signing up/logging in.

## Troubleshooting

### If `supabase login` doesn't work:
- Make sure you're in a terminal with browser access
- Try running it in PowerShell (not CMD)
- Use the token method: `supabase login --token your-token`

### If linking fails:
- Make sure you copied the Project Reference ID correctly
- Check that you're logged in: `supabase projects list`

### If database queries fail:
- Verify your `.env.local` file has the correct credentials
- Check that Row Level Security (RLS) policies are set up correctly
- Make sure you've run the schema SQL in your Supabase dashboard

## Next Steps

After completing these steps:
1. Test authentication (signup/login)
2. Verify database tables are created
3. Proceed with building the chat interface

