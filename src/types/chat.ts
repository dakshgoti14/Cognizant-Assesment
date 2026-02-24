/**
 * chat.ts
 *
 * Shared TypeScript interfaces and types for the Cognizant AI Assistant.
 *
 * These types are imported across components, hooks, and services.
 * Keeping them in one file avoids circular dependencies and provides
 * a single source of truth for the data model.
 */

// ─────────────────────────────────────────────────────────────────────────────
// UI Data Model
// ─────────────────────────────────────────────────────────────────────────────

/** The role of a participant in the conversation, used in both UI and API layers */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * Represents a single chat message as stored in application state and localStorage.
 *
 * UI messages are richer than raw API messages — they carry a unique ID,
 * a display timestamp, and an optional error flag for inline error display.
 */
export interface Message {
  /** Unique identifier for the message (generated via `generateId()`) */
  id: string;
  /** Who sent this message */
  role: MessageRole;
  /** The raw text content (markdown for AI messages, plain text for user messages) */
  content: string;
  /** ISO 8601 timestamp of when the message was created */
  timestamp: string;
  /** When `true`, this message is rendered with the error bubble style */
  isError?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// API Data Model — Groq / OpenAI Chat Completions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents a single function/tool call request produced by the model
 * when it decides to invoke the `web_search` tool.
 *
 * The `arguments` field is a JSON string that must be parsed to extract
 * the tool parameters (e.g. `{ "query": "latest AI news" }`).
 */
export interface ToolCall {
  /** Unique ID for this specific tool call, used to correlate the tool result */
  id: string;
  /** Always "function" for the current Groq tool-calling API */
  type: 'function';
  function: {
    /** The name of the function to call (e.g. "web_search") */
    name: string;
    /** JSON-encoded string of the function arguments */
    arguments: string;
  };
}

/**
 * A discriminated union representing the three message shapes accepted by the
 * Groq Chat Completions API. This extends the simpler `MessageRole` model to
 * support the tool-calling flow:
 *
 *  1. `user` / `system`  — Standard messages with a text content string
 *  2. `assistant`        — Can have `content: null` when returning tool calls
 *                          (the model is calling a tool, not generating text)
 *  3. `tool`             — The result message sent back after executing a tool;
 *                          must reference the originating `tool_call_id`
 *
 * Note: `tool` role messages are transient — they only exist inside
 * `sendChatMessage()` and are never stored in session state or localStorage.
 */
export type OpenAIMessage =
  | { role: 'user' | 'system'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: ToolCall[] }
  | { role: 'tool'; content: string; tool_call_id: string };

// ─────────────────────────────────────────────────────────────────────────────
// Session & Prompt Model
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A suggested prompt card shown on the empty-state screen.
 * Clicking a card pre-fills the chat input with the `text` value.
 */
export interface SuggestedPrompt {
  /** Emoji or icon character displayed on the card */
  icon: string;
  /** Short label shown in bold at the top of the card */
  title: string;
  /** The full prompt text that is sent to the AI when the card is clicked */
  text: string;
}

/**
 * A single chat session — the top-level unit of conversation persistence.
 *
 * Sessions are stored as an ordered array in localStorage and displayed in the
 * Sidebar grouped by `updatedAt` date. Each session maintains its own message
 * history, title, and optional star/favourite status.
 */
export interface Session {
  /** Unique session ID (generated via `generateId()`) */
  id: string;
  /**
   * Display title shown in the sidebar.
   * Auto-set from the first user message (truncated to 40 chars).
   * Can be manually renamed via the inline rename UI.
   */
  title: string;
  /** Ordered list of all messages in this session */
  messages: Message[];
  /** ISO 8601 timestamp when the session was created */
  createdAt: string;
  /** ISO 8601 timestamp of the last message — used for sidebar date grouping */
  updatedAt: string;
  /**
   * When `true`, the session is pinned to the "Starred" group at the top of
   * the sidebar. Toggled by the star icon in the session item action bar.
   */
  starred?: boolean;
}
