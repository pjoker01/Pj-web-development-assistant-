'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  type AssistantHistoryItem,
  type AvailabilitySlot,
  getConsultationAvailability,
  sendAssistantMessage,
  submitConsultationRequest,
} from '@/app/pj/assistant-api';
import { App as LiveKitApp } from '@/components/app/app';

type Message = AssistantHistoryItem & { id: string };

function newSessionId() {
  return `pj_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export function PjExperience({
  voiceReady,
  agentName,
}: {
  voiceReady: boolean;
  agentName?: string;
}) {
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hey! I'm PJ, your PJ Web Development assistant. 👋 I can help with websites, online stores, AI assistants, bookings and project enquiries. What would you like to build?",
    },
  ]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookingMessage, setBookingMessage] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem('pj-assistant-session');
    const id = saved || newSessionId();
    window.localStorage.setItem('pj-assistant-session', id);
    setSessionId(id);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const history = useMemo<AssistantHistoryItem[]>(
    () =>
      messages
        .filter((message) => message.id !== 'welcome')
        .slice(-20)
        .map(({ role, content }) => ({ role, content })),
    [messages]
  );

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const message = draft.trim();
    if (!message || sending || !sessionId) return;
    setError('');
    setDraft('');
    const next = [...messages, { id: newSessionId(), role: 'user' as const, content: message }];
    setMessages(next);
    setSending(true);
    try {
      const response = await sendAssistantMessage({
        message,
        sessionId,
        history: next
          .filter((item) => item.id !== 'welcome')
          .slice(0, -1)
          .slice(-20)
          .map(({ role, content }) => ({ role, content })),
      });
      if (response.sessionId) {
        setSessionId(response.sessionId);
        window.localStorage.setItem('pj-assistant-session', response.sessionId);
      }
      setMessages((current) => [
        ...current,
        { id: newSessionId(), role: 'assistant', content: response.reply },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PJ Assistant is temporarily unavailable.');
      setDraft(message);
    } finally {
      setSending(false);
    }
  }

  async function loadSlots(date: string) {
    setBookingDate(date);
    setSelectedSlot('');
    setSlots([]);
    setBookingMessage('');
    if (!date) return;
    setLoadingSlots(true);
    try {
      setSlots(await getConsultationAvailability(date));
    } catch (err) {
      setBookingMessage(err instanceof Error ? err.message : 'Could not load available times.');
    } finally {
      setLoadingSlots(false);
    }
  }

  async function submitBooking(event: FormEvent) {
    event.preventDefault();
    if (!selectedSlot) return;
    setBooking(true);
    setBookingMessage('');
    try {
      const result = await submitConsultationRequest({
        customerName,
        customerContact,
        requestedStart: selectedSlot,
        notes: bookingNotes,
      });
      setBookingMessage(result.message || 'Your consultation request has been received.');
      setCustomerName('');
      setCustomerContact('');
      setBookingNotes('');
      setSelectedSlot('');
      setSlots([]);
    } catch (err) {
      setBookingMessage(
        err instanceof Error ? err.message : 'We could not submit your request. Please try again.'
      );
    } finally {
      setBooking(false);
    }
  }

  if (voiceOpen) {
    return (
      <div className="pj-voice-shell">
        <button className="pj-back-button" onClick={() => setVoiceOpen(false)}>
          ← Back to PJ Assistant
        </button>
        <LiveKitApp
          tokenEndpoint="/api/token"
          agentName={agentName}
          isVideoInputSupported={false}
        />
      </div>
    );
  }

  return (
    <main className="pj-shell">
      <header className="pj-header">
        <Link className="pj-brand" href="/" aria-label="PJ Web Development home">
          <img src="/pj-web-development-logo.webp" alt="PJ Web Development" />
          <span>
            <strong>PJ</strong> WEB DEVELOPMENT<small>PERSONAL BUSINESS ASSISTANT</small>
          </span>
        </Link>
        <div className="pj-header-actions">
          <span className="pj-online-dot" /> <span className="pj-online-label">PJ ASSISTANT</span>
          <button className="pj-booking-link" onClick={() => setBookingOpen(true)}>
            Book a consultation
          </button>
        </div>
      </header>

      <section className="pj-main">
        <div className="pj-intro">
          <div className="pj-orb-wrap">
            <div className="pj-orb">
              <span />
            </div>
          </div>
          <p className="pj-eyebrow">YOUR DIGITAL BUSINESS PARTNER</p>
          <h1>
            Let&apos;s build something
            <br />
            <em>brilliant.</em>
          </h1>
          <p className="pj-subtitle">
            Ask about websites, online stores, AI assistants or your next digital project. Real PJ
            business knowledge, one conversation.
          </p>
          <div className="pj-actions">
            <button
              className="pj-primary"
              onClick={() => document.getElementById('pj-message')?.focus()}
            >
              Start a conversation <span>↗</span>
            </button>
            <button
              className="pj-secondary"
              onClick={() =>
                voiceReady
                  ? setVoiceOpen(true)
                  : setError('Live voice is not connected yet. Text chat is ready.')
              }
            >
              <span className="pj-mic-icon">◉</span>{' '}
              {voiceReady ? 'Talk to PJ' : 'Voice setup pending'}
            </button>
          </div>
          {!voiceReady && (
            <p className="pj-voice-note">
              Text assistant is available. Live voice will appear once the secure LiveKit agent
              service is configured.
            </p>
          )}
        </div>

        <section className="pj-chat-card" aria-label="PJ Assistant chat">
          <div className="pj-chat-top">
            <div>
              <span className="pj-chat-avatar">PJ</span>
              <span>
                <strong>PJ Assistant</strong>
                <small>Official PJ Web Development assistant</small>
              </span>
            </div>
            <span className="pj-secure">● PRIVATE SESSION</span>
          </div>
          <div className="pj-messages">
            {messages.map((message) => (
              <div
                className={`pj-message ${message.role === 'user' ? 'pj-user' : 'pj-assistant'}`}
                key={message.id}
              >
                {message.role === 'assistant' && <span className="pj-message-avatar">PJ</span>}
                <p>{message.content}</p>
              </div>
            ))}
            {sending && (
              <div className="pj-typing">
                <span />
                <span />
                <span /> PJ is thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {error && (
            <p className="pj-error" role="alert">
              {error}
            </p>
          )}
          <form className="pj-composer" onSubmit={sendMessage}>
            <textarea
              id="pj-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Tell PJ what you're looking for…"
              rows={2}
              maxLength={2000}
            />
            <button type="submit" disabled={sending || !draft.trim()} aria-label="Send message">
              ↑
            </button>
          </form>
          <div className="pj-chat-footer">
            <span>Powered by PJ&apos;s business knowledge</span>
            <span>Enter to send · Shift + Enter for a new line</span>
          </div>
        </section>

        <div className="pj-service-strip">
          <span>WEBSITE DESIGN</span>
          <i>✦</i>
          <span>ONLINE STORES</span>
          <i>✦</i>
          <span>AI ASSISTANTS</span>
          <i>✦</i>
          <span>BUSINESS AUTOMATION</span>
        </div>
      </section>

      <footer className="pj-footer">
        © {new Date().getFullYear()} PJ Web Development{' '}
        <span>BUILT WITH PURPOSE. DESIGNED TO GROW.</span>
      </footer>

      {bookingOpen && (
        <div
          className="pj-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setBookingOpen(false);
          }}
        >
          <section
            className="pj-booking-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="booking-title"
          >
            <button
              className="pj-modal-close"
              onClick={() => setBookingOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <p className="pj-eyebrow">LET&apos;S TALK ABOUT YOUR PROJECT</p>
            <h2 id="booking-title">Book a consultation</h2>
            <p className="pj-modal-copy">
              Choose an available time and send a request. PJ will confirm the appointment.
            </p>
            <form onSubmit={submitBooking} className="pj-booking-form">
              <label>
                Your name
                <input
                  required
                  minLength={2}
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                />
              </label>
              <label>
                WhatsApp number or email
                <input
                  required
                  minLength={5}
                  value={customerContact}
                  onChange={(event) => setCustomerContact(event.target.value)}
                />
              </label>
              <label>
                Preferred date
                <input
                  required
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={bookingDate}
                  onChange={(event) => void loadSlots(event.target.value)}
                />
              </label>
              {loadingSlots && <p className="pj-modal-copy">Checking available times…</p>}
              {slots.length > 0 && (
                <label>
                  Available time
                  <select
                    required
                    value={selectedSlot}
                    onChange={(event) => setSelectedSlot(event.target.value)}
                  >
                    <option value="">Choose a time</option>
                    {slots.map((slot) => (
                      <option key={slot.start} value={slot.start}>
                        {new Date(slot.start).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {bookingDate && !loadingSlots && slots.length === 0 && (
                <p className="pj-modal-copy">
                  No available slots were returned for this date. Try another date or message PJ.
                </p>
              )}
              <label>
                What would you like to discuss?
                <textarea
                  rows={3}
                  value={bookingNotes}
                  onChange={(event) => setBookingNotes(event.target.value)}
                  placeholder="Website, online store, AI assistant…"
                />
              </label>
              <button
                className="pj-primary pj-submit-booking"
                type="submit"
                disabled={booking || !selectedSlot}
              >
                {booking ? 'Sending request…' : 'Request consultation'}
              </button>
              {bookingMessage && (
                <p className="pj-booking-result" role="status">
                  {bookingMessage}
                </p>
              )}
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
