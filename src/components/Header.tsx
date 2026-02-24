import React from 'react';

interface HeaderProps {
  messageCount: number;
  onClearChat: () => void;
  onToggleSidebar: () => void;
}

const HamburgerIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

const TrashIcon: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
    <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

const Header: React.FC<HeaderProps> = ({ messageCount, onClearChat, onToggleSidebar }) => {
  return (
    <header className="glass-panel border-b border-zinc-800/80 z-10 flex-shrink-0">
      <div className="px-4 sm:px-6 h-14 flex items-center gap-3">

        {/* Hamburger — mobile only (opens sidebar) */}
        <button
          onClick={onToggleSidebar}
          aria-label="Open sidebar"
          className="md:hidden p-1.5 -ml-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors duration-150"
        >
          <HamburgerIcon />
        </button>

        {/* Brand — visible on mobile only (desktop shows it in sidebar) */}
        <div className="md:hidden flex items-center gap-2">
          <img src="/cognizant-logo.svg" alt="Cognizant" className="w-6 h-6" />
          <span className="text-sm font-semibold text-zinc-100 tracking-tight">cognizant</span>
        </div>

        {/* Model badge */}
        <span className="text-xs text-zinc-500 font-medium bg-zinc-800/80 px-2 py-0.5 rounded-full hidden sm:inline-flex">
          Llama 3.3 70B
        </span>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          {messageCount > 0 && (
            <span className="hidden sm:flex text-xs text-zinc-500 items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {messageCount} message{messageCount !== 1 ? 's' : ''}
            </span>
          )}
          {messageCount > 0 && (
            <button
              onClick={onClearChat}
              aria-label="Clear chat"
              className="clear-button flex items-center gap-1.5 text-xs text-zinc-400 border border-zinc-700 rounded-lg px-2.5 py-1.5 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all duration-200"
            >
              <TrashIcon />
              <span className="hidden sm:inline">Clear chat</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
