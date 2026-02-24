import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatContainer from './components/ChatContainer';
import ChatInput from './components/ChatInput';
import { useChat } from './hooks/useChat';

const App: React.FC = () => {
  const {
    sessions,
    currentSessionId,
    messages,
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
  } = useChat();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState('');

  const handleSuggestedPrompt = useCallback((text: string) => {
    setPendingPrompt(text);
  }, []);

  const handleInitialValueConsumed = useCallback(() => {
    setPendingPrompt('');
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    switchSession(id);
    setPendingPrompt('');
  }, [switchSession]);

  return (
    <div className="flex h-dvh bg-zinc-950 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={createNewSession}
        onSelectSession={handleSelectSession}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        onToggleStarSession={toggleStarSession}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          messageCount={messages.length}
          onClearChat={clearCurrentSession}
          onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        />

        {/* Force remount on session switch to reset scroll position */}
        <ChatContainer
          key={currentSessionId ?? 'empty'}
          messages={messages}
          isLoading={isLoading}
          chatStatus={chatStatus}
          onSuggestedPrompt={handleSuggestedPrompt}
          messagesEndRef={messagesEndRef}
        />

        <ChatInput
          onSend={sendMessage}
          isLoading={isLoading}
          initialValue={pendingPrompt}
          onInitialValueConsumed={handleInitialValueConsumed}
        />
      </div>
    </div>
  );
};

export default App;
