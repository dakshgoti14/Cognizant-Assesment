/**
 * ChatContainer.tsx
 *
 * The scrollable message area — the main content region of the chat interface.
 *
 * Responsibilities:
 *  - Renders the ordered list of `ChatMessage` bubbles for the active session
 *  - Shows the `EmptyState` screen (suggested prompts) when there are no messages
 *  - Shows the `TypingIndicator` while the AI is responding
 *  - The indicator is status-aware:
 *      · "thinking" → animated bouncing dots (AI processing)
 *      · "searching" → globe icon + "Searching the web…" pulse (Tavily search in progress)
 *  - Shows a floating "Scroll to Bottom" button when the user scrolls up past 200 px
 *  - `key={currentSessionId}` in App.tsx forces a full remount on session switch,
 *    resetting scroll position cleanly without manual ref manipulation
 */

import React, { useEffect, useRef, useState } from 'react';
import type { Message, SuggestedPrompt } from '../types/chat';
import ChatMessage from './ChatMessage';

interface ChatContainerProps {
  messages: Message[];
  isLoading: boolean;
  chatStatus: 'idle' | 'thinking' | 'searching';
  onSuggestedPrompt: (text: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

/* ── Suggested Prompts ──────────────────────────────────── */

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    icon: '💡',
    title: 'Explain a concept',
    text: 'Explain quantum computing in simple terms a beginner can understand.',
  },
  {
    icon: '🐍',
    title: 'Write code',
    text: 'Write a Python function that implements binary search with type hints.',
  },
  {
    icon: '🏗️',
    title: 'Architecture advice',
    text: 'What are the key principles of clean architecture in modern web apps?',
  },
  {
    icon: '🔍',
    title: 'Debug help',
    text: 'What are common causes of memory leaks in React applications and how to fix them?',
  },
];

/* ── Loading / Typing Indicator ─────────────────────────── */

const TypingIndicator: React.FC<{ status: 'thinking' | 'searching' }> = ({ status }) => {
  const isSearching = status === 'searching';
  return (
    <div
      className="message-container flex gap-3 px-4 sm:px-6 py-2"
      aria-label={isSearching ? 'AI is searching the web' : 'AI is typing'}
      role="status"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-xl avatar-ai flex items-center justify-center mt-0.5" aria-hidden="true">
        {isSearching ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L13.09 8.26L19 7L14.74 11.26L21 12L14.74 12.74L19 17L13.09 15.74L12 22L10.91 15.74L5 17L9.26 12.74L3 12L9.26 11.26L5 7L10.91 8.26L12 2Z"
              fill="url(#typing-gradient)"
            />
            <defs>
              <linearGradient id="typing-gradient" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
            </defs>
          </svg>
        )}
      </div>
      <div className="flex flex-col gap-1 items-start">
        <span className="text-[11px] font-medium text-zinc-500">Cognizant AI</span>
        <div className="ai-bubble rounded-2xl rounded-tl-sm px-4 py-3.5 flex items-center gap-1.5">
          {isSearching ? (
            <span className="text-xs text-blue-400 font-medium animate-pulse">Searching the web…</span>
          ) : (
            <>
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-400 animate-[typingBounce_1.4s_ease-in-out_infinite]" style={{ animationDelay: '0ms' }} />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-400 animate-[typingBounce_1.4s_ease-in-out_infinite]" style={{ animationDelay: '160ms' }} />
              <span className="typing-dot w-1.5 h-1.5 rounded-full bg-zinc-400 animate-[typingBounce_1.4s_ease-in-out_infinite]" style={{ animationDelay: '320ms' }} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Empty State ────────────────────────────────────────── */

const EmptyState: React.FC<{ onSelect: (text: string) => void }> = ({ onSelect }) => (
  <div className="flex flex-col items-center justify-center h-full px-4 py-12 animate-fade-in">
    {/* Hero */}
    <div className="mb-8 flex flex-col items-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center shadow-lg shadow-blue-900/30">
        <img src="/cognizant-logo.svg" alt="Cognizant" className="w-10 h-10" />
      </div>

      <div className="text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100 tracking-tight mb-2">
          How can I help you today?
        </h2>
        <p className="text-sm text-zinc-500 max-w-sm text-balance">
          Ask me anything — from coding and debugging to explanations,
          writing, and analysis.
        </p>
      </div>
    </div>

    {/* Suggested prompts */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
      {SUGGESTED_PROMPTS.map((prompt) => (
        <button
          key={prompt.title}
          onClick={() => onSelect(prompt.text)}
          className="suggestion-card text-left rounded-xl p-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          aria-label={`Use suggested prompt: ${prompt.title}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none mt-0.5" aria-hidden="true">
              {prompt.icon}
            </span>
            <div>
              <p className="text-xs font-semibold text-zinc-300 mb-1">{prompt.title}</p>
              <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
                {prompt.text}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>

    {/* Hint */}
    <p className="mt-8 text-xs text-zinc-600 flex items-center gap-1.5">
      <span>Press</span>
      <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 font-mono text-[10px]">Enter</kbd>
      <span>to send ·</span>
      <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 font-mono text-[10px]">Shift</kbd>
      <span>+</span>
      <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-zinc-400 font-mono text-[10px]">Enter</kbd>
      <span>for new line</span>
    </p>
  </div>
);

/* ── Scroll to Bottom Button ────────────────────────────── */

const ScrollToBottomButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="scroll-btn absolute bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-all duration-200 animate-scale-in"
    aria-label="Scroll to latest message"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12l7 7 7-7" />
    </svg>
  </button>
);

/* ── Main Component ─────────────────────────────────────── */

const ChatContainer: React.FC<ChatContainerProps> = ({
  messages,
  isLoading,
  chatStatus,
  onSuggestedPrompt,
  messagesEndRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Show "scroll to bottom" button when user scrolls up
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setShowScrollBtn(distanceFromBottom > 200);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        className="h-full overflow-y-auto"
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
      >
        <div className="max-w-4xl mx-auto">
          {isEmpty ? (
            <EmptyState onSelect={onSuggestedPrompt} />
          ) : (
            <div className="py-4 space-y-1">
              {messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isLatest={index === messages.length - 1}
                />
              ))}

              {isLoading && <TypingIndicator status={chatStatus === 'searching' ? 'searching' : 'thinking'} />}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} className="h-4" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && <ScrollToBottomButton onClick={scrollToBottom} />}
    </div>
  );
};

export default ChatContainer;
