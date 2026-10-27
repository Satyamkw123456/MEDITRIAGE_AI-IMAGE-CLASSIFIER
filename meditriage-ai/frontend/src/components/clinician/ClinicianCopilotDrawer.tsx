'use client';

import React, { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api/client';
import { Bot, Send, X, Sparkles, User as UserIcon, AlertCircle, Loader2 } from 'lucide-react';

interface ClinicianCopilotDrawerProps {
  caseId: number;
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  citations?: Array<{ source_name: string; section_title: string }>;
  timestamp: string;
}

export const ClinicianCopilotDrawer: React.FC<ClinicianCopilotDrawerProps> = ({
  caseId,
  isOpen,
  onClose,
}) => {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Initialize or fetch copilot session
    const initSession = async () => {
      setLoading(true);
      setError(null);
      try {
        const data: any = await apiClient.fetch('/api/v1/chat/sessions', 'post', {
          body: {
            case_id: caseId,
            mode: 'copilot',
          },
        });

        setSessionId(data.id);

        // Prepopulate with contextual welcome message
        setMessages([
          {
            id: 'init',
            sender: 'assistant',
            content: `Clinical Copilot active for Case #${caseId}. I have loaded the patient's vitals, symptoms, medication history, and rule evaluation. How can I assist with your clinical review?`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Copilot initialization failed.');
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, [isOpen, caseId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const messageContent = (textToSend || inputText).trim();
    if (!messageContent || !sessionId || loading) return;

    setInputText('');
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      content: messageContent,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const replyData: any = await apiClient.fetch('/api/v1/chat/sessions/{session_id}/messages', 'post', {
        pathParams: { session_id: sessionId },
        body: { message: messageContent },
      });

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        content: replyData.content || replyData.message || 'Analysis complete.',
        citations: replyData.citations || [],
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          content: 'Unable to reach clinical copilot service. Rule-based clinical evidence remains authoritative.',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Clinician Copilot Assistant"
      className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface border-l border-line shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
    >
      {/* Drawer Header */}
      <div className="p-4 border-b border-line flex items-center justify-between bg-primary-soft">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary text-surface rounded-xl">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-ink">Clinical Copilot</h2>
            <p className="text-[11px] text-muted">Assistive AI for Case #{caseId}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-line transition-colors"
          aria-label="Close copilot"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Quick Prompts */}
      <div className="p-3 border-b border-line bg-surface/50 flex flex-wrap gap-1.5">
        {[
          'Medication interaction check',
          'Explain NEWS2 score triggers',
          'Review diagnostic plausibility',
        ].map((prompt) => (
          <button
            key={prompt}
            onClick={() => handleSendMessage(prompt)}
            disabled={loading}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-primary/20 bg-primary-soft text-primary hover:bg-primary hover:text-surface transition-colors"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
        {error && (
          <div className="p-3 bg-emergency/10 border border-emergency/30 rounded-xl text-emergency text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-primary text-surface rounded-br-none'
                  : 'bg-primary-soft/60 border border-line text-ink rounded-bl-none'
              }`}
            >
              <p className="whitespace-pre-line">{msg.content}</p>

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-line/50 flex flex-wrap gap-1">
                  {msg.citations.map((c, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-line text-muted"
                    >
                      {c.source_name}: {c.section_title}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <span className="text-[10px] text-muted mt-1 px-1">{msg.timestamp}</span>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-muted text-xs p-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            <span>Copilot analyzing clinical evidence...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3.5 border-t border-line bg-surface flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask copilot about this case..."
          aria-label="Ask clinical copilot"
          className="flex-1 px-3 py-2 text-xs rounded-xl border border-line focus:outline-none focus:ring-2 focus:ring-primary text-ink bg-surface placeholder:text-muted/60"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || loading}
          aria-label="Send message"
          className="p-2 rounded-xl bg-primary text-surface hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {/* Disclaimer */}
      <div className="px-4 py-2 border-t border-line/60 bg-surface text-[10px] text-muted text-center">
        Clinical Decision Support only. Not for standalone diagnostic use.
      </div>
    </div>
  );
};
