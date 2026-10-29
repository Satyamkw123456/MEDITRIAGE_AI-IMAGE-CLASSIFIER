import { apiClient } from '@/lib/api/client';
import { getAuthToken } from '@/lib/auth-token';

export interface ChatMessagePayload {
  id?: number;
  sender_role: 'user' | 'assistant' | 'system';
  message_text: string;
  source?: 'kb' | 'ai' | 'emergency';
  actions?: Array<{ label: string; href: string }>;
  citations?: string[];
  created_at?: string;
}

export interface ChatSessionInfo {
  session_id: number;
  case_id?: number | null;
  mode: string;
}

const activeSessionMap: Record<string, number> = {};

export async function getOrCreateChatSession(
  mode: 'companion' | 'copilot' = 'companion',
  caseId?: number
): Promise<number | null> {
  const token = getAuthToken();
  if (!token) return null;

  const key = `${mode}_${caseId || 'general'}`;
  if (activeSessionMap[key]) {
    return activeSessionMap[key];
  }

  try {
    const res: any = await apiClient.fetch('/api/v1/chat/sessions', 'post', {
      body: {
        mode,
        case_id: caseId || undefined,
      },
    });
    if (res?.session_id) {
      activeSessionMap[key] = res.session_id;
      return res.session_id;
    }
  } catch (err) {
    console.warn('Failed to initialize server chat session:', err);
  }
  return null;
}

export async function sendServerChatMessage(
  sessionId: number,
  message: string
): Promise<{ text: string; citations?: string[]; flags?: string[] }> {
  const cleanMessage = message.trim().slice(0, 2000);
  const res: any = await apiClient.fetch(
    '/api/v1/chat/sessions/{session_id}/messages',
    'post',
    {
      pathParams: { session_id: sessionId },
      body: { message: cleanMessage },
    }
  );

  return {
    text: res?.response || res?.message_text || "I'm sorry, I could not complete the response at this moment.",
    citations: res?.grounding_ids || [],
    flags: res?.safety_flags || [],
  };
}
