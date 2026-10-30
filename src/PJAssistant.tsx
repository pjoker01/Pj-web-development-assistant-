import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Conversation } from '@elevenlabs/client';
import { ArrowLeft, ArrowUp, AudioLines, BriefcaseBusiness, CheckCircle2, ChevronDown, Mic, MicOff, PhoneOff, ShieldCheck, Sparkles, Volume2, X } from 'lucide-react';
import './PJSunset.css';

const AGENT_ID = 'agent_7301m5zb2r3efxr9s2dtr76m4fjy';
const PJ_ASSISTANT_API = 'https://chat.pjwebdev.online/api/pj-assistant';
type Slot = { start: string; end: string; available: boolean };
type ChatLine = { id: number; role: 'user' | 'agent'; text: string };
type VoiceMode = 'idle' | 'connecting' | 'listening' | 'speaking';
const localDate = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };

function SunsetOrb({ mode }: { mode: VoiceMode }) {
  return <div className={'orb-stage orb-' + mode} aria-label={mode === 'listening' ? 'PJ Assistant is listening' : mode === 'speaking' ? 'PJ Assistant is speaking' : 'PJ sunset assistant'}>
    <div className="orb-aura aura-one" /><div className="orb-aura aura-two" /><div className="orb-ring ring-one" /><div className="orb-ring ring-two" />
    <div className="sun-orb"><div className="sun-corona" /><div className="sun-gloss" /><div className="sun-plasma plasma-one" /><div className="sun-plasma plasma-two" /><div className="sun-limb" /></div>
    <div className="mist mist-back" /><div className="mist mist-front" /><div className="orb-spark spark-one" /><div className="orb-spark spark-two" /><div className="orb-spark spark-three" />
  </div>;
}

export default function PJAssistant() {
  const conversationRef = useRef<any>(null);
  const endRequestedRef = useRef(false);
  const lastVoiceErrorRef = useRef('');
  const nextMessageId = useRef(1);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [intro, setIntro] = useState(true);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [mode, setMode] = useState<VoiceMode>('idle');
  const [status, setStatus] = useState('Ready when you are');
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const chatSessionIdRef = useRef('pjassistant-' + (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const speechRecognitionRef = useRef<any>(null);
  const [error, setError] = useState('');
  const nativeRecognitionRef = useRef<any>(null);
  const [nativeVoiceListening, setNativeVoiceListening] = useState(false);
  const nativeVoiceActiveRef = useRef(false);
  const [nativeVoiceActive, setNativeVoiceActive] = useState(false);
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
    fetch(PJ_ASSISTANT_API + '/booking-availability?date=' + encodeURIComponent(date))
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
    endRequestedRef.current = false;
    lastVoiceErrorRef.current = '';
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
          if (next === 'disconnected') {
            conversationRef.current = null;
            setMode('idle');
            // Text-only sessions must never switch the visitor into Live Talk.
            // The previous shared handler did that after any failed connection.
            if (textOnly) {
              setIsLiveMode(false);
              setStatus('Text chat disconnected');
              if (!endRequestedRef.current) {
                setError(lastVoiceErrorRef.current || 'PJ Assistant could not connect. Please try again.');
              }
            } else if (endRequestedRef.current) {
              setIsLiveMode(false);
              setStatus('Ready when you are');
            } else {
              setIsLiveMode(true);
              setStatus('Live Talk unavailable');
              setError(lastVoiceErrorRef.current || 'Live Talk disconnected before it could start. Please try again.');
            }
          }
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
          const text = typeof transcript === 'string' ? transcript : transcript?.user_transcription_event?.user_transcript || transcript?.transcription_event?.user_transcript || transcript?.message || transcript?.text || transcript?.transcript || '';
          if (text) addLine('user', text);
        },
        onError: (event: any) => {
          const message = typeof event === 'string' ? event : event?.message || 'The voice connection was interrupted. Please try again.';
          const quotaExceeded = /quota_exceeded|run out of credits|out of credits|insufficient credits/i.test(message);
          const quotaMessage = quotaExceeded
            ? 'ElevenLabs Live Voice is temporarily unavailable because the account has run out of credits. Continue this conversation with PJ Native Voice or text chat — your recent conversation will carry over.'
            : message;
          lastVoiceErrorRef.current = quotaMessage;
          conversationRef.current = null;
          if (quotaExceeded) endRequestedRef.current = true;
          setError(quotaMessage);
          setMode('idle');
          setIsLiveMode(false);
          setStatus(quotaExceeded ? 'PJ Native Voice is ready' : 'Live Talk unavailable');
        }
      } as any);
      conversationRef.current = conversation;
      setMode('listening'); setStatus(textOnly ? 'Ready for your message' : 'Listening to you');
    } catch (e: any) {
      setMode('idle'); setStatus('Ready when you are');
      setError(e?.message || 'Could not start voice. Check microphone permission and try again.');
    }
  };

  const switchToLive = async () => {
    if (conversationRef.current && !isLiveMode) {
      const current = conversationRef.current;
      conversationRef.current = null;
      try { await current.endSession(); } catch { /* Text session may already have ended. */ }
      setMode('idle');
    }
    await startConversation(false);
  };

  const endVoice = async () => {
    endRequestedRef.current = true;
    setIsLiveMode(false);
    const current = conversationRef.current; conversationRef.current = null;
    try { await current?.endSession(); } catch { /* Already ended. */ }
    setMode('idle'); setStatus('Ready when you are');
  };

  const sendText = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;
    setIsSending(true);
    setError('');
    addLine('user', text);
    setDraft('');
    try {
      const response = await fetch(PJ_ASSISTANT_API + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: chatSessionIdRef.current,
          history: messages.slice(-20).map(line => ({
            role: line.role === 'agent' ? 'assistant' : 'user',
            content: line.text,
          })),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (typeof body.sessionId === 'string' && body.sessionId) {
        const sessionChanged = body.sessionId !== chatSessionIdRef.current;
        chatSessionIdRef.current = body.sessionId;
        if (sessionChanged) {
          setMessages(current => current.filter(line =>
            !(line.role === 'agent' && /7-day free trial has ended|seven-day free trial has ended|shop and online services are temporarily unavailable/i.test(line.text))
          ));
        }
      }
      if (typeof body.sessionId === 'string' && body.sessionId) {
        const sessionChanged = body.sessionId !== chatSessionIdRef.current;
        chatSessionIdRef.current = body.sessionId;
        if (sessionChanged) {
          setMessages(current => current.filter(line =>
            !(line.role === 'agent' && /7-day free trial has ended|seven-day free trial has ended|shop and online services are temporarily unavailable/i.test(line.text))
          ));
        }
      }
      if (!response.ok || typeof body.reply !== 'string' || !body.reply.trim()) {
        throw new Error(body.error || 'PJ Assistant could not answer just now. Please try again.');
      }
      addLine('agent', body.reply);
      setStatus('Ready for your message');
    } catch (e: any) {
      setError(e?.message || 'That message could not be sent. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const startNativeRecognition = () => {
    if (!nativeVoiceActiveRef.current) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      nativeVoiceActiveRef.current = false;
      setNativeVoiceActive(false);
      setError('This browser does not support native voice input. You can continue by typing, or use your phone keyboard microphone.');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      nativeRecognitionRef.current = recognition;
      recognition.lang = 'en-ZA';
      recognition.interimResults = false;
      recognition.continuous = false;
      recognition.onstart = () => {
        setNativeVoiceListening(true);
        setError('');
        setStatus('PJ Native Voice is listening');
      };
      recognition.onresult = (event: any) => {
        const spoken = String(event?.results?.[0]?.[0]?.transcript || '').trim();
        setNativeVoiceListening(false);
        if (spoken) void sendNativeVoiceMessage(spoken);
      };
      recognition.onerror = (event: any) => {
        setNativeVoiceListening(false);
        if (event?.error === 'no-speech' && nativeVoiceActiveRef.current) {
          window.setTimeout(() => {
            if (nativeVoiceActiveRef.current) startNativeRecognition();
          }, 350);
        } else if (event?.error !== 'aborted') {
          nativeVoiceActiveRef.current = false;
          setNativeVoiceActive(false);
          setError('Microphone access was interrupted. Check your browser microphone permission and try again.');
        }
      };
      recognition.onend = () => setNativeVoiceListening(false);
      recognition.start();
    } catch {
      nativeVoiceActiveRef.current = false;
      setNativeVoiceActive(false);
      setNativeVoiceListening(false);
      setError('PJ Native Voice could not start. Check microphone permission and try again.');
    }
  };

  const sendNativeVoiceMessage = async (spoken: string) => {
    const history = messages.slice(-20).map(line => ({
      role: line.role === 'agent' ? 'assistant' : 'user',
      content: line.text,
    }));
    addLine('user', spoken);
    setError('');
    setStatus('Thinking…');
    const resumeListening = () => {
      if (nativeVoiceActiveRef.current) startNativeRecognition();
    };
    try {
      const response = await fetch(PJ_ASSISTANT_API + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: spoken, sessionId: chatSessionIdRef.current, history }),
      });
      const body = await response.json().catch(() => ({}));
      if (typeof body.sessionId === 'string' && body.sessionId) {
        const sessionChanged = body.sessionId !== chatSessionIdRef.current;
        chatSessionIdRef.current = body.sessionId;
        if (sessionChanged) {
          setMessages(current => current.filter(line =>
            !(line.role === 'agent' && /7-day free trial has ended|seven-day free trial has ended|shop and online services are temporarily unavailable/i.test(line.text))
          ));
        }
      }
      if (!response.ok || typeof body.reply !== 'string' || !body.reply.trim()) {
        throw new Error(body.error || 'PJ Assistant could not answer just now. Please try again.');
      }
      addLine('agent', body.reply);
      setStatus('PJ Native Voice is ready');
      if ('speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined') {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(body.reply);
        utterance.lang = 'en-ZA';
        utterance.rate = 1;
        utterance.onend = resumeListening;
        utterance.onerror = resumeListening;
        window.speechSynthesis.speak(utterance);
      } else {
        resumeListening();
      }
    } catch (e: any) {
      setError(e?.message || 'PJ Native Voice could not answer just now. Please try again.');
      setStatus('PJ Native Voice is ready');
      resumeListening();
    }
  };

  const startNativeVoice = () => {
    if (nativeVoiceActiveRef.current) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('This browser does not support native voice input. You can continue by typing, or use your phone keyboard microphone.');
      return;
    }
    nativeVoiceActiveRef.current = true;
    setNativeVoiceActive(true);
    setError('');
    startNativeRecognition();
  };

  const stopNativeVoice = () => {
    nativeVoiceActiveRef.current = false;
    setNativeVoiceActive(false);
    try { nativeRecognitionRef.current?.stop(); } catch { /* Already stopped. */ }
    try { window.speechSynthesis?.cancel(); } catch { /* Speech may already be stopped. */ }
    setNativeVoiceListening(false);
    setStatus('Ready for your message');
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
    } catch {
      setIsDictating(false);
      setError('Microphone typing could not start. Check browser microphone permission.');
    }
  };

  const submitBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBookingLoading(true); setBookingError(''); setBookingMessage('');
    try {
      const features = [businessType, projectPackage ? 'Budget preference: ' + projectPackage : 'Budget: not sure yet'];
      const response = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          business_name: businessName.trim(),
          business_type: businessType,
          location: projectLocation.trim(),
          customer_whatsapp: customerContact.trim(),
          website_goal: projectGoal.trim(),
          requested_features: features,
          recommended_package: projectPackage || 'Standard',
          additional_requirements: projectNotes.trim() || 'No extra details supplied',
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.success !== true) throw new Error(body.error || 'Your project enquiry could not be saved. Please try again.');
      setBookingMessage('Your project enquiry has been sent. PJ will review it and follow up.');
      setCustomerName(''); setBusinessName(''); setBusinessType(''); setProjectLocation(''); setProjectGoal(''); setCustomerContact(''); setProjectNotes(''); setProjectPackage('');
    } catch (e: any) { setBookingError(e?.message || 'Unable to send your project enquiry. Please try again.'); }
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
          {textMode && <form className="pj-text-entry" onSubmit={sendText}><input ref={inputRef} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Type a message…" aria-label="Message PJ Assistant" maxLength={2000} /><button className="pj-send" type="submit" disabled={!draft.trim() || isSending} aria-label="Send message"><ArrowUp size={18} /></button></form>}
          <button className="pj-text-toggle" onClick={() => setTextMode(value => !value)}>{textMode ? <><ChevronDown size={14} /> Hide typing</> : <><Sparkles size={14} /> Type a message</>}</button>
        </div>
      </> : <>
        <div className="pj-chat-heading"><div className="pj-eyebrow">PJ WEB DEVELOPMENT</div><h1 className="pj-title">Hey there. <span>What's on your mind?</span></h1><p className="pj-subtitle">Ask anything about PJ Web Development — websites, online stores, AI assistants, bookings, business showcases, custom software or digital growth. Type or switch to live voice anytime.</p></div>
        <div className="pj-chat-window" aria-live="polite" aria-relevant="additions text">
          {messages.length === 0 && <div className="pj-empty-chat"><div className="pj-chat-sun"><Sparkles size={24} /></div><strong>Let's start with your idea.</strong><span>Send a message below, or tap Live Talk to speak naturally.</span></div>}
          {messages.map(line => <div key={line.id} className={'pj-chat-message ' + line.role}><span>{line.role === 'user' ? 'You' : 'PJ Assistant'}</span><p>{line.text}</p></div>)}
          <div ref={transcriptEndRef} />
        </div>
        {error && <div className="pj-error" role="alert">
          {error}
          {(nativeVoiceActive || /ElevenLabs Live Voice is temporarily unavailable/i.test(error)) && <button className="pj-text-toggle" onClick={nativeVoiceActive ? stopNativeVoice : startNativeVoice} style={{ marginLeft: 8 }}><Mic size={14} /> {nativeVoiceListening ? 'Listening…' : nativeVoiceActive ? 'Stop PJ Native Voice' : 'Continue with PJ Native Voice'}</button>}
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
          <label>Phone or WhatsApp<input value={customerContact} onChange={e => setCustomerContact(e.target.value)} minLength={5} maxLength={160} required placeholder="Your phone or WhatsApp number" /></label>
          <label>Budget range<select value={projectPackage} onChange={e => setProjectPackage(e.target.value)} required><option value="">Not sure yet</option><option>Starter</option><option>Standard</option><option>Premium</option></select></label>
          <label style={{ gridColumn: '1 / -1' }}>What do you want to achieve?<textarea value={projectGoal} onChange={e => setProjectGoal(e.target.value)} minLength={10} maxLength={1200} rows={3} required placeholder="Tell me what you want built and what it should help you do…" /></label>
          <label style={{ gridColumn: '1 / -1' }}>Extra details (optional)<textarea value={projectNotes} onChange={e => setProjectNotes(e.target.value)} maxLength={1200} rows={2} placeholder="Features, deadline, existing website, or anything else useful…" /></label>
          {bookingError && <p role="alert" style={{ gridColumn: '1 / -1', color: '#ffb3a4', fontSize: 12 }}>{bookingError}</p>}
          {bookingMessage && <p role="status" style={{ gridColumn: '1 / -1', color: '#a7f3d0', fontSize: 12 }}>{bookingMessage}</p>}
          <button className="pj-booking-submit" type="submit" disabled={bookingLoading}>{bookingLoading ? 'Sending project…' : 'Send Project Enquiry'}</button>
        </form>
        <p style={{ color: '#8c7d7c', fontSize: 10, lineHeight: 1.6, marginBottom: 0 }}>Your details are used to respond to this enquiry. Please don't include passwords or payment details.</p>
      </section>
    </div>}
  </main>;
}
