import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { VoiceInputButton } from '@/components/shared/VoiceInputButton';

interface ComposerProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export const Composer: React.FC<ComposerProps> = ({ onSend, disabled = false }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleVoiceTranscription = (transcript: string) => {
    setText((prev) => (prev ? `${prev} ${transcript}` : transcript));
    textareaRef.current?.focus();
  };

  const charCount = text.length;
  const isNearLimit = charCount > 1800;

  return (
    <div className="p-3 sm:p-4 border-t border-line bg-surface">
      <form onSubmit={handleSubmit} className="space-y-2">
        <div className="relative flex items-end gap-2 bg-bg border border-border-control rounded-xl p-2 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent transition">
          <textarea
            ref={textareaRef}
            rows={1}
            maxLength={2000}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              // Auto-expand up to 120px
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about triage levels, baseline vitals, or emergency aid..."
            disabled={disabled}
            className="flex-1 bg-transparent border-0 resize-none text-xs sm:text-sm text-ink placeholder:text-muted focus:outline-none max-h-32 leading-relaxed"
          />

          <div className="flex items-center gap-1.5 shrink-0">
            <VoiceInputButton
              onTranscript={handleVoiceTranscription}
              placeholderTarget="chat message"
              disabled={disabled}
            />

            <button
              type="submit"
              disabled={disabled || !text.trim()}
              aria-label="Send message"
              className="w-8 h-8 rounded-lg bg-primary hover:bg-primary-hover text-surface flex items-center justify-center transition disabled:opacity-40 disabled:cursor-not-allowed shadow-button"
            >
              {disabled ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted px-1">
          <span>Decision support only • Not a substitute for a doctor</span>
          {isNearLimit && (
            <span className={charCount >= 2000 ? 'text-emergency font-bold' : 'text-urgent font-medium'}>
              {charCount}/2000
            </span>
          )}
        </div>
      </form>
    </div>
  );
};
