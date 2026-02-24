/**
 * Sidebar.tsx
 *
 * ChatGPT-style navigation sidebar listing all previous chat sessions.
 *
 * Features:
 *  - Sessions grouped by date: Starred → Today → Yesterday → Previous 7/30 Days
 *  - Per-session hover action bar: Star · Rename · Delete
 *  - Inline rename: pencil icon replaces the title with an editable input
 *    (Enter/blur saves · Escape cancels)
 *  - Star toggle: pins the session to the "Starred" group at the top
 *  - Mobile overlay (slides in from left with backdrop) vs. persistent rail on md+
 *
 * Data flow: App.tsx → Sidebar → SessionItem (all session mutations as callbacks)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Session } from '../types/chat';
import { getSessionDateLabel } from '../utils/storage';

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onToggleStarSession: (id: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

/* ── Icons ── */

const PlusIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const TrashIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

const PencilIcon: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const StarIcon: React.FC<{ filled?: boolean }> = ({ filled }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill={filled ? '#f59e0b' : 'none'} stroke={filled ? '#f59e0b' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const ChatIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

/* ── Date grouping ── */

const DATE_ORDER = ['Today', 'Yesterday', 'Previous 7 Days', 'Previous 30 Days'];

function groupByDate(sessions: Session[]): { label: string; items: Session[] }[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const label = getSessionDateLabel(s.updatedAt);
    const arr = map.get(label) ?? [];
    arr.push(s);
    map.set(label, arr);
  }
  return [...map.entries()]
    .sort(([a], [b]) => {
      const ai = DATE_ORDER.indexOf(a);
      const bi = DATE_ORDER.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return 0;
    })
    .map(([label, items]) => ({ label, items }));
}

/* ── Session item ── */

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onRename: (newTitle: string) => void;
  onToggleStar: (e: React.MouseEvent) => void;
}

const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isActive,
  onSelect,
  onDelete,
  onRename,
  onToggleStar,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(session.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync edit value if session title changes externally
  useEffect(() => {
    if (!isEditing) setEditTitle(session.title);
  }, [session.title, isEditing]);

  const startEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(session.title);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [session.title]);

  const commitEdit = useCallback(() => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== session.title) onRename(trimmed);
    setIsEditing(false);
  }, [editTitle, session.title, onRename]);

  const cancelEdit = useCallback(() => {
    setEditTitle(session.title);
    setIsEditing(false);
  }, [session.title]);

  if (isEditing) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isActive ? 'bg-zinc-700/60' : 'bg-zinc-800/60'}`}>
        <span className="flex-shrink-0 text-zinc-500"><ChatIcon /></span>
        <input
          ref={inputRef}
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
            if (e.key === 'Escape') cancelEdit();
          }}
          className="flex-1 min-w-0 bg-zinc-900 border border-zinc-600 rounded px-2 py-0.5 text-xs text-zinc-100 focus:outline-none focus:border-violet-500"
          aria-label="Rename chat"
          maxLength={60}
        />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={e => e.key === 'Enter' && onSelect()}
      aria-current={isActive ? 'page' : undefined}
      className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors duration-150 ${
        isActive
          ? 'bg-zinc-700/60 text-zinc-100'
          : 'text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200'
      }`}
    >
      {/* Star badge (always visible when starred) */}
      {session.starred && (
        <span className="flex-shrink-0 text-amber-400">
          <StarIcon filled />
        </span>
      )}
      {!session.starred && (
        <span className="flex-shrink-0 text-zinc-500"><ChatIcon /></span>
      )}

      <span className="flex-1 truncate text-xs">{session.title || 'New Chat'}</span>

      {/* Action buttons — shown on hover */}
      <div className="flex-shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {/* Star / unstar */}
        <button
          onClick={onToggleStar}
          aria-label={session.starred ? 'Unstar chat' : 'Star chat'}
          title={session.starred ? 'Unstar' : 'Star'}
          className={`p-1 rounded hover:bg-zinc-600/80 transition-colors duration-150 ${session.starred ? 'text-amber-400' : 'text-zinc-400 hover:text-amber-400'}`}
        >
          <StarIcon filled={session.starred} />
        </button>

        {/* Rename */}
        <button
          onClick={startEdit}
          aria-label={`Rename "${session.title}"`}
          title="Rename"
          className="p-1 rounded text-zinc-400 hover:bg-zinc-600/80 hover:text-zinc-200 transition-colors duration-150"
        >
          <PencilIcon />
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          aria-label={`Delete "${session.title}"`}
          title="Delete"
          className="p-1 rounded text-zinc-400 hover:bg-zinc-600/80 hover:text-red-400 transition-colors duration-150"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
};

/* ── Session group ── */

interface GroupProps {
  label: string;
  items: Session[];
  currentSessionId: string | null;
  onSelect: (id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onRename: (id: string, title: string) => void;
  onToggleStar: (e: React.MouseEvent, id: string) => void;
}

const SessionGroup: React.FC<GroupProps> = ({ label, items, currentSessionId, onSelect, onDelete, onRename, onToggleStar }) => (
  <div className="mb-4">
    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest px-3 py-1.5">{label}</p>
    <div className="space-y-0.5">
      {items.map(session => (
        <SessionItem
          key={session.id}
          session={session}
          isActive={session.id === currentSessionId}
          onSelect={() => onSelect(session.id)}
          onDelete={e => onDelete(e, session.id)}
          onRename={title => onRename(session.id, title)}
          onToggleStar={e => onToggleStar(e, session.id)}
        />
      ))}
    </div>
  </div>
);

/* ── Main Sidebar ── */

const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  currentSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onToggleStarSession,
  isOpen,
  onClose,
}) => {
  const starredSessions = sessions.filter(s => s.starred);
  const unstarredSessions = sessions.filter(s => !s.starred);
  const dateGroups = groupByDate(unstarredSessions);

  const handleSelect = useCallback((id: string) => {
    onSelectSession(id);
    onClose();
  }, [onSelectSession, onClose]);

  const handleDelete = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDeleteSession(id);
  }, [onDeleteSession]);

  const handleToggleStar = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onToggleStarSession(id);
  }, [onToggleStarSession]);

  const hasAnySessions = sessions.length > 0;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-20"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Chat history"
        className={`
          fixed md:relative inset-y-0 left-0 z-30
          flex flex-col w-64 flex-shrink-0 h-full
          bg-zinc-900 border-r border-zinc-800/80
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-800/80 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <img src="/cognizant-logo.svg" alt="Cognizant" className="w-7 h-7 flex-shrink-0" />
            <span className="text-sm font-semibold text-zinc-100 tracking-tight">cognizant</span>
          </div>
          <button
            onClick={onNewChat}
            title="New chat"
            aria-label="Start new chat"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors duration-150"
          >
            <PlusIcon />
          </button>
        </div>

        {/* Session list */}
        <nav className="flex-1 overflow-y-auto p-2" aria-label="Previous conversations">
          {!hasAnySessions ? (
            <p className="text-xs text-zinc-600 text-center py-8">No conversations yet</p>
          ) : (
            <>
              {/* Starred section */}
              {starredSessions.length > 0 && (
                <SessionGroup
                  label="Starred"
                  items={starredSessions}
                  currentSessionId={currentSessionId}
                  onSelect={handleSelect}
                  onDelete={handleDelete}
                  onRename={onRenameSession}
                  onToggleStar={handleToggleStar}
                />
              )}

              {/* Date groups (unstarred) */}
              {dateGroups.map(({ label, items }) => (
                <SessionGroup
                  key={label}
                  label={label}
                  items={items}
                  currentSessionId={currentSessionId}
                  onSelect={handleSelect}
                  onDelete={handleDelete}
                  onRename={onRenameSession}
                  onToggleStar={handleToggleStar}
                />
              ))}
            </>
          )}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;
