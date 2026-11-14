// sessions.ts
// in-memory short-lived sessions keyed by userId

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type Session = {
  messages: ChatMessage[];
  expiresAt: number;
  userRequestCount: number;
};

const SESSION_TTL_MS = 5 * 60000; // 5 minutes
const MAX_USER_REQUESTS_PER_SESSION = 5;

const sessions = new Map<string, Session>();

function startNewSession(now: number): Session {
  return {
    messages: [],
    expiresAt: now + SESSION_TTL_MS,
    userRequestCount: 0,
  };
}

export function cleanupExpiredSessions(now: number): void {
  for (const [userId, s] of sessions) {
    if (s.expiresAt <= now) sessions.delete(userId);
  }
}

export function getSessionForRequest(
  userId: string,
  now: number = Date.now(),
): Session {
  const existing = sessions.get(userId);

  // 1) check time expiration first
  if (!existing || existing.expiresAt <= now) {
    const fresh = startNewSession(now);
    sessions.set(userId, fresh);
    return fresh;
  }

  // 2) then check count
  if (existing.userRequestCount >= MAX_USER_REQUESTS_PER_SESSION) {
    const fresh = startNewSession(now);
    sessions.set(userId, fresh);
    return fresh;
  }

  return existing;
}

export function commitSessionAfterResponse(
  userId: string,
  session: Session,
  userPrompt: string,
  assistantReply: string,
  now: number = Date.now(),
): void {
  session.userRequestCount += 1;
  session.expiresAt = now + SESSION_TTL_MS; // sliding ttl
  session.messages = [
    ...session.messages,
    { role: 'user', content: userPrompt },
    { role: 'assistant', content: assistantReply },
  ];

  sessions.set(userId, session);
}
