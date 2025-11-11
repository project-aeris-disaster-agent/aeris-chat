# AI Chatbot Web Application Specification

## Overview

This document outlines the specifications for developing an AI Chatbot web application using React and Next.js. The application will enable users to interact with an AI agent through a sleek chat interface, manage chat sessions, and store user information and metadata in a shared Supabase database.

## Design Philosophy

- **UI/UX**: Sleek and straightforward interface
- **Color Palette**: 
  - Primary: White (#FFFFFF)
  - Secondary: Royal Blue (#4169E1 or #1E3A8A)
- **User Experience**: Clean, modern, and intuitive chat interface

## Core Features

### 1. AI Chat Interface with Session Management

#### Chat Window Component
- Real-time message display with user and AI messages clearly distinguished
- Message input area with send button
- Auto-scroll to latest message
- Message timestamps
- Loading indicators for AI responses
- Support for streaming responses (if backend supports it)
- Message status indicators (sending, sent, error)
- Private messaging w/ admin (users can have private chats with admin accounts)

#### Session Management
- Create new chat sessions
- Resume existing chat sessions
- List all user's chat sessions
- Delete chat sessions
- Session naming/renaming capability
- Last activity timestamp per session
- Session search/filter functionality

#### Message Features
- Text messages with markdown support
- Code block syntax highlighting
- Copy message functionality
- Regenerate response option
- Edit/delete user messages (with re-send capability)
- Message reactions/feedback (thumbs up/down)

### 2. User Authentication & Metadata Storage (Supabase)

#### Authentication Flow
- For normal users: User signup with simple captcha and email address
- For admins: privy web3 login (email, or metamask - BASE/ETH/SOL)
- Session persistence across browser sessions
- Protected routes requiring authentication

#### User Profile Management
- User profile page
- Display user information (name, email, avatar, phone number)
- Authenticate account w/ facebook login verification (blue checkmark on profile and beside username)
- Edit profile information
- Account deletion

#### Database Schema (Supabase)

**users table** (extends Supabase auth.users)
```sql
- id (uuid, primary key, references auth.users)
- email (text)
- full_name (text)
- avatar_url (text, nullable)
- wallet_address (text, nullable) - For web3 login (BASE/ETH/SOL addresses)
- ip_address (inet, nullable) - User's IP address for tracking/security
- current_location (jsonb, nullable) - Location data (latitude, longitude, city, country, etc.)
- contact_no (text, nullable) - Phone number/contact information
- created_at (timestamp)
- updated_at (timestamp)
- metadata (jsonb, for additional user data)
```

**chat_sessions table**
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key to users.id)
- ip_address (inet, nullable) - IP address used when session was created/accessed
- title (text, nullable)
- created_at (timestamp)
- updated_at (timestamp)
- last_message_at (timestamp)
- metadata (jsonb, for session-specific data)
```

**messages table**
```sql
- id (uuid, primary key)
- session_id (uuid, foreign key to chat_sessions.id)
- role (text: 'user' | 'assistant' | 'system')
- content (text)
- created_at (timestamp)
- updated_at (timestamp)
- metadata (jsonb, for message-specific data like tokens, model used, etc.)
```

### 3. Backend LLM Integration

#### API Endpoints Structure

**Chat Endpoint**
```
POST /api/chat
Request Body:
{
  "sessionId": "uuid",
  "messages": [
    {
      "role": "user" | "assistant",
      "content": "string"
    }
  ],
  "stream": boolean (optional)
}

Response:
- Streaming: Server-Sent Events (SSE) or WebSocket
- Non-streaming: JSON response with complete message
```

**Session Management Endpoints**
```
GET /api/sessions - List user sessions
POST /api/sessions - Create new session
GET /api/sessions/:id - Get session details
PUT /api/sessions/:id - Update session
DELETE /api/sessions/:id - Delete session
```

**Message Endpoints**
```
GET /api/sessions/:sessionId/messages - Get messages for session
POST /api/sessions/:sessionId/messages - Send new message
PUT /api/messages/:id - Update message
DELETE /api/messages/:id - Delete message
```

#### Error Handling
- Network error handling
- API error responses with user-friendly messages
- Retry logic for failed requests
- Rate limiting handling
- Timeout handling

## Technical Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: 
  - React Context API for global state (auth, sessions)
  - React Query/TanStack Query for server state management
  - Local state with useState/useReducer for component state
- **HTTP Client**: Fetch API or Axios
- **Form Handling**: React Hook Form + Zod validation
- **UI Components**: 
  - Custom components styled with Tailwind
  - Optional: shadcn/ui or similar component library

### Backend Integration
- **API Client**: Custom hooks for API calls
- **Real-time**: Supabase Realtime for live updates (optional)
- **Streaming**: Server-Sent Events (SSE) or WebSocket for streaming responses

### Database & Auth
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **ORM/Query Builder**: Supabase JS Client

## Component Architecture

### Core Components

#### 1. ChatWindow Component
```
ChatWindow/
├── ChatWindow.tsx (main container)
├── MessageList.tsx (displays messages)
├── MessageItem.tsx (individual message)
├── MessageInput.tsx (input area)
├── SessionSidebar.tsx (session list)
└── ChatHeader.tsx (session info/actions)
```

#### 2. Authentication Components
```
Auth/
├── LoginForm.tsx
├── SignupForm.tsx
├── PasswordResetForm.tsx
└── AuthGuard.tsx (HOC for protected routes)
```

#### 3. Layout Components
```
Layout/
├── AppLayout.tsx (main app layout)
├── Header.tsx (navigation header)
└── Sidebar.tsx (optional sidebar)
```

#### 4. Profile Components
```
Profile/
├── ProfilePage.tsx
├── ProfileForm.tsx
└── AvatarUpload.tsx
```

## File Structure

```
project-root/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth routes group
│   │   ├── login/
│   │   ├── signup/
│   │   └── reset-password/
│   ├── (dashboard)/              # Protected routes group
│   │   ├── chat/
│   │   │   ├── [sessionId]/
│   │   │   └── page.tsx
│   │   ├── profile/
│   │   └── layout.tsx
│   ├── api/                      # API routes
│   │   ├── chat/
│   │   ├── sessions/
│   │   └── messages/
│   └── layout.tsx
├── components/
│   ├── chat/
│   │   ├── ChatWindow.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageItem.tsx
│   │   ├── MessageInput.tsx
│   │   └── SessionSidebar.tsx
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── SignupForm.tsx
│   │   └── AuthGuard.tsx
│   └── ui/                       # Reusable UI components
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Card.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── types.ts
│   ├── api/
│   │   ├── chat.ts
│   │   ├── sessions.ts
│   │   └── messages.ts
│   └── utils/
│       ├── format.ts
│       └── validation.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useChat.ts
│   ├── useSessions.ts
│   └── useMessages.ts
├── contexts/
│   ├── AuthContext.tsx
│   └── ChatContext.tsx
├── types/
│   ├── chat.ts
│   ├── user.ts
│   └── session.ts
├── styles/
│   └── globals.css
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## Implementation Phases

### Phase 1: Project Setup & Authentication
1. Initialize Next.js project with TypeScript
2. Set up Tailwind CSS with custom color palette
3. Configure Supabase client
4. Implement authentication (signup, login, logout)
5. Create protected route wrapper
6. Set up database schema in Supabase

### Phase 2: Core Chat Interface
1. Build ChatWindow component structure
2. Implement MessageList and MessageItem components
3. Create MessageInput component
4. Add basic message sending/receiving
5. Implement message display with styling
6. Add loading states and error handling

### Phase 3: Session Management
1. Create SessionSidebar component
2. Implement session creation
3. Add session listing and selection
4. Implement session deletion
5. Add session persistence in database
6. Create session context management

### Phase 4: Backend Integration
1. Set up API route handlers in Next.js
2. Implement chat endpoint with LLM integration
3. Add streaming support (if backend supports)
4. Implement error handling and retries
5. Add rate limiting and security measures

### Phase 5: Enhanced Features
1. Add message editing/deletion
2. Implement code block syntax highlighting
3. Add copy message functionality
4. Implement message regeneration
5. Add user feedback (thumbs up/down)
6. Add session search/filter

### Phase 6: User Profile & Polish
1. Create profile page
2. Implement profile editing
3. Add avatar upload
4. Polish UI/UX with animations
5. Add responsive design improvements
6. Implement accessibility features

### Phase 7: Testing & Deployment
1. Write unit tests for components
2. Write integration tests for API routes
3. Test authentication flows
4. Performance optimization
5. Deploy to production
6. Set up monitoring and error tracking

## UI/UX Design Guidelines

### Color Palette
- **Primary (White)**: `#FFFFFF` - Background, cards, main content areas
- **Secondary (Royal Blue)**: `#4169E1` or `#1E3A8A` - Buttons, links, accents, highlights
- **Text Primary**: `#1F2937` or `#111827` - Main text
- **Text Secondary**: `#6B7280` - Secondary text, timestamps
- **Border**: `#E5E7EB` - Borders, dividers
- **Success**: `#10B981` - Success states
- **Error**: `#EF4444` - Error states
- **Warning**: `#F59E0B` - Warning states

### Typography
- **Font Family**: System fonts (Inter, -apple-system, sans-serif)
- **Headings**: Bold, larger sizes
- **Body**: Regular weight, readable line height
- **Code**: Monospace font (Fira Code, JetBrains Mono)

### Spacing & Layout
- Consistent spacing scale (4px base unit)
- Max width for chat container (e.g., 1200px)
- Comfortable padding and margins
- Mobile-first responsive design

### Component Styling Examples

**Chat Window**
- White background with subtle shadow
- Royal blue accent for active states
- Rounded corners (8-12px border radius)
- Smooth transitions and hover effects

**Messages**
- User messages: Right-aligned, royal blue background
- AI messages: Left-aligned, white/gray background with border
- Clear visual distinction between message types
- Timestamp in subtle gray text

**Buttons**
- Primary: Royal blue background, white text
- Secondary: White background, royal blue border and text
- Hover states with slight darkening
- Disabled states with reduced opacity

## Security Considerations

1. **Authentication**: Use Supabase Auth with secure token handling
2. **API Security**: Validate user sessions on all API routes
3. **Input Sanitization**: Sanitize user inputs before sending to LLM
4. **Rate Limiting**: Implement rate limiting on API endpoints
5. **CORS**: Configure proper CORS settings
6. **Environment Variables**: Store sensitive keys in environment variables
7. **SQL Injection**: Use Supabase client (parameterized queries)
8. **XSS Prevention**: Sanitize user-generated content

## Performance Optimization

1. **Code Splitting**: Use Next.js dynamic imports for heavy components
2. **Image Optimization**: Use Next.js Image component
3. **Caching**: Implement proper caching strategies for API calls
4. **Lazy Loading**: Lazy load messages and sessions
5. **Debouncing**: Debounce search and input handlers
6. **Virtualization**: Consider virtual scrolling for long message lists
7. **Bundle Size**: Monitor and optimize bundle size

## Accessibility

1. **Keyboard Navigation**: Full keyboard support
2. **Screen Readers**: Proper ARIA labels and roles
3. **Focus Management**: Clear focus indicators
4. **Color Contrast**: Ensure WCAG AA compliance
5. **Alt Text**: Provide alt text for images
6. **Semantic HTML**: Use proper HTML elements

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Backend API (Flask)
# For local development:
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000
LLM_API_KEY=your_llm_api_key
# For production (Railway): Set this in Vercel environment variables with your Railway backend URL and API key

# App Configuration
NEXT_PUBLIC_APP_URL=your_app_url
```

## Testing Strategy

1. **Unit Tests**: Test individual components and utilities
2. **Integration Tests**: Test API routes and database operations
3. **E2E Tests**: Test complete user flows (Playwright/Cypress)
4. **Accessibility Tests**: Automated accessibility testing
5. **Performance Tests**: Load testing for API endpoints

## Deployment

1. **Hosting**: Vercel (recommended for Next.js) or similar
2. **Database**: Supabase (managed PostgreSQL)
3. **Environment Setup**: Configure environment variables
4. **Domain**: Set up custom domain with SSL
5. **Monitoring**: Set up error tracking (Sentry) and analytics

## Future Enhancements

1. **Multi-modal Support**: Image uploads, file attachments
2. **Voice Input**: Speech-to-text integration
3. **Export Chat**: PDF/Text export functionality
4. **Share Sessions**: Share chat sessions with others
5. **Customization**: User preferences (themes, font sizes)
6. **Plugins/Extensions**: Extend AI capabilities with plugins
7. **Collaboration**: Multi-user chat sessions
8. **Analytics**: User analytics and chat insights

## References

- [AIChatAssistant.tsx Component](https://github.com/sedanonpc/ddcore/blob/main/src/components/AIChatAssistant.tsx) - Reference implementation
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Query Documentation](https://tanstack.com/query/latest)

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Status**: Ready for Implementation

