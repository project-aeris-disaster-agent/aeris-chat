# Anonymous Session Implementation Summary

## ✅ Implementation Complete

All code changes have been implemented to support anonymous sessions for emergency chat access without authentication.

## What Was Changed

### 1. Database Migration
**File:** `supabase/migrations/20251111012345_add_anonymous_sessions.sql`

- Made `user_id` nullable in `chat_sessions` table
- Added `anonymous_id` column for browser session tracking
- Added constraint: either `user_id` OR `anonymous_id` must exist
- Updated RLS policies to support both authenticated and anonymous sessions
- Updated message RLS policies accordingly

### 2. Anonymous Session Utility
**File:** `lib/utils/anonymous-session.ts`

- `getAnonymousSessionId()` - Gets or creates browser session ID from localStorage
- `clearAnonymousSession()` - Clears anonymous session (when user logs in)
- `getClientIP()` - Extracts IP address from request headers

### 3. API Routes Updated

**`app/api/sessions/route.ts`**
- POST: Accepts `anonymousId` parameter, creates sessions with `user_id` or `anonymous_id`
- GET: Fetches sessions by `user_id` (authenticated) or `anonymous_id` (anonymous)

**`app/api/messages/route.ts`**
- GET: Verifies session access for both authenticated and anonymous users
- Checks `anonymousId` matches session's `anonymous_id`

**`app/api/chat/route.ts`**
- POST: Accepts `anonymousId` parameter
- Verifies session ownership for both authenticated and anonymous users
- Handles message insertion for both cases

### 4. React Hooks Updated

**`hooks/useSessions.ts`**
- Automatically detects authentication status
- Uses anonymous session ID when not authenticated
- Creates/fetches sessions via API route for anonymous users

**`hooks/useChat.ts`**
- Passes `anonymousId` when fetching messages
- Passes `anonymousId` when sending messages
- Handles both authenticated and anonymous message flows

### 5. TypeScript Types Updated

**`types/user.ts`**
- `ChatSession.user_id` is now nullable (`string | null`)
- Added `ChatSession.anonymous_id` (`string | null`)

## How It Works

### Anonymous User Flow
1. User visits app without authentication
2. Browser generates/retrieves anonymous session ID from localStorage
3. Session created with `user_id = null`, `anonymous_id = <browser-session-id>`
4. Messages linked to session via `session_id`
5. Session persists across page refreshes (30-day expiry)

### Authenticated User Flow
1. User logs in
2. Session created with `user_id = <user-uuid>`, `anonymous_id = null`
3. Messages linked to session via `session_id`
4. User can access all their sessions

### Migration Path
When anonymous user signs up:
- Find all sessions with their `anonymous_id`
- Update those sessions: set `user_id`, clear `anonymous_id`
- Clear localStorage anonymous session

## Next Steps

### 1. Apply Database Migration

Using Supabase CLI:
```bash
# Make sure you're connected to your Supabase project
supabase db push

# Or apply manually in Supabase Dashboard SQL Editor
# Copy contents of: supabase/migrations/20251111012345_add_anonymous_sessions.sql
```

### 2. Test the Implementation

1. **Test Anonymous Session:**
   - Open app in incognito/private window
   - Send a message
   - Verify session is created with `anonymous_id`
   - Refresh page - session should persist

2. **Test Authenticated Session:**
   - Log in
   - Send a message
   - Verify session is created with `user_id`
   - Check that anonymous sessions are separate

3. **Test Migration Path:**
   - Create anonymous session
   - Sign up/login
   - Verify anonymous sessions can be migrated (future feature)

### 3. Environment Variables

Ensure these are set:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000
LLM_API_KEY=your_api_key
AUTH_DISABLED=true  # For testing anonymous mode
```

## Architecture Benefits

✅ **Emergency Access** - Users can chat without authentication  
✅ **User Attribution** - Both authenticated and anonymous users tracked  
✅ **Scalability** - Indexes on both `user_id` and `anonymous_id`  
✅ **Security** - RLS policies prevent cross-user access  
✅ **Persistence** - Browser sessions persist across refreshes  
✅ **Migration Ready** - Anonymous sessions can be linked to users on signup  

## Files Modified

- ✅ `supabase/migrations/20251111012345_add_anonymous_sessions.sql` (NEW)
- ✅ `lib/utils/anonymous-session.ts` (NEW)
- ✅ `app/api/sessions/route.ts` (UPDATED)
- ✅ `app/api/messages/route.ts` (UPDATED)
- ✅ `app/api/chat/route.ts` (UPDATED)
- ✅ `hooks/useSessions.ts` (UPDATED)
- ✅ `hooks/useChat.ts` (UPDATED)
- ✅ `types/user.ts` (UPDATED)

## Testing Checklist

- [ ] Apply migration to database
- [ ] Test anonymous session creation
- [ ] Test anonymous message sending
- [ ] Test anonymous message fetching
- [ ] Test authenticated session (should work as before)
- [ ] Test session persistence across page refresh
- [ ] Verify RLS policies prevent cross-user access
- [ ] Check browser console for any errors

## Notes

- Anonymous sessions expire after 30 days (configurable in `anonymous-session.ts`)
- IP address is tracked for both authenticated and anonymous sessions
- Service role key is used server-side only (never exposed to client)
- All database operations respect RLS policies

