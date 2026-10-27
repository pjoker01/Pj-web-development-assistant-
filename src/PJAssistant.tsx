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
    setError(''); setMode('connecting'); setStatus('Waking up the sunset…');
    try {
      const conversation = await Conversation.startSession({
        agentId: AGENT_ID,
        textOnly,
        onStatusChange: (event: any) => {
          const next = typeof event === 'string' ? event : event?.status;
          if (next === 'connected') { setMode('listening'); setStatus(textOnly ? 'Ready for your message' : 'Listening to you'); }
          if (next === 'connecting') { setMode('connecting'); setStatus('Connecting securely…'); }
          if (next === 'disconnected') { conversationRef.current = null; setMode('idle'); setStatus('Ready when you are'); }
        },
        onModeChange: (event: any) => {
          const next = typeof event === 'string' ? event : event?.mode;
          if (next === 'speaking') { setMode('speaking'); setStatus('PJ Assistant is speaking'); }
          else if (next === 'listening') { setMode('listening'); setStatus('Listening to you'); }
        },
        onMessage: (message: any) => {
          const text = message?.message || message?.text || '';
          const role = message?.source === 'user' || message?.role === 'user' ? 'user' : 'agent';
          addLine(role, text);
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
    const current = conversationRef.current; conversationRef.current = null;
    try { await current?.endSession(); } catch { /* Already ended. */ }
    setMode('idle'); setStatus('Ready when you are');
  };

  const sendText = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !conversationRef.current) return;
    setDraft(''); addLine('user', text);
    try { await conversationRef.current.sendUserMessage(text); }
    catch (e: any) { setError(e?.message || 'That message could not be sent. Please try again.'); setDraft(text); }
  };

  const toggleText = () => {
    setTextMode(value => !value);
    if (!conversationRef.current && mode === 'idle') void startConversation(true);
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
    <section className="pj-center">
      <div className="pj-eyebrow">A little conversation can start a lot</div>
      <h1 className="pj-title">Your next idea starts <span>here.</span></h1>
      <p className="pj-subtitle">Talk naturally. Ask a question, explore a business idea, or tell me what you'd like to build.</p>
      <SunsetOrb mode={mode} />
      <div className="pj-transcript" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 && <p className="pj-line agent" style={{ color: '#c9a99a' }}>Your words will appear here as we talk.</p>}
        {messages.slice(-5).map(line => <div key={line.id} className={'pj-line ' + line.role}>{line.text}</div>)}
        <div ref={transcriptEndRef} />
      </div>
      <div className={'pj-live-status is-' + mode} role="status"><span className="pj-status-dot" />{status}</div>
      <div className="pj-controls">
        <div className="pj-main-controls">
          {mode === 'idle' ? <button className="pj-talk-button" onClick={() => startConversation(false)}><Mic size={17} /> Start talking</button> : mode === 'connecting' ? <button className="pj-talk-button" disabled><Sparkles size={17} /> Connecting…</button> : <button className="pj-talk-button" onClick={endVoice}><MicOff size={17} /> End conversation</button>}
          {mode !== 'idle' && mode !== 'connecting' && <button className="pj-end-button" aria-label="End conversation" onClick={endVoice}><PhoneOff size={17} /></button>}
        </div>
        {textMode && <form className="pj-text-entry" onSubmit={sendText}><input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} placeholder={conversationRef.current ? 'Type a message…' : 'Start talking first to open text chat…'} aria-label="Message PJ Assistant" disabled={!conversationRef.current} maxLength={2000} /><button className="pj-send" type="submit" disabled={!draft.trim() || !conversationRef.current} aria-label="Send message"><ArrowUp size={18} /></button></form>}
        <button className="pj-text-toggle" onClick={toggleText}>{textMode ? <><ChevronDown size={14} /> Hide text input</> : <><Sparkles size={14} /> {mode === 'idle' ? 'Prefer typing? Open text chat' : 'Type instead of speaking'}</>}</button>
        <p className="pj-helper">Your microphone is only used after you start a conversation. PJ Assistant is AI, not a human. Please don't share passwords or payment details.</p>
      </div>
      {error && <div className="pj-error" role="alert">{error} <button onClick={() => setError('')} style={{ marginLeft: 8, color: '#ffe2d8', background: 'transparent', border: 0, cursor: 'pointer' }}><X size={12} style={{ display: 'inline' }} /> Dismiss</button></div>}
      <footer className="pj-footer"><span>© {new Date().getFullYear()} PJ Web Development</span><span>·</span><span><ShieldCheck size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> Private conversation</span><span>·</span><button onClick={() => setBookingOpen(true)}>Request a consultation</button></footer>
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
