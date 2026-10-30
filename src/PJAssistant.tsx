import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { prewarmVoice } from '@todoforai/voiceloop';
import { createPJVoiceSession } from './assistant/voice/pj-voice-agent';

import { ArrowLeft, ArrowUp, AudioLines, BriefcaseBusiness, CheckCircle2, ChevronDown, Mic, MicOff, PhoneOff, ShieldCheck, Sparkles, Volume2, X } from 'lucide-react';
import './PJSunset.css';
import { getConsultationAvailability, sendAssistantMessage, submitConsultationRequest } from './assistant/api/assistant-api';

type Slot = { start: string; end: string; available: boolean };
type ChatLine = { id: number; role: 'user' | 'agent'; text: string };
type VoiceMode = 'idle' | 'connecting' | 'listening' | 'speaking';
const WELCOME_MESSAGE = "Hi, welcome to PJ Web Development. I'm PJ Assistant. What can I help you with today?";
const localDate = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };

function SunsetOrb({ mode }: { mode: VoiceMode }) {
  return <div className={'orb-stage orb-' + mode} aria-label={mode === 'listening' ? 'PJ Assistant is listening' : mode === 'speaking' ? 'PJ Assistant is speaking' : 'PJ sunset assistant'}>
    <div className="orb-aura aura-one" /><div className="orb-aura aura-two" /><div className="orb-ring ring-one" /><div className="orb-ring ring-two" />
    <div className="sun-orb"><div className="sun-corona" /><div className="sun-gloss" /><div className="sun-plasma plasma-one" /><div className="sun-plasma plasma-two" /><div className="sun-limb" /></div>
    <div className="mist mist-back" /><div className="mist mist-front" /><div className="orb-spark spark-one" /><div className="orb-spark spark-two" /><div className="orb-spark spark-three" />
  </div>;
}

export default function PJAssistant() {
  const nextMessageId = useRef(2);
  const voiceAgentRef = useRef<any>(null);
  const voiceAssistantDraftIdRef = useRef<number | null>(null);
  const voiceSilenceTimerRef = useRef<number | null>(null);
  const voiceSilenceFollowupSentRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [intro, setIntro] = useState(true);
  const [mode, setMode] = useState<VoiceMode>('idle');
  const [status, setStatus] = useState('Ready when you are');
  const [messages, setMessages] = useState<ChatLine[]>([{ id: 1, role: 'agent', text: WELCOME_MESSAGE }]);
  const chatSessionIdRef = useRef('pjassistant-' + (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const speechRecognitionRef = useRef<any>(null);
  const [error, setError] = useState('');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [date, setDate] = useState(localDate());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [projectLocation, setProjectLocation] = useState('');
  const [projectGoal, setProjectGoal] = useState('');
  const [projectPackage, setProjectPackage] = useState('');
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
    getConsultationAvailability(date)
      .then(availableSlots => { if (!cancelled) setSlots(availableSlots); })
      .catch(error => { if (!cancelled) setBookingError(error.message || 'Unable to load availability.'); });
    return () => { cancelled = true; };
  }, [date]);
  useEffect(() => {
    document.title = 'PJ Assistant — Talk with PJ';
    try { prewarmVoice(); } catch { /* Voice model warmup is best-effort. */ }
    return () => {
      const agent = voiceAgentRef.current;
      voiceAgentRef.current = null;
      try { agent?.destroy(); } catch { /* Voice session may already be closed. */ }
      if (voiceSilenceTimerRef.current !== null) window.clearTimeout(voiceSilenceTimerRef.current);
    };
  }, []);

  const addLine = (role: ChatLine['role'], text: string) => {
    const clean = text?.trim();
    if (clean) setMessages(previous => [...previous, { id: nextMessageId.current++, role, text: clean }].slice(-60));
  };

  const switchToLive = async () => {
    if (voiceAgentRef.current || mode === 'connecting') return;
    // Dictation and Live Talk must never compete for the same microphone.
    if (isDictating) {
      try { speechRecognitionRef.current?.stop(); } catch { /* Recognition may already have ended. */ }
      speechRecognitionRef.current = null;
      setIsDictating(false);
    }
    const BrowserSpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!BrowserSpeechRecognition) {
      setError('Live voice input needs Chrome on Android or a supported desktop browser. Please use Chrome, allow microphone access, or continue with text chat.');
      return;
    }
    setError(''); setMode('connecting'); setStatus('Preparing PJ Live Voice…');
    voiceSilenceFollowupSentRef.current = false; voiceAssistantDraftIdRef.current = null;
    const agent = createPJVoiceSession({
      getSessionId: () => chatSessionIdRef.current,
      setSessionId: sessionId => { chatSessionIdRef.current = sessionId; },
      onEvent: (event: any) => {
        if (event.type === 'state') {
          if (event.state === 'listening') { setMode('listening'); setStatus('Listening to you'); }
          else if (event.state === 'thinking') { setMode('connecting'); setStatus('Thinking…'); }
          else if (event.state === 'speaking') { setMode('speaking'); setStatus('PJ Assistant is speaking'); }
        }
        if (event.type === 'stt' && event.turnComplete && event.text) {
          voiceSilenceFollowupSentRef.current = false; addLine('user', event.text);
          if (voiceSilenceTimerRef.current !== null) window.clearTimeout(voiceSilenceTimerRef.current);
          voiceSilenceTimerRef.current = null;
        }
        if (event.type === 'assistant') {
          const visibleText = String(event.full || event.text || '').trim();
          if (visibleText) {
            const existingId = voiceAssistantDraftIdRef.current;
            if (existingId === null) { const id = nextMessageId.current++; voiceAssistantDraftIdRef.current = id; setMessages(previous => [...previous, { id, role: 'agent', text: visibleText }].slice(-60)); }
            else setMessages(previous => previous.map(line => line.id === existingId ? { ...line, text: visibleText } : line));
          }
          if (event.final) {
            voiceAssistantDraftIdRef.current = null;
            if (voiceSilenceTimerRef.current !== null) window.clearTimeout(voiceSilenceTimerRef.current);
            voiceSilenceTimerRef.current = window.setTimeout(() => {
              if (!voiceAgentRef.current || voiceSilenceFollowupSentRef.current) return;
              voiceSilenceFollowupSentRef.current = true;
              void voiceAgentRef.current.notify('[PJ_SILENCE_CHECKIN]').catch((err: any) => setError(err?.message || 'PJ Assistant could not check in. You can keep typing.'));
            }, 12000);
          }
        }
        if (event.type === 'error') {
          const detail = event.error?.message || String(event.error || 'The voice session encountered a problem.');
          setError(/not.?allowed|permission|microphone/i.test(detail)
            ? 'Microphone access was blocked. In Chrome, open Site settings for assistant.pjwebdev.online, set Microphone to Allow, then tap Live Talk again.'
            : detail);
          // A VoiceLoop error is terminal for this session: release it and return to text chat.
          const failedAgent = voiceAgentRef.current;
          voiceAgentRef.current = null;
          try { failedAgent?.destroy(); } catch { /* The library may already have torn down. */ }
          if (voiceSilenceTimerRef.current !== null) window.clearTimeout(voiceSilenceTimerRef.current);
          voiceSilenceTimerRef.current = null;
          setMode('idle');
          setStatus('Voice stopped — you can continue by typing');
        }
      },
    });
    voiceAgentRef.current = agent;
    try {
      // The session controller starts VoiceLoop directly from this user gesture.
      await agent.start();
      if (voiceAgentRef.current !== agent) return;
      setMode('listening'); setStatus('Listening to you');
      void agent.notify('[PJ_GREETING]').catch((err: any) => setError(err?.message || 'PJ Assistant could not start its spoken greeting.'));
    } catch (err: any) {
      try { agent.destroy(); } catch { /* Release partial session. */ }
      if (voiceAgentRef.current === agent) voiceAgentRef.current = null;
      setMode('idle'); setStatus('Ready when you are');
      const detail = err?.message || 'PJ Live Voice could not start.';
      setError(/not.?allowed|permission|microphone/i.test(detail) ? 'Chrome has not allowed microphone access. Tap the site icon beside the address, open Permissions, set Microphone to Allow, then reload and try again.' : detail + ' Please check microphone permission and try again.');
    }
  };

  const endVoice = () => {
    if (voiceSilenceTimerRef.current !== null) window.clearTimeout(voiceSilenceTimerRef.current);
    voiceSilenceTimerRef.current = null;
    const current = voiceAgentRef.current; voiceAgentRef.current = null;
    try { current?.destroy(); } catch { /* Already ended. */ }
    setMode('idle'); setStatus('Ready for your message');
  };

  const sendText = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const text = draft.trim(); if (!text || isSending) return;
    setIsSending(true); setError(''); setDraft('');
    if (voiceAgentRef.current && mode !== 'idle') {
      const accepted = voiceAgentRef.current.sendUserText(text);
      if (!accepted) setError('That message could not be added to the live conversation.');
      else setStatus('Thinking…');
      setIsSending(false); return;
    }
    addLine('user', text);
    try {
      const body = await sendAssistantMessage({
        message: text,
        sessionId: chatSessionIdRef.current,
        history: messages.filter(line => line.id !== 1).slice(-20).map(line => ({ role: line.role === 'agent' ? 'assistant' as const : 'user' as const, content: line.text })),
      });
      if (body.sessionId) chatSessionIdRef.current = body.sessionId;
      addLine('agent', body.reply); setStatus('Ready for your message');
    } catch (err: any) { setError(err?.message || 'That message could not be sent. Please try again.'); }
    finally { setIsSending(false); }
  };

  const toggleText = () => {
    setTextMode(value => !value);
    window.setTimeout(() => inputRef.current?.focus(), 150);
  };

  const toggleDictation = () => {
    if (isDictating) {
      try { speechRecognitionRef.current?.stop(); } catch { /* Already stopped. */ }
      setIsDictating(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice typing is not supported in this browser. Try your phone keyboard microphone instead.');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      speechRecognitionRef.current = recognition;
      recognition.lang = navigator.language || 'en-ZA';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onstart = () => { setIsDictating(true); setError(''); };
      recognition.onresult = (event: any) => {
        let spoken = '';
        for (let i = event.resultIndex; i < event.results.length; i++) spoken += event.results[i][0]?.transcript || '';
        if (spoken.trim()) setDraft(previous => (previous ? previous + ' ' : '') + spoken.trim());
      };
      recognition.onerror = (event: any) => {
        setIsDictating(false);
        if (event?.error !== 'no-speech' && event?.error !== 'aborted') setError('Microphone typing could not start. Check browser microphone permission.');
      };
      recognition.onend = () => setIsDictating(false);
      recognition.start();
      setIsDictating(true);
    } catch {
      setIsDictating(false);
      setError('Microphone typing could not start. Check browser microphone permission.');
    }
  };

  const submitBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBookingLoading(true); setBookingError(''); setBookingMessage('');
    try {
      if (!selectedSlot) throw new Error('Please choose an available consultation time.');
      const notes = [
        'Business / project: ' + businessName.trim(),
        'Project type: ' + businessType,
        'Location: ' + projectLocation.trim(),
        'Budget preference: ' + (projectPackage || 'Not sure yet'),
        'Project goal: ' + projectGoal.trim(),
        'Additional details: ' + (projectNotes.trim() || 'None supplied'),
      ].join('\\n');
      const result = await submitConsultationRequest({
        customerName,
        customerContact,
        requestedStart: selectedSlot,
        notes,
      });
      setBookingMessage(result.message + ' This is a request, not a confirmed appointment.');
      setCustomerName(''); setBusinessName(''); setBusinessType(''); setProjectLocation(''); setProjectGoal(''); setCustomerContact(''); setProjectNotes(''); setProjectPackage(''); setSelectedSlot('');
    } catch (e: any) { setBookingError(e?.message || 'Unable to send your consultation request. Please try again.'); }
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
      <div className="pj-top-actions"><button className="pj-quiet-button" onClick={() => setBookingOpen(true)}><BriefcaseBusiness size={14} /> Send Your Project</button><a className="pj-quiet-button" href="https://pjwebdev.online" aria-label="Visit PJ Web Development"><ArrowLeft size={14} /> Website</a></div>
    </header>
    <section className={mode !== 'idle' ? 'pj-center pj-live-view' : 'pj-center pj-chat-view'}>
      {mode !== 'idle' ? <>
        <div className="pj-live-minihead"><span className="pj-live-mark"><span className="pj-status-dot" /> PJ LIVE</span><button className="pj-quiet-button" onClick={endVoice}><X size={14} /> Close live</button></div>
        <SunsetOrb mode={mode} />
        <div className="pj-transcript pj-live-transcript" aria-live="polite" aria-relevant="additions text">
          {messages.slice(-6).map(line => <div key={line.id} className={'pj-line ' + line.role}>{line.text}</div>)}
          <div ref={transcriptEndRef} />
        </div>
        <div className={'pj-live-status is-' + mode} role="status"><span className="pj-status-dot" />{mode === 'speaking' ? 'Speaking' : mode === 'connecting' ? 'Connecting' : 'Listening'}</div>
        {error && <div className="pj-error" role="alert">{error}</div>}
        <div className="pj-controls pj-live-controls">
          <div className="pj-main-controls">
            {mode !== 'idle' && <button className="pj-talk-button" onClick={endVoice}><MicOff size={16} /> Stop PJ Live Voice</button>}
            {mode === 'idle' && <button className="pj-talk-button" onClick={endVoice}><PhoneOff size={16} /> End live talk</button>}
          </div>
          {textMode && <form className="pj-text-entry" onSubmit={sendText}><input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Type a message…" aria-label="Message PJ Assistant" maxLength={2000} /><button className="pj-send" type="submit" disabled={!draft.trim() || isSending} aria-label="Send message"><ArrowUp size={18} /></button></form>}
          <button className="pj-text-toggle" onClick={() => setTextMode(value => !value)}>{textMode ? <><ChevronDown size={14} /> Hide typing</> : <><Sparkles size={14} /> Type a message</>}</button>
        </div>
      </> : <>
        <div className="pj-chat-window pj-chat-window-clean" aria-live="polite" aria-relevant="additions text">
          {messages.map(line => <div key={line.id} className={'pj-chat-message ' + line.role}><span>{line.role === 'user' ? 'You' : 'PJ Assistant'}</span><p>{line.text}</p></div>)}
          <div ref={transcriptEndRef} />
        </div>
        {error && <div className="pj-error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ marginLeft: 8, color: '#ffe2d8', background: 'transparent', border: 0, cursor: 'pointer' }}><X size={12} style={{ display: 'inline' }} /> Dismiss</button>
        </div>}
        <div className="pj-chat-compose">
          <form className="pj-text-entry pj-chat-input-row" onSubmit={sendText}>
            <input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Message PJ Assistant…" aria-label="Message PJ Assistant" maxLength={2000} />
            <button className={'pj-icon-action pj-dictation-button' + (isDictating ? ' is-active' : '')} type="button" onClick={toggleDictation} aria-label={isDictating ? 'Stop voice typing' : 'Dictate a message'} title={isDictating ? 'Stop voice typing' : 'Dictate a message'}>{isDictating ? <MicOff size={17} /> : <Mic size={17} />}</button>
            <button className="pj-icon-action pj-inline-live" type="button" onClick={switchToLive} disabled={mode === 'connecting'} aria-label="Start Live Talk" title="Start Live Talk"><AudioLines size={18} /></button>
            <button className="pj-send" type="submit" disabled={!draft.trim()} aria-label="Send message"><ArrowUp size={18} /></button>
          </form>
          <p className="pj-chat-note">AI assistant · Don't share passwords or payment details.</p>
        </div>
        <footer className="pj-footer"><span>© {new Date().getFullYear()} PJ Web Development</span><span>·</span><button onClick={() => setBookingOpen(true)}>Book a consultation</button></footer>
      </>}
    </section>
    {bookingOpen && <div className="pj-booking-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setBookingOpen(false); }}>
      <section className="pj-booking-panel" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}><div><p style={{ margin: 0, color: '#ffbd82', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase' }}>Let's build something</p><h2 id="booking-title" style={{ margin: '7px 0', fontSize: 23, letterSpacing: '-.04em' }}>Send Your Project</h2><p style={{ margin: 0, color: '#b7a7a0', fontSize: 12, lineHeight: 1.7 }}>Tell me the essentials. PJ will review your idea and follow up with the next steps.</p></div><button className="pj-quiet-button" onClick={() => setBookingOpen(false)} aria-label="Close project form"><X size={16} /></button></div>
        <form onSubmit={submitBooking} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12, marginTop: 20 }}>
          <label>Your name<input value={customerName} onChange={e => setCustomerName(e.target.value)} minLength={2} maxLength={120} required placeholder="Full name" /></label>
          <label>Business or project name<input value={businessName} onChange={e => setBusinessName(e.target.value)} minLength={2} maxLength={160} required placeholder="Business name or project title" /></label>
          <label>Project type<select value={businessType} onChange={e => setBusinessType(e.target.value)} required><option value="">Choose a project</option><option>Business website</option><option>Online store</option><option>AI chatbot / assistant</option><option>Web app or dashboard</option><option>Website redesign</option><option>Other digital project</option></select></label>
          <label>Your location<input value={projectLocation} onChange={e => setProjectLocation(e.target.value)} minLength={2} maxLength={120} required placeholder="City or area" /></label>
          <label>Consultation date<input type="date" value={date} min={localDate()} onChange={e => { setDate(e.target.value); setSelectedSlot(''); }} required /></label>
          <label>Available consultation time<select value={selectedSlot} onChange={e => setSelectedSlot(e.target.value)} required disabled={slots.length === 0}><option value="">{slots.length ? 'Choose an available time' : 'No available times for this date'}</option>{slots.map(slot => <option key={slot.start} value={slot.start}>{new Date(slot.start).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Johannesburg' })}</option>)}</select></label>
          <label>Phone or WhatsApp<input value={customerContact} onChange={e => setCustomerContact(e.target.value)} minLength={5} maxLength={160} required placeholder="Your phone or WhatsApp number" /></label>
          <label>Budget range<select value={projectPackage} onChange={e => setProjectPackage(e.target.value)} required><option value="Not sure yet">Not sure yet</option><option>Starter</option><option>Standard</option><option>Premium</option></select></label>
          <label style={{ gridColumn: '1 / -1' }}>What do you want to achieve?<textarea value={projectGoal} onChange={e => setProjectGoal(e.target.value)} minLength={10} maxLength={1200} rows={3} required placeholder="Tell me what you want built and what it should help you do…" /></label>
          <label style={{ gridColumn: '1 / -1' }}>Extra details (optional)<textarea value={projectNotes} onChange={e => setProjectNotes(e.target.value)} maxLength={1200} rows={2} placeholder="Features, deadline, existing website, or anything else useful…" /></label>
          {bookingError && <p role="alert" style={{ gridColumn: '1 / -1', color: '#ffb3a4', fontSize: 12 }}>{bookingError}</p>}
          {bookingMessage && <p role="status" style={{ gridColumn: '1 / -1', color: '#a7f3d0', fontSize: 12 }}>{bookingMessage}</p>}
          <button className="pj-booking-submit" type="submit" disabled={bookingLoading || !selectedSlot}>{bookingLoading ? 'Sending request…' : 'Request Consultation'}</button>
        </form>
        <p style={{ color: '#8c7d7c', fontSize: 10, lineHeight: 1.6, marginBottom: 0 }}>This sends a consultation request for PJ to review. It is not confirmed until PJ contacts you. Please don't include passwords or payment details.</p>
      </section>
    </div>}
  </main>;
}
