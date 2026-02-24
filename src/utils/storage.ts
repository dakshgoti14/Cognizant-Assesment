/**
 * storage.ts
 *
 * All localStorage I/O for the Cognizant AI Assistant.
 * Centralising persistence here keeps the rest of the codebase
 * free of raw localStorage calls and makes it easy to swap the
 * storage layer (e.g. IndexedDB, a backend) in the future.
 *
 * Responsibilities:
 *  - Save / load the full Session[] array (multi-session support)
 *  - Migrate legacy flat-message arrays from the v1 storage schema
 *  - Guard against malformed / corrupted data with runtime validators
 *  - Provide shared utilities: ID generation, timestamp formatting,
 *    and sidebar date-group labels
 */

import type { Message, Session } from '../types/chat';

/** localStorage key for the current sessions schema (v2) */
const SESSIONS_KEY = 'neural_chat_sessions';

/** localStorage key used by the legacy single-session schema (v1) */
const LEGACY_KEY   = 'neural_chat_history';

/** Maximum number of sessions kept in localStorage to prevent unbounded growth */
const MAX_SESSIONS = 50;

// ─────────────────────────────────────────────────────────────────────────────
// ID & Timestamp Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a unique, collision-resistant string ID.
 * Combines the current timestamp with a random base-36 suffix.
 *
 * @returns A string like "1714000000000-a3z9k1b"
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Formats an ISO timestamp string into a human-readable relative time label.
 *
 * Examples:
 *  - "Just now"   (< 1 minute ago)
 *  - "5m ago"     (< 1 hour ago)
 *  - "14:30"      (same day, older than 1 hour)
 *  - "Apr 3, 09:15"  (older than 24 hours)
 *
 * @param isoString - An ISO 8601 date string (e.g. from `new Date().toISOString()`)
 * @returns A user-friendly relative or absolute timestamp string
 */
export function formatTimestamp(isoString: string): string {
  const date     = new Date(isoString);
  const now      = new Date();
  const diffMs   = now.getTime() - date.getTime();
  const diffMins  = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffMins < 1)   return 'Just now';
  if (diffMins < 60)  return `${diffMins}m ago`;
  if (diffHours < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Returns the sidebar date-group label for a given session's `updatedAt` timestamp.
 * Used by the Sidebar component to group sessions under headings like "Today".
 *
 * Labels (in priority order):
 *  "Today" → "Yesterday" → "Previous 7 Days" → "Previous 30 Days" → "Month Year"
 *
 * @param isoString - The session's `updatedAt` ISO 8601 string
 * @returns A human-readable group label string
 */
export function getSessionDateLabel(isoString: string): string {
  const date     = new Date(isoString);
  const now      = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7)  return 'Previous 7 Days';
  if (diffDays <= 30) return 'Previous 30 Days';
  return date.toLocaleDateString([], { month: 'long', year: 'numeric' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Type Guards
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runtime type guard — validates that a raw parsed value conforms to the
 * `Message` interface before it is trusted and used by the application.
 * Silently drops malformed messages rather than crashing.
 */
function isValidMessage(m: unknown): m is Message {
  return (
    typeof m === 'object' && m !== null &&
    typeof (m as Message).id        === 'string' &&
    typeof (m as Message).role      === 'string' &&
    typeof (m as Message).content   === 'string' &&
    typeof (m as Message).timestamp === 'string'
  );
}

/**
 * Runtime type guard — validates that a raw parsed value conforms to the
 * `Session` interface. Invalid sessions are silently filtered out on load.
 */
function isValidSession(s: unknown): s is Session {
  return (
    typeof s === 'object' && s !== null &&
    typeof (s as Session).id        === 'string' &&
    typeof (s as Session).title     === 'string' &&
    Array.isArray((s as Session).messages) &&
    typeof (s as Session).createdAt === 'string' &&
    typeof (s as Session).updatedAt === 'string'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session Persistence
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Serialises the session array to localStorage.
 * Silently truncates to MAX_SESSIONS (50) to prevent unbounded storage growth.
 * Write errors are logged as warnings but never thrown — a persistence failure
 * should not crash the application.
 *
 * @param sessions - The full in-memory Session[] array from useChat state
 */
export function saveSessions(sessions: Session[]): void {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch (err) {
    console.warn('[Cognizant] Failed to persist sessions:', err);
  }
}

/**
 * Loads and deserialises sessions from localStorage.
 *
 * Strategy (in order):
 * 1. Read the current v2 schema (`SESSIONS_KEY`). If valid sessions exist, return them.
 * 2. Detect the legacy v1 schema (`LEGACY_KEY`, a flat Message[] array). If found,
 *    migrate it to a single Session and save in v2 format, then delete the legacy key.
 * 3. Return an empty array if nothing is found or if parsing fails.
 *
 * All data is validated at runtime via `isValidSession` / `isValidMessage`
 * so corrupted entries are silently dropped rather than propagated.
 *
 * @returns An array of Session objects, or [] if storage is empty / corrupt
 */
export function loadSessions(): Session[] {
  try {
    // ── v2 schema ──────────────────────────────────────────
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const sessions = parsed
          .filter(isValidSession)
          .map(s => ({ ...s, messages: s.messages.filter(isValidMessage) }));
        if (sessions.length > 0) return sessions;
      }
    }

    // ── v1 → v2 migration ─────────────────────────────────
    // The original schema stored a flat array of messages under LEGACY_KEY.
    // We wrap it in a Session object and re-save under the new key.
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (legacyRaw) {
      const parsed: unknown = JSON.parse(legacyRaw);
      if (Array.isArray(parsed)) {
        const messages  = parsed.filter(isValidMessage);
        if (messages.length > 0) {
          const firstUser = messages.find(m => m.role === 'user');
          const session: Session = {
            id:        generateId(),
            title:     firstUser ? firstUser.content.slice(0, 40) : 'Previous Chat',
            messages,
            createdAt: messages[0].timestamp,
            updatedAt: messages[messages.length - 1].timestamp,
          };
          localStorage.removeItem(LEGACY_KEY); // Clean up old key
          saveSessions([session]);
          return [session];
        }
      }
    }
  } catch {
    // JSON.parse or unexpected errors — return empty to start fresh
  }
  return [];
}

/**
 * Removes all Cognizant AI session data from localStorage.
 * Clears both the current v2 key and the legacy v1 key.
 * Called by the "Clear all" action (if wired up) or for testing purposes.
 */
export function clearAllSessions(): void {
  try {
    localStorage.removeItem(SESSIONS_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* ignore — nothing to clear */ }
}
