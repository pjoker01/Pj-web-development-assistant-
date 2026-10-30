const PJ_ASSISTANT_API = 'https://chat.pjwebdev.online/api/pj-assistant';

export type AssistantHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

export type AssistantChatResponse = {
  reply: string;
  sessionId?: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.error === 'string' ? body.error : 'PJ Assistant is temporarily unavailable. Please try again.';
    throw new Error(message);
  }
  return body as T;
}

/** The single public transport to PJ Chat Platform. Never call a second LLM from the browser. */
export async function sendAssistantMessage(input: {
  message: string;
  sessionId: string;
  history: AssistantHistoryItem[];
  signal?: AbortSignal;
}): Promise<AssistantChatResponse> {
  const message = input.message.trim();
  if (!message) throw new Error('Please enter a message.');
  if (message.length > 2000) throw new Error('Please keep your message under 2,000 characters.');

  const response = await fetch(PJ_ASSISTANT_API + '/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: input.signal,
    body: JSON.stringify({
      message,
      sessionId: input.sessionId,
      history: input.history.slice(-20),
    }),
  });
  const body = await readJson<AssistantChatResponse>(response);
  if (typeof body.reply !== 'string' || !body.reply.trim()) {
    throw new Error('PJ Assistant returned an empty response. Please try again.');
  }
  return body;
}

export type AvailabilitySlot = { start: string; end: string; available: boolean };

export async function getConsultationAvailability(date: string): Promise<AvailabilitySlot[]> {
  const response = await fetch(PJ_ASSISTANT_API + '/booking-availability?date=' + encodeURIComponent(date));
  const body = await readJson<{ slots?: AvailabilitySlot[] }>(response);
  return Array.isArray(body.slots) ? body.slots.filter(slot => slot.available) : [];
}
