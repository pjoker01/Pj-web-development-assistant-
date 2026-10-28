import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Conversation } from '@elevenlabs/client';
import { ArrowLeft, ArrowUp, CalendarDays, CheckCircle2, ChevronDown, Mic, MicOff, PhoneOff, ShieldCheck, Sparkles, Volume2, X } from 'lucide-react';
import './PJSunset.css';

const AGENT_ID = 'agent_7301m5zb2r3efxr9s2dtr76m4fjy';
const BOOKING_API = 'https://chat.pjwebdev.online/api/pj-assistant';
type Slot = { start: string; end: string; available: boolean };
type ChatLine = { id: number; role: 'user' | 'agent'; text: string };
type VoiceMode = 'idle' | 'connecting' | 'listening' | 'speaking';
const localDate = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };

function SunsetOrb({ mode }: { mode: VoiceMode }) {
  return <div className={'orb-stage orb-' + mode} aria-label={mode === 'listening' ? 'PJ Assistant is listening' : mode === 'speaking' ? 'PJ Assistant is speaking' : 'PJ sunset assistant'}>
    <div className="orb-aura aura-one" /><div className="orb-aura aura-two" /><div className="orb-ring ring-one" /><div className="orb-ring ring-two" />
    <div className="sun-orb"><div className="sun-gloss" /><div className="sun-horizon" /><div className="sun-stripe stripe-one" /><div className="sun-stripe stripe-two" /><div className="sun-stripe stripe-three" /></div>
    <div className="mist mist-back" /><div className="mist mist-front" /><div className="orb-spark spark-one" /><div className="orb-spark spark-two" /><div className="orb-spark spark-three" />
  </div>;
}

export default function PJAssistant() {
  const conversationRef = useRef<any>(null);
  const nextMessageId = useRef(1);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [intro, setIntro] = useState(true);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [mode, setMode] = useState<VoiceMode>('idle');
  const [status, setStatus] = useState('Ready when you are');
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState('');
  const [textMode, setTextMode] = useState(false);
  const [error, setError] = useState('');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [date, setDate] = useState(localDate());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [projectNotes, setProjectNotes] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookingError, setBookingError] = useState('');

  useEffect(() => { const timer = window.setTimeout(() => setIntro(false), 5000); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages]);
  useEffect(() => {
    let cancelled = false;
    setSlots([]); setSelectedSlot(''); setBookingError('');
    fetch(BOOKING_API + '/booking-availability?date=' + encodeURIComponent(date))
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Unable to load availability.'); return body; })
      .then(body => { if (!cancelled) setSlots(Array.isArray(body.slots) ? body.slots.filter((slot: Slot) => slot.available) : []); })
      .catch(error => { if (!cancelled) setBookingError(error.message || 'Unable to load availability.'); });
    return () => { cancelled = true; };
  }, [date]);
  useEffect(() => { document.title = 'PJ Assistant — Talk with PJ'; return () => { try { conversationRef.current?.endSession(); } catch { /* Already closed. */ } }; }, []);

  const addLine = (role: ChatLine['role'], text: string) => {
    const clean = text?.trim();
    if (clean) setMessages(previous => [...previous, { id: nextMessageId.current++, role, text: clean }].slice(-60));
  };

  const startConversation = async (textOnly = false) => {
    if (conversationRef.current || mode === 'connecting') return;
    setIsLiveMode(!textOnly);
    setError(''); setMode('connecting'); setStatus('Waking up the sunset…');
    try {
      const conversation = await Conversation.startSession({
        agentId: AGENT_ID,
        textOnly,
        onStatusChange: (event: any) => {
          const next = typeof event === 'string' ? event : event?.status;
          if (next === 'connected') { setMode('listening'); setStatus(textOnly ? 'Ready for your message' : 'Listening to you'); }
          if (next === 'connecting') { setMode('connecting'); setStatus('Connecting securely…'); }
          if (next === 'disconnected') { conversationRef.current = null; setMode('idle'); setIsLiveMode(false); setStatus('Ready when you are'); }
        },
        onModeChange: (event: any) => {
          const next = typeof event === 'string' ? event : event?.mode;
          if (next === 'speaking') { setMode('speaking'); setStatus('PJ Assistant is speaking'); }
          else if (next === 'listening') { setMode('listening'); setStatus('Listening to you'); }
        },
        onMessage: (message: any) => {
          const text = message?.message || message?.text || '';
          const role = message?.source === 'user' || message?.role === 'user' ? 'user' : 'agent';
          if (role === 'agent') addLine('agent', text);
        },
        onUserTranscript: (transcript: any) => {
          const text = transcript?.message || transcript?.text || '';
          if (text) addLine('user', text);
        },
        onError: (event: any) => {
          const message = typeof event === 'string' ? event : event?.message || 'The voice connection was interrupted. Please try again.';
          setError(message); setMode('idle'); setStatus('Connection interrupted');
        }
      } as any);
      conversationRef.current = conversation;
      setMode('listening'); setStatus(textOnly ? 'Ready for your message' : 'Listening to you');
    } catch (e: any) {
      setMode('idle'); setStatus('Ready when you are');
      setError(e?.message || 'Could not start voice. Check microphone permission and try again.');
    }
  };

  const endVoice = async () => {
    setIsLiveMode(false);
    const current = conversationRef.current; conversationRef.current = null;
    try { await current?.endSession(); } catch { /* Already ended. */ }
    setMode('idle'); setStatus('Ready when you are');
  };

  const sendText = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    try {
      if (!conversationRef.current) await startConversation(true);
      if (!conversationRef.current) throw new Error('Chat could not connect. Please try again.');
      addLine('user', text);
      await conversationRef.current.sendUserMessage(text);
    }
    catch (e: any) { setError(e?.message || 'That message could not be sent. Please try again.'); setDraft(text); }
  };

  const toggleText = () => {
    setTextMode(value => !value);
    window.setTimeout(() => inputRef.current?.focus(), 150);
  };

  const submitBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBookingLoading(true); setBookingError(''); setBookingMessage('');
    try {
      if (!selectedSlot) throw new Error('Please choose an available appointment time.');
      const response = await fetch(BOOKING_API + '/booking-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName, customerContact, requestedStart: selectedSlot, serviceName: 'Website consultation', notes: projectNotes, idempotencyKey: 'pjassistant-' + crypto.randomUUID() })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to send your request.');
      setBookingMessage(body.message || 'Request received. PJ will review it before confirming.');
      setCustomerName(''); setCustomerContact(''); setProjectNotes(''); setSelectedSlot('');
    } catch (e: any) { setBookingError(e?.message || 'Unable to send your request. Please try again.'); }
    finally { setBookingLoading(false); }
  };

  return <main className="pj-live-shell">
    {intro && <div className="pj-intro" role="status" aria-label="Introducing PJ Assistant">
      <button className="pj-skip" onClick={() => setIntro(false)}>Skip intro <ArrowUp size={12} style={{ transform: 'rotate(45deg)', display: 'inline' }} /></button>
      <div className="pj-intro-orb"><SunsetOrb mode="speaking" /></div>
      <h2>Meet <span style={{ color: '#ffb978' }}>PJ Assistant</span></h2>
      <p>Your ideas, your voice. Let's bring them to life.</p>
      <div className="pj-intro-steps"><span className="pj-intro-step"><Mic size={13} /> Speak naturally</span><span className="pj-intro-step"><Volume2 size={13} /> Hear your answer</span><span className="pj-intro-step"><Sparkles size={13} /> Build your next idea</span></div>
    </div>}
    <header className="pj-topbar">
      <a className="pj-brand" href="https://pjwebdev.online" aria-label="PJ Web Development home"><img src="/pj-web-development-logo.webp" alt="" /><span>PJ <span style={{ color: '#ffb978' }}>ASSISTANT</span></span></a>
      <div className="pj-top-actions"><button className="pj-quiet-button" onClick={() => setBookingOpen(true)}><CalendarDays size={14} /> Book PJ</button><a className="pj-quiet-button" href="https://pjwebdev.online" aria-label="Visit PJ Web Development"><ArrowLeft size={14} /> Website</a></div>
    </header>
    <section className={isLiveMode ? 'pj-center pj-live-view' : 'pj-center pj-chat-view'}>
      {isLiveMode ? <>
        <div className="pj-live-minihead"><span className="pj-live-mark"><span className="pj-status-dot" /> PJ LIVE</span><button className="pj-quiet-button" onClick={endVoice}><X size={14} /> Close live</button></div>
        <SunsetOrb mode={mode} />
        <div className="pj-transcript pj-live-transcript" aria-live="polite" aria-relevant="additions text">
          {messages.slice(-6).map(line => <div key={line.id} className={'pj-line ' + line.role}>{line.text}</div>)}
          <div ref={transcriptEndRef} />
        </div>
        <div className={'pj-live-status is-' + mode} role="status"><span className="pj-status-dot" />{mode === 'speaking' ? 'Speaking' : mode === 'connecting' ? 'Connecting' : 'Listening'}</div>
        <div className="pj-controls pj-live-controls">
          <div className="pj-main-controls"><button className="pj-talk-button" onClick={endVoice}><PhoneOff size={16} /> End live talk</button></div>
          {textMode && <form className="pj-text-entry" onSubmit={sendText}><input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Type a message…" aria-label="Message PJ Assistant" maxLength={2000} /><button className="pj-send" type="submit" disabled={!draft.trim()} aria-label="Send message"><ArrowUp size={18} /></button></form>}
          <button className="pj-text-toggle" onClick={() => setTextMode(value => !value)}>{textMode ? <><ChevronDown size={14} /> Hide typing</> : <><Sparkles size={14} /> Type a message</>}</button>
        </div>
      </> : <>
        <div className="pj-chat-heading"><div className="pj-eyebrow">PJ WEB DEVELOPMENT</div><h1 className="pj-title">Hey there. <span>What's on your mind?</span></h1><p className="pj-subtitle">Ask a question or tell me what you want to build. You can type or switch to live voice anytime.</p></div>
        <div className="pj-chat-window" aria-live="polite" aria-relevant="additions text">
          {messages.length === 0 && <div className="pj-empty-chat"><div className="pj-chat-sun"><Sparkles size={24} /></div><strong>Let's start with your idea.</strong><span>Send a message below, or tap Live Talk to speak naturally.</span></div>}
          {messages.map(line => <div key={line.id} className={'pj-chat-message ' + line.role}><span>{line.role === 'user' ? 'You' : 'PJ Assistant'}</span><p>{line.text}</p></div>)}
          <div ref={transcriptEndRef} />
        </div>
        {error && <div className="pj-error" role="alert">{error} <button onClick={() => setError('')} style={{ marginLeft: 8, color: '#ffe2d8', background: 'transparent', border: 0, cursor: 'pointer' }}><X size={12} style={{ display: 'inline' }} /> Dismiss</button></div>}
        <div className="pj-chat-compose">
          <form className="pj-text-entry" onSubmit={sendText}><input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Message PJ Assistant…" aria-label="Message PJ Assistant" maxLength={2000} /><button className="pj-send" type="submit" disabled={!draft.trim()} aria-label="Send message"><ArrowUp size={18} /></button></form>
          <button className="pj-live-launch" onClick={() => startConversation(false)} disabled={mode === 'connecting'}><Mic size={16} /> Live Talk</button>
          <p className="pj-chat-note">AI assistant · Don't share passwords or payment details.</p>
        </div>
        <footer className="pj-footer"><span>© {new Date().getFullYear()} PJ Web Development</span><span>·</span><button onClick={() => setBookingOpen(true)}>Book a consultation</button></footer>
      </>}
    </section>
    {bookingOpen && <div className="pj-booking-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setBookingOpen(false); }}>
      <section className="pj-booking-panel" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}><div><p style={{ margin: 0, color: '#ffbd82', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase' }}>Next step</p><h2 id="booking-title" style={{ margin: '7px 0', fontSize: 23, letterSpacing: '-.04em' }}>Book a consultation</h2><p style={{ margin: 0, color: '#b7a7a0', fontSize: 12, lineHeight: 1.7 }}>Choose a time and send a request. Your appointment is only confirmed after PJ approves it.</p></div><button className="pj-quiet-button" onClick={() => setBookingOpen(false)} aria-label="Close booking form"><X size={16} /></button></div>
        <form onSubmit={submitBooking} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12, marginTop: 20 }}>
          <label>Preferred date<input type="date" min={localDate()} value={date} onChange={e => setDate(e.target.value)} required /></label>
          <label>Available time<select value={selectedSlot} onChange={e => setSelectedSlot(e.target.value)} required><option value="">Choose a time</option>{slots.map(slot => <option key={slot.start} value={slot.start}>{new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</option>)}</select></label>
          <label>Your name<input value={customerName} onChange={e => setCustomerName(e.target.value)} minLength={2} maxLength={120} required placeholder="Full name" /></label>
          <label>Phone or email<input value={customerContact} onChange={e => setCustomerContact(e.target.value)} minLength={5} maxLength={160} required placeholder="How PJ can reach you" /></label>
          <label style={{ gridColumn: '1 / -1' }}>What would you like to discuss? (optional)<textarea value={projectNotes} onChange={e => setProjectNotes(e.target.value)} maxLength={1000} rows={3} placeholder="Website, online store, AI assistant, or another project…" /></label>
          {bookingError && <p role="alert" style={{ gridColumn: '1 / -1', color: '#ffb3a4', fontSize: 12 }}>{bookingError}</p>}
          {bookingMessage && <p role="status" style={{ gridColumn: '1 / -1', color: '#a7f3d0', fontSize: 12 }}>{bookingMessage}</p>}
          {!bookingError && !slots.length && <p style={{ gridColumn: '1 / -1', color: '#b7a7a0', fontSize: 11 }}>No available times are currently listed for this date. Try another date.</p>}
          <button className="pj-booking-submit" type="submit" disabled={bookingLoading || !slots.length}>{bookingLoading ? 'Sending request…' : 'Request consultation'}</button>
        </form>
        <p style={{ color: '#8c7d7c', fontSize: 10, lineHeight: 1.6, marginBottom: 0 }}>Submitting this form sends a request, not a confirmed appointment. Please don't include passwords or payment details.</p>
      </section>
    </div>}
  </main>;
}
