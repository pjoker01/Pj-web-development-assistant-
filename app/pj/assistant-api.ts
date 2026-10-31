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
    const message =
      typeof body?.error === 'string'
        ? body.error
        : 'PJ Assistant is temporarily unavailable. Please try again.';
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
  const response = await fetch(
    PJ_ASSISTANT_API + '/booking-availability?date=' + encodeURIComponent(date)
  );
  const body = await readJson<{ slots?: AvailabilitySlot[] }>(response);
  return Array.isArray(body.slots) ? body.slots.filter((slot) => slot.available) : [];
}

export type ConsultationRequest = {
  customerName: string;
  customerContact: string;
  requestedStart: string;
  notes: string;
};

export async function submitConsultationRequest(
  input: ConsultationRequest
): Promise<{ success: true; message: string; status: string }> {
  if (input.customerName.trim().length < 2) throw new Error('Please enter your name.');
  if (input.customerContact.trim().length < 5)
    throw new Error('Please enter a phone number or email address.');
  if (!input.requestedStart || Number.isNaN(Date.parse(input.requestedStart))) {
    throw new Error('Choose an available consultation time.');
  }
  const response = await fetch(PJ_ASSISTANT_API + '/booking-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: input.customerName.trim(),
      customerContact: input.customerContact.trim(),
      requestedStart: input.requestedStart,
      serviceName: 'Website consultation',
      notes: input.notes.trim().slice(0, 1000),
    }),
  });
  const body = await readJson<{ success?: boolean; message?: string; status?: string }>(response);
  if (body.success !== true)
    throw new Error(body.message || 'Your consultation request could not be saved.');
  return {
    success: true,
    message:
      body.message ||
      'Your appointment request has been received. It is not confirmed yet; PJ will contact you.',
    status: body.status || 'pending_confirmation',
  };
}
