import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
  initialValue?: string;
  onInitialValueConsumed?: () => void;
}

const SendIcon: React.FC<{ isLoading: boolean }> = ({ isLoading }) => {
  if (isLoading) {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-spin"
        aria-hidden="true"
      >
        <path d="M21 12a9 9 0 11-6.219-8.56" />
      </svg>
    );
  }

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22l-4-9-9-4 19-7z" />
    </svg>
  );
};

const MAX_CHARS = 4000;
const MIN_HEIGHT = 52;
const MAX_HEIGHT = 200;

const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  isLoading,
  initialValue = '',
  onInitialValueConsumed,
}) => {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle pre-filled value from suggested prompts
  useEffect(() => {
    if (initialValue) {
      setValue(initialValue);
      onInitialValueConsumed?.();
      // Auto-resize and focus
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT)}px`;
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
      });
    }
  }, [initialValue, onInitialValueConsumed]);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, MIN_HEIGHT), MAX_HEIGHT)}px`;
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newVal = e.target.value;
      if (newVal.length > MAX_CHARS) return;
      setValue(newVal);
      autoResize();
    },
    [autoResize]
  );

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setValue('');
    // Reset height
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = `${MIN_HEIGHT}px`;
      ta.focus();
    }
  }, [value, isLoading, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const charCount = value.length;
  const isNearLimit = charCount > MAX_CHARS * 0.85;
  const isOverLimit = charCount >= MAX_CHARS;
  const canSend = value.trim().length > 0 && !isLoading && !isOverLimit;

  return (
    <div className="glass-panel border-t border-zinc-800/80 flex-shrink-0">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
        {/* Input wrapper */}
        <div
          className={`relative flex items-end gap-3 rounded-2xl border transition-all duration-200 ${
            isOverLimit
              ? 'border-red-500/50 bg-red-500/5'
              : 'border-zinc-700 bg-zinc-800/60 focus-within:border-violet-500/60 focus-within:bg-zinc-800/80'
          }`}
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)' }}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Message NeuralChat..."
            disabled={isLoading}
            rows={1}
            aria-label="Message input"
            aria-multiline="true"
            aria-disabled={isLoading}
            className="chat-textarea flex-1 pl-4 pr-2 py-3.5 min-h-[52px] max-h-[200px] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ height: `${MIN_HEIGHT}px` }}
          />

          {/* Send button */}
          <div className="flex items-center pr-2 pb-2 gap-2">
            {/* Character count (only near limit) */}
            {isNearLimit && (
              <span
                className={`text-[11px] font-mono tabular-nums ${
                  isOverLimit ? 'text-red-400' : 'text-zinc-500'
                }`}
                aria-live="polite"
                aria-label={`${charCount} of ${MAX_CHARS} characters`}
              >
                {charCount}/{MAX_CHARS}
              </span>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSend}
              className="send-button w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              aria-label={isLoading ? 'Sending message...' : 'Send message'}
            >
              <SendIcon isLoading={isLoading} />
            </button>
          </div>
        </div>

        {/* Footer hint */}
        <p className="mt-2.5 text-center text-[11px] text-zinc-600">
          <span>
            <kbd className="font-mono">Enter</kbd> to send ·{' '}
            <kbd className="font-mono">Shift+Enter</kbd> for new line
          </span>
          <span className="mx-2">·</span>
          <span>AI can make mistakes — verify important information</span>
        </p>
      </div>
    </div>
  );
};

export default ChatInput;
