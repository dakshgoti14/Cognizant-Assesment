/**
 * ChatMessage.tsx
 *
 * Renders a single chat message bubble for both user and AI messages.
 *
 * Highlights:
 *  - User bubbles: gradient background, right-aligned, plain pre-wrap text
 *  - AI bubbles: dark background, left-aligned, full markdown rendering
 *  - Error bubbles: red-tinted with an alert icon for inline error display
 *  - Hover-reveal "Copy" button on AI messages (uses Clipboard API)
 *  - Relative timestamp shown below each bubble, full date on hover
 *
 * Markdown renderer (no external library):
 *  Handles fenced code blocks (with language label + copy button),
 *  inline `code`, **bold**, *italic*, [links](url), H1–H3 headings,
 *  unordered/ordered lists, blockquotes, and horizontal rules.
 *  The renderer is intentionally lightweight — parsing is line-by-line
 *  which keeps the bundle small and avoids XSS risks from innerHTML.
 */

import React, { useState, useCallback } from 'react';
import type { Message } from '../types/chat';
import { formatTimestamp } from '../utils/storage';

interface ChatMessageProps {
  message: Message;
  isLatest?: boolean;
}

/* ── Icons ──────────────────────────────────────────────── */

const UserIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
  </svg>
);

const AIIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 2L13.09 8.26L19 7L14.74 11.26L21 12L14.74 12.74L19 17L13.09 15.74L12 22L10.91 15.74L5 17L9.26 12.74L3 12L9.26 11.26L5 7L10.91 8.26L12 2Z"
      fill="url(#ai-icon-gradient)"
    />
    <defs>
      <linearGradient id="ai-icon-gradient" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#a78bfa" />
        <stop offset="100%" stopColor="#60a5fa" />
      </linearGradient>
    </defs>
  </svg>
);

const CopyIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const AlertIcon: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

/* ── Markdown Renderer ──────────────────────────────────── */

interface CodeBlockProps {
  lang: string;
  code: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ lang, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  return (
    <div className="code-block my-3 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <span className="text-xs text-zinc-500 font-mono">{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors duration-150 px-2 py-0.5 rounded"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <CheckIcon />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <CopyIcon />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-zinc-300 text-[0.8125rem] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};

/** Render inline markdown: `code`, **bold**, *italic*, [link](url) */
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={idx} className="inline-code">{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={idx} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={idx} className="italic">{part.slice(1, -1)}</em>;
    }
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={idx} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline underline-offset-2 hover:text-blue-300 transition-colors">
          {linkMatch[1]}
        </a>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/** Render a text segment (no code fences) as structured markdown blocks */
function renderTextSegment(text: string, segIdx: number): React.ReactNode {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Empty line — skip (paragraph spacing handled by CSS margin)
    if (line.trim() === '') { i++; continue; }

    // Headings
    const h3 = line.match(/^### (.+)$/);
    const h2 = line.match(/^## (.+)$/);
    const h1 = line.match(/^# (.+)$/);
    if (h1) {
      nodes.push(<h1 key={`${segIdx}-h-${i}`} className="text-xl font-bold mt-5 mb-2 leading-snug">{renderInline(h1[1])}</h1>);
      i++; continue;
    }
    if (h2) {
      nodes.push(<h2 key={`${segIdx}-h-${i}`} className="text-lg font-semibold mt-4 mb-1.5 leading-snug">{renderInline(h2[1])}</h2>);
      i++; continue;
    }
    if (h3) {
      nodes.push(<h3 key={`${segIdx}-h-${i}`} className="text-base font-semibold mt-3 mb-1 leading-snug">{renderInline(h3[1])}</h3>);
      i++; continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      nodes.push(<hr key={`${segIdx}-hr-${i}`} className="border-zinc-700 my-3" />);
      i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      nodes.push(
        <blockquote key={`${segIdx}-bq-${i}`} className="border-l-2 border-violet-500 pl-3 my-2 opacity-75 italic text-sm">
          {quoteLines.map((ql, qi) => (
            <React.Fragment key={qi}>{qi > 0 && <br />}{renderInline(ql)}</React.Fragment>
          ))}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (/^[-*+] /.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-*+] /.test(lines[i])) {
        items.push(
          <li key={i} className="leading-relaxed">{renderInline(lines[i].replace(/^[-*+] /, ''))}</li>
        );
        i++;
      }
      nodes.push(
        <ul key={`${segIdx}-ul-${i}`} className="list-disc pl-5 my-2 space-y-0.5">{items}</ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\. /.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(
          <li key={i} className="leading-relaxed">{renderInline(lines[i].replace(/^\d+\. /, ''))}</li>
        );
        i++;
      }
      nodes.push(
        <ol key={`${segIdx}-ol-${i}`} className="list-decimal pl-5 my-2 space-y-0.5">{items}</ol>
      );
      continue;
    }

    // Regular paragraph — collect consecutive plain lines
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^#{1,3} /.test(lines[i]) &&
      !/^[-*+] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i]) &&
      !lines[i].startsWith('> ') &&
      !/^[-*_]{3,}$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      nodes.push(
        <p key={`${segIdx}-p-${i}`} className="mb-2 last:mb-0 leading-relaxed">
          {paraLines.map((pl, pi) => (
            <React.Fragment key={pi}>
              {pi > 0 && <br />}
              {renderInline(pl)}
            </React.Fragment>
          ))}
        </p>
      );
    }
  }

  return nodes;
}

function renderContent(content: string): React.ReactNode {
  // Split on triple-backtick fenced code blocks
  const segments = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="prose-chat space-y-1">
      {segments.map((segment, idx) => {
        if (segment.startsWith('```')) {
          const match = segment.match(/^```(\w*)\n?([\s\S]*?)```$/s);
          const lang = match?.[1]?.trim() ?? '';
          const code = (match?.[2] ?? segment.slice(3, -3)).trim();
          return <CodeBlock key={idx} lang={lang} code={code} />;
        }
        return <React.Fragment key={idx}>{renderTextSegment(segment, idx)}</React.Fragment>;
      })}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────── */

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isLatest }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isError = message.isError === true;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  }, [message.content]);

  return (
    <div
      className={`message-container flex gap-3 px-4 sm:px-6 py-2 ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      } ${isLatest ? '' : ''}`}
      role="article"
      aria-label={`${isUser ? 'You' : 'AI'}: ${message.content.slice(0, 50)}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5 ${
          isUser ? 'avatar-user text-white' : 'avatar-ai text-violet-400'
        }`}
        aria-hidden="true"
      >
        {isUser ? <UserIcon /> : <AIIcon />}
      </div>

      {/* Message wrapper */}
      <div
        className={`message-wrapper flex flex-col gap-1 max-w-[85%] sm:max-w-[78%] ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        {/* Sender label */}
        <span className="text-[11px] font-medium text-zinc-500 px-1">
          {isUser ? 'You' : 'Cognizant AI'}
        </span>

        {/* Bubble */}
        <div className="relative group">
          <div
            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              isUser
                ? 'user-bubble text-white rounded-tr-sm'
                : isError
                ? 'error-bubble text-red-300 rounded-tl-sm'
                : 'ai-bubble text-zinc-100 rounded-tl-sm'
            }`}
          >
            {isError && (
              <div className="flex items-center gap-1.5 text-red-400 text-xs mb-1.5 font-medium">
                <AlertIcon />
                <span>Error</span>
              </div>
            )}
            {isUser ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : (
              renderContent(message.content)
            )}
          </div>

          {/* Copy button (AI messages only, appears on hover) */}
          {!isUser && !isError && (
            <button
              onClick={handleCopy}
              className="copy-button absolute -bottom-6 right-0 flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-all duration-150 bg-zinc-900 border border-zinc-800 rounded-md px-2 py-0.5"
              aria-label="Copy response"
            >
              {copied ? (
                <>
                  <CheckIcon />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <CopyIcon />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Timestamp */}
        <time
          dateTime={message.timestamp}
          className="text-[11px] text-zinc-600 px-1 mt-1"
          title={new Date(message.timestamp).toLocaleString()}
        >
          {formatTimestamp(message.timestamp)}
        </time>
      </div>
    </div>
  );
};

export default ChatMessage;
