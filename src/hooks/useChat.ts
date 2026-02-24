/**
 * useChat.ts
 *
 * Central state-management hook for the Cognizant AI Assistant.
 *
 * Owns all session and message state, exposes actions for the UI,
 * and orchestrates the full request lifecycle:
 *  1. Optimistic UI update (user message added immediately)
 *  2. API call with conversation history
 *  3. AI response appended to the session on success
 *  4. Error message appended (with `isError` flag) on failure
 *  5. `chatStatus` updated throughout for granular loading indicators
 *
 * Sessions are persisted to localStorage via `storage.ts` on every
 * state change. A `hasLoaded` ref guards against overwriting stored
 * data before the initial load `useEffect` has run.
 *
 * No external state library (Redux, Zustand) is required — React's
 * built-in `useState` + `useCallback` is sufficient for this scope.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Message, OpenAIMessage, Session } from '../types/chat';
import { sendChatMessage } from '../services/openai';
import { loadSessions, saveSessions, generateId } from '../utils/storage';

/** Creates a blank Session object with a generated ID and the current timestamp */
function createEmptySession(): Session {
  const now = new Date().toISOString();
  return { id: generateId(), title: 'New Chat', messages: [], createdAt: now, updatedAt: now };
}

interface UseChatReturn {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Message[];
  isLoading: boolean;
  chatStatus: 'idle' | 'thinking' | 'searching';
  sendMessage: (content: string) => Promise<void>;
  createNewSession: () => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, newTitle: string) => void;
  toggleStarSession: (id: string) => void;
  clearCurrentSession: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

export function useChat(): UseChatReturn {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chatStatus, setChatStatus] = useState<'idle' | 'thinking' | 'searching'>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasLoaded = useRef(false);

  const currentMessages = sessions.find(s => s.id === currentSessionId)?.messages ?? [];

  // Load sessions on mount
  useEffect(() => {
    const stored = loadSessions();
    if (stored.length > 0) {
      setSessions(stored);
      setCurrentSessionId(stored[0].id);
    } else {
      const fresh = createEmptySession();
      setSessions([fresh]);
      setCurrentSessionId(fresh.id);
    }
    hasLoaded.current = true;
  }, []);

  // Persist sessions whenever they change (but not on initial empty state)
  useEffect(() => {
    if (!hasLoaded.current) return;
    saveSessions(sessions);
  }, [sessions]);

  // Auto-scroll to latest message
  useEffect(() => {
    const el = messagesEndRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
    return () => cancelAnimationFrame(raf);
  }, [currentMessages, isLoading]);

  /**
   * Creates a new blank session and switches to it.
   * No-ops if the current session already has zero messages to prevent
   * accumulation of empty sessions when the user clicks "New Chat" repeatedly.
   */
  const createNewSession = useCallback(() => {
    // If current session is already empty, just stay on it
    const current = sessions.find(s => s.id === currentSessionId);
    if (current && current.messages.length === 0) return;

    const fresh = createEmptySession();
    setSessions(prev => [fresh, ...prev]);
    setCurrentSessionId(fresh.id);
  }, [sessions, currentSessionId]);

  const switchSession = useCallback((id: string) => {
    setCurrentSessionId(id);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) {
        const fresh = createEmptySession();
        setCurrentSessionId(fresh.id);
        return [fresh];
      }
      if (id === currentSessionId) {
        setCurrentSessionId(filtered[0].id);
      }
      return filtered;
    });
  }, [currentSessionId]);

  /** Renames a session. Trims whitespace; ignores empty strings. */
  const renameSession = useCallback((id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setSessions(prev => prev.map(s =>
      s.id === id ? { ...s, title: trimmed } : s
    ));
  }, []);

  /** Toggles the `starred` flag on a session, pinning/unpinning it in the sidebar */
  const toggleStarSession = useCallback((id: string) => {
    setSessions(prev => prev.map(s =>
      s.id === id ? { ...s, starred: !s.starred } : s
    ));
  }, []);

  const clearCurrentSession = useCallback(() => {
    if (!window.confirm('Are you sure you want to clear this chat?')) return;
    setSessions(prev => prev.map(s =>
      s.id === currentSessionId
        ? { ...s, messages: [], title: 'New Chat', updatedAt: new Date().toISOString() }
        : s
    ));
  }, [currentSessionId]);

  /**
   * Sends a user message, triggers the AI response, and updates session state.
   *
   * Flow:
   *  1. Validates and trims the input; bails early if loading or empty
   *  2. Builds the API history from current non-error messages (before state update
   *     to avoid stale closure issues with async setState)
   *  3. Adds the user message and auto-titles new sessions optimistically
   *  4. Calls `sendChatMessage()` with the history and a status callback
   *  5. On success: appends the AI response to the session
   *  6. On failure: appends an error message with `isError: true`
   *  7. Always resets `isLoading` and `chatStatus` in the finally block
   */
  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!currentSessionId || !trimmed || isLoading) return;

    const sessionId = currentSessionId;
    const now = new Date().toISOString();

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: now,
    };

    // Build API history BEFORE state update (captures current messages correctly)
    const apiHistory: OpenAIMessage[] = [
      ...currentMessages.filter(m => !m.isError).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: trimmed },
    ];

    setIsLoading(true);
    setChatStatus('thinking');

    // Add user message + auto-title from first message
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      const isFirst = !s.messages.some(m => m.role === 'user');
      return {
        ...s,
        messages: [...s.messages, userMessage],
        title: isFirst ? trimmed.slice(0, 40) : s.title,
        updatedAt: now,
      };
    }));

    try {
      const responseText = await sendChatMessage(apiHistory, setChatStatus);
      const aiMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toISOString(),
      };
      setSessions(prev => prev.map(s =>
        s.id === sessionId
          ? { ...s, messages: [...s.messages, aiMessage], updatedAt: new Date().toISOString() }
          : s
      ));
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'An unexpected error occurred.';
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: errorText,
        timestamp: new Date().toISOString(),
        isError: true,
      };
      setSessions(prev => prev.map(s =>
        s.id === sessionId
          ? { ...s, messages: [...s.messages, errorMessage], updatedAt: new Date().toISOString() }
          : s
      ));
    } finally {
      setIsLoading(false);
      setChatStatus('idle');
    }
  }, [currentSessionId, currentMessages, isLoading]);

  return {
    sessions,
    currentSessionId,
    messages: currentMessages,
    isLoading,
    chatStatus,
    sendMessage,
    createNewSession,
    switchSession,
    deleteSession,
    renameSession,
    toggleStarSession,
    clearCurrentSession,
    messagesEndRef,
  };
}
