/**
 * Anonymous Session Management
 * Browser-based session tracking for emergency/unauthenticated users
 */

const ANONYMOUS_SESSION_KEY = 'aeris_anonymous_session_id'
const SESSION_EXPIRY_DAYS = 30

/**
 * Get or create anonymous session ID from localStorage
 * Persists across page refreshes, unique per browser
 */
export function getAnonymousSessionId(): string {
  if (typeof window === 'undefined') {
    return ''
  }

  let sessionId = localStorage.getItem(ANONYMOUS_SESSION_KEY)
  
  if (!sessionId) {
    sessionId = crypto.randomUUID()
    localStorage.setItem(ANONYMOUS_SESSION_KEY, sessionId)
    localStorage.setItem(
      `${ANONYMOUS_SESSION_KEY}_expires`,
      (Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toString()
    )
  } else {
    // Check expiration
    const expires = localStorage.getItem(`${ANONYMOUS_SESSION_KEY}_expires`)
    if (expires && Date.now() > parseInt(expires)) {
      sessionId = crypto.randomUUID()
      localStorage.setItem(ANONYMOUS_SESSION_KEY, sessionId)
      localStorage.setItem(
        `${ANONYMOUS_SESSION_KEY}_expires`,
        (Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toString()
      )
    }
  }

  return sessionId
}

/**
 * Clear anonymous session (when user logs in)
 */
export function clearAnonymousSession(): void {
  if (typeof window === 'undefined') return
  
  localStorage.removeItem(ANONYMOUS_SESSION_KEY)
  localStorage.removeItem(`${ANONYMOUS_SESSION_KEY}_expires`)
}

/**
 * Get client IP from request headers
 */
export function getClientIP(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  return realIP || null
}

