'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { checkClientEmergency } from './emergency';
import { kbSearch } from './kbSearch';
import { getOrCreateChatSession, sendServerChatMessage, ChatMessagePayload } from './chatClient';

export type ChatStatus =
  | 'idle'
  | 'typing'
  | 'offline'
  | 'ai_unavailable'
  | 'rate_limited'
  | 'emergency'
  | 'error';

const STORAGE_KEY = 'meditriage_public_chat_history';
const MAX_LOCAL_MESSAGES = 30;

export function useChat(caseId?: number) {
  const locale = useLocale();
  const { isAuthenticated, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessagePayload[]>([]);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Network status detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setStatus('offline');
    };

    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    };
  }, []);

  // Restore non-PHI public guide history from sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && !isAuthenticated) {
      try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setMessages(parsed);
          }
        }
      } catch {
        // Ignore parsing errors
      }
    }
  }, [isAuthenticated]);

  // Sync public messages to sessionStorage
  const saveLocalHistory = useCallback((updated: ChatMessagePayload[]) => {
    if (typeof window !== 'undefined' && !isAuthenticated) {
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(updated.slice(-MAX_LOCAL_MESSAGES))
        );
      } catch {
        // Ignore quota errors
      }
    }
  }, [isAuthenticated]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setStatus('idle');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const sendMessage = useCallback(
    async (userInput: string) => {
      const text = userInput.trim();
      if (!text || text.length > 2000) return;

      const userMsg: ChatMessagePayload = {
        sender_role: 'user',
        message_text: text,
        created_at: new Date().toISOString(),
      };

      const newHistory = [...messages, userMsg];
      setMessages(newHistory);
      saveLocalHistory(newHistory);
      setStatus('typing');

      // Layer 1: Safety Intercept (Emergency / Crisis Check)
      const emergencyCheck = checkClientEmergency(text);
      if (emergencyCheck.isEmergency) {
        setStatus('emergency');
        const emergencyMsg: ChatMessagePayload = {
          sender_role: 'assistant',
          message_text:
            'Critical symptoms detected: If you or someone you are with is experiencing severe chest pain, stroke signs, difficulty breathing, or collapse, call Emergency Services (112 or 108) immediately. Do not wait for online triage.',
          source: 'emergency',
          actions: [
            { label: 'Call 112 Now', href: 'tel:112' },
            { label: 'Pune Emergency Directory', href: `/${locale}/resources` },
          ],
          created_at: new Date().toISOString(),
        };
        const finalHistory = [...newHistory, emergencyMsg];
        setMessages(finalHistory);
        saveLocalHistory(finalHistory);
        return;
      }

      // Layer 2: Internal Knowledge Base (Offline-First BM25 Search)
      const kbMatch = kbSearch(text, locale);
      if (kbMatch) {
        const botMsg: ChatMessagePayload = {
          sender_role: 'assistant',
          message_text: kbMatch.entry.a,
          source: 'kb',
          actions: kbMatch.entry.actions,
          created_at: new Date().toISOString(),
        };
        const finalHistory = [...newHistory, botMsg];
        setMessages(finalHistory);
        saveLocalHistory(finalHistory);
        setStatus('idle');
        return;
      }

      // Layer 3: Model Layer (if Authenticated & Online)
      if (isOnline && isAuthenticated) {
        try {
          const mode = user?.role === 'clinician' ? 'copilot' : 'companion';
          const sessionId = await getOrCreateChatSession(mode, caseId);
          if (sessionId) {
            const serverReply = await sendServerChatMessage(sessionId, text);
            const botMsg: ChatMessagePayload = {
              sender_role: 'assistant',
              message_text: serverReply.text,
              source: 'ai',
              citations: serverReply.citations,
              created_at: new Date().toISOString(),
            };
            const finalHistory = [...newHistory, botMsg];
            setMessages(finalHistory);
            saveLocalHistory(finalHistory);
            setStatus('idle');
            return;
          }
        } catch (err: unknown) {
          console.warn('Backend model query failed, falling back:', err);
          setStatus('ai_unavailable');
        }
      }

      // Layer 4: Graceful Fallback
      const fallbackMsg: ChatMessagePayload = {
        sender_role: 'assistant',
        message_text:
          "I provide clinical guidance and system navigation based on MediTriage documentation. For definitive medical evaluation or specific symptom review, please consult an attending physician or start an intake assessment.",
        source: 'kb',
        actions: [
          { label: 'Start Symptom Intake', href: `/${locale}/triage/consent` },
          { label: 'Emergency Directory', href: `/${locale}/resources` },
        ],
        created_at: new Date().toISOString(),
      };
      const finalHistory = [...newHistory, fallbackMsg];
      setMessages(finalHistory);
      saveLocalHistory(finalHistory);
      setStatus('idle');
    },
    [messages, locale, isOnline, isAuthenticated, user, caseId, saveLocalHistory]
  );

  return {
    messages,
    status,
    isOnline,
    sendMessage,
    clearChat,
  };
}
