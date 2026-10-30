import test from 'node:test';
import assert from 'node:assert/strict';
import { getConsultationAvailability, sendAssistantMessage, submitConsultationRequest } from './assistant-api.ts';

test('chat client sends the public PJ session contract and returns the session id', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: any;
  let requestUrl = '';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ reply: 'Hello from PJ', sessionId: 'session-next' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const result = await sendAssistantMessage({
      message: '  Hello  ',
      sessionId: 'session-current',
      history: [{ role: 'user', content: 'Earlier message' }],
    });
    assert.equal(requestUrl, 'https://chat.pjwebdev.online/api/pj-assistant/chat');
    assert.deepEqual(requestBody, {
      message: 'Hello',
      sessionId: 'session-current',
      history: [{ role: 'user', content: 'Earlier message' }],
    });
    assert.deepEqual(result, { reply: 'Hello from PJ', sessionId: 'session-next' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('chat client rejects non-success API responses with the platform error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'Rate limited' }), {
    status: 429, headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch;
  try {
    await assert.rejects(
      sendAssistantMessage({ message: 'Hi', sessionId: 's1', history: [] }),
      /Rate limited/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('availability client returns only available slots', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestUrl = String(input);
    return new Response(JSON.stringify({
      slots: [
        { start: '2026-11-02T09:00:00+02:00', end: '2026-11-02T09:30:00+02:00', available: true },
        { start: '2026-11-02T10:00:00+02:00', end: '2026-11-02T10:30:00+02:00', available: false },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const slots = await getConsultationAvailability('2026-11-02');
    assert.match(requestUrl, /booking-availability\?date=2026-11-02$/);
    assert.equal(slots.length, 1);
    assert.equal(slots[0].available, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('consultation request uses the platform booking contract', async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = '';
  let requestBody: any;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      success: true,
      status: 'pending_confirmation',
      message: 'Request received',
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    const result = await submitConsultationRequest({
      customerName: 'PJ Visitor',
      customerContact: '+27123456789',
      requestedStart: '2026-11-02T09:00:00+02:00',
      notes: 'Business: Example',
    });
    assert.equal(requestUrl, 'https://chat.pjwebdev.online/api/pj-assistant/booking-requests');
    assert.equal(requestBody.customerName, 'PJ Visitor');
    assert.equal(requestBody.customerContact, '+27123456789');
    assert.equal(requestBody.requestedStart, '2026-11-02T09:00:00+02:00');
    assert.equal(requestBody.serviceName, 'Website consultation');
    assert.equal(result.status, 'pending_confirmation');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('consultation request rejects a missing appointment time before network access', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  try {
    await assert.rejects(
      submitConsultationRequest({ customerName: 'PJ', customerContact: '123456', requestedStart: '', notes: '' }),
      /available consultation time/,
    );
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
