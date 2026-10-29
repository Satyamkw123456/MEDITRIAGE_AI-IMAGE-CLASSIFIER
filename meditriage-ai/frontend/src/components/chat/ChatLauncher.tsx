'use client';

import React, { useState } from 'react';
import { MessageSquare, Bot, X } from 'lucide-react';
import { ChatPanel } from './ChatPanel';

interface ChatLauncherProps {
  caseId?: number;
}

export const ChatLauncher: React.FC<ChatLauncherProps> = ({ caseId }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Launcher Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close MediTriage Guide' : 'Open MediTriage Guide Chatbot'}
          className="group relative flex items-center gap-2 px-4 py-3 rounded-full bg-primary hover:bg-primary-hover text-surface shadow-md hover:shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {isOpen ? (
            <X className="w-5 h-5 text-surface" />
          ) : (
            <>
              <Bot className="w-5 h-5 text-surface transition-transform group-hover:scale-110" />
              <span className="text-xs font-bold tracking-wide">
                Guide
              </span>
            </>
          )}

          {/* Pulse indicator */}
          {!isOpen && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-selfcare opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-selfcare" />
            </span>
          )}
        </button>
      </div>

      {/* Slide / Pop Chat Panel */}
      <ChatPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        caseId={caseId}
      />
    </>
  );
};

export default ChatLauncher;
