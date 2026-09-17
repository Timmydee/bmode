const STORAGE_KEY_PREFIX = "game-night:participant-token:";

export function getParticipantToken(sessionId: string): string {
  const key = STORAGE_KEY_PREFIX + sessionId;
  const existing = localStorage.getItem(key);
  if (existing) return existing;

  const token = crypto.randomUUID();
  localStorage.setItem(key, token);
  return token;
}

export function clearParticipantToken(sessionId: string): void {
  localStorage.removeItem(STORAGE_KEY_PREFIX + sessionId);
}
