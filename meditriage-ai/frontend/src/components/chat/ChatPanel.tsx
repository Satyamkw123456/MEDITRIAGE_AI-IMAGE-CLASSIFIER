'use client';

import React, { useEffect } from 'react';
import { 
  X, 
  RotateCcw, 
  Bot, 
  WifiOff, 
  Sparkles, 
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { useChat } from '@/lib/chat/useChat';
import { MessageList } from './MessageList';
import { Composer } from './Composer';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  caseId?: number;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose, caseId }) => {
  const locale = useLocale();
  const { messages, status, isOnline, sendMessage, clearChat } = useChat(caseId);

  // Esc key closes panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="MediTriage Guide Chat"
      className="fixed inset-0 z-50 sm:inset-auto sm:right-6 sm:bottom-20 sm:w-[400px] sm:h-[620px] flex flex-col justify-end sm:justify-start"
    >
      {/* Mobile Backdrop Overlay */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-ink/40 sm:hidden backdrop-blur-xs"
        aria-hidden="true"
      />

      {/* Main Panel Container */}
      <div className="relative w-full h-[85vh] sm:h-full bg-surface/98 rounded-t-3xl sm:rounded-2xl border border-line shadow-popover flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Glass Header */}
        <header className="glass px-4 py-3 border-b border-line flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary-soft text-primary flex items-center justify-center shrink-0 border border-primary/20">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-heading font-bold text-sm text-ink leading-tight">
                  MediTriage Guide
                </h3>
                <span className="w-2 h-2 rounded-full bg-selfcare" title="Operational" />
              </div>
              <span className="text-[10px] text-muted block">
                {!isOnline ? 'Offline Help' : 'Built-in Help & Support'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={clearChat}
              className="p-1.5 text-muted hover:text-ink hover:bg-bg rounded-lg transition"
              title="Reset conversation"
              aria-label="Start new chat"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-muted hover:text-ink hover:bg-bg rounded-lg transition"
              title="Close guide"
              aria-label="Close guide dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Offline Notice Banner if disconnected */}
        {!isOnline && (
          <div className="bg-urgent-soft border-b border-urgent/25 px-3 py-1.5 text-[11px] text-urgent flex items-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span>Offline mode active: answering from on-device knowledge base.</span>
          </div>
        )}

        {/* Solid Message List Container for maximum contrast */}
        <div className="flex-1 bg-surface overflow-hidden flex flex-col">
          <MessageList
            messages={messages}
            status={status}
            onSelectSuggestion={(q) => sendMessage(q)}
          />
        </div>

        {/* Composer */}
        <Composer
          onSend={(text) => sendMessage(text)}
          disabled={status === 'typing'}
        />
      </div>
    </div>
  );
};
