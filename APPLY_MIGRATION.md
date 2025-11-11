# Quick Migration Guide - Apply Anonymous Sessions Migration

## Option 1: Apply via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy the entire contents of: `supabase/migrations/20251111012345_add_anonymous_sessions.sql`
6. Paste into the SQL Editor
7. Click **Run** (or press Ctrl+Enter)
8. Verify success message

## Option 2: Apply via Supabase CLI (if linked)

If your project is linked to Supabase CLI:

```bash
# Link your project (if not already linked)
supabase link --project-ref your-project-ref

# Push migrations to remote
supabase db push
```

## Option 3: Apply via MCP Supabase Tools

If you have Supabase MCP configured, I can apply it directly.

## Verify Migration Applied

After applying, verify the column exists:

```sql
-- Run this in Supabase SQL Editor
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'chat_sessions' 
AND column_name = 'anonymous_id';
```

You should see:
- column_name: `anonymous_id`
- data_type: `text`
- is_nullable: `YES`

## If Migration Fails

If you get errors about existing policies, the migration uses `DROP POLICY IF EXISTS` so it should be safe. If you encounter issues:

1. Check if `user_id` is already nullable
2. Check if `anonymous_id` column already exists
3. The migration uses `IF EXISTS` and `IF NOT EXISTS` clauses, so it's safe to run multiple times

