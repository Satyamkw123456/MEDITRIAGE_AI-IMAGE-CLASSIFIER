import React, { useEffect, useRef } from 'react';
import { Bot, Sparkles, ShieldCheck } from 'lucide-react';
import { ChatMessagePayload } from '@/lib/chat/chatClient';
import { MessageBubble } from './MessageBubble';
import { SuggestionChips } from './SuggestionChips';
import { ChatStatus } from '@/lib/chat/useChat';

interface MessageListProps {
  messages: ChatMessagePayload[];
  status: ChatStatus;
  onSelectSuggestion: (query: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  status,
  onSelectSuggestion,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Chat message history"
      className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4"
    >
      {/* Welcome state when chat is empty */}
      {messages.length === 0 && (
        <div className="space-y-5 my-auto py-2">
          <div className="p-4 rounded-xl bg-bg border border-line space-y-2">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <Bot className="w-4 h-4 text-primary" />
              <span>Hello! I am MediTriage Guide.</span>
            </div>
            <p className="text-xs text-ink/90 leading-relaxed">
              I can assist you with understanding triage urgency levels, how baseline vitals are calculated, your Emergency QR Card, or navigating local emergency care.
            </p>
            <div className="pt-1 flex items-center gap-1.5 text-[11px] text-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-selfcare shrink-0" />
              <span>I give informational guidance, not medical diagnosis or prescription.</span>
            </div>
          </div>

          <SuggestionChips onSelect={onSelectSuggestion} />
        </div>
      )}

      {/* Render Message History */}
      {messages.map((msg, index) => (
        <div
          key={index}
          className={`flex ${msg.sender_role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <MessageBubble message={msg} />
        </div>
      ))}

      {/* Typing Shimmer */}
      {status === 'typing' && (
        <div className="flex justify-start">
          <div className="p-3.5 rounded-2xl rounded-tl-xs bg-surface border border-line shadow-xs flex items-center gap-2">
            <div className="flex gap-1 items-center">
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
            </div>
            <span className="text-xs text-muted font-medium">Consulting knowledge guide...</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};
