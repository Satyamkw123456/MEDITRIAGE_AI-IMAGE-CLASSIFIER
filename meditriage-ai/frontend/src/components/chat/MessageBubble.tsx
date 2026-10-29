import React, { useState } from 'react';
import Link from 'next/link';
import { Copy, Check, ThumbsUp, ThumbsDown, ExternalLink } from 'lucide-react';
import { ChatMessagePayload } from '@/lib/chat/chatClient';
import { SourceChip } from './SourceChip';
import { EmergencyCard } from './EmergencyCard';

interface MessageBubbleProps {
  message: ChatMessagePayload;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.sender_role === 'user';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  if (message.source === 'emergency') {
    return <EmergencyCard messageText={message.message_text} actions={message.actions} />;
  }

  const handleCopy = () => {
    navigator.clipboard?.writeText(message.message_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5 max-w-[88%]`}>
      {!isUser && (
        <div className="flex items-center gap-2 mb-0.5">
          <SourceChip source={message.source} />
        </div>
      )}

      <div
        className={`p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed transition-all ${
          isUser
            ? 'bg-primary-soft text-ink border border-primary/20 rounded-2xl rounded-tr-xs shadow-xs'
            : 'bg-surface text-ink border border-line rounded-2xl rounded-tl-xs shadow-card'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.message_text}</p>

        {/* Embedded action links if provided */}
        {message.actions && message.actions.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-line/60 flex flex-wrap gap-2">
            {message.actions.map((act, i) => (
              <Link
                key={i}
                href={act.href}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-bg hover:bg-bg-tint border border-line text-primary transition shadow-xs"
              >
                <span>{act.label}</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Utility Toolbar for Assistant Messages */}
      {!isUser && (
        <div className="flex items-center gap-2 px-1 text-[11px] text-muted">
          <button
            type="button"
            onClick={handleCopy}
            className="hover:text-ink transition flex items-center gap-1 p-0.5"
            title="Copy answer"
          >
            {copied ? <Check className="w-3 h-3 text-selfcare" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <span>•</span>

          <button
            type="button"
            onClick={() => setFeedback('up')}
            className={`p-0.5 transition ${feedback === 'up' ? 'text-selfcare' : 'hover:text-ink'}`}
            title="Helpful"
          >
            <ThumbsUp className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => setFeedback('down')}
            className={`p-0.5 transition ${feedback === 'down' ? 'text-emergency' : 'hover:text-ink'}`}
            title="Not helpful"
          >
            <ThumbsDown className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
