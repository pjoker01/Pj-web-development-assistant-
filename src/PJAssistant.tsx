import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';

import { ArrowLeft, ArrowUp, AudioLines, BriefcaseBusiness, CheckCircle2, Mic, MicOff, PhoneOff, ShieldCheck, Sparkles, X } from 'lucide-react';
import './PJSunset.css';
import { getConsultationAvailability, sendAssistantMessage, submitConsultationRequest, submitPJAssistantLead, transcribeAssistantAudio } from './assistant/api/assistant-api';
import { createPJVoiceSession } from './assistant/voice/pj-voice-agent';

type Slot = { start: string; end: string; available: boolean };
type ChatLine = { id: number; role: 'user' | 'agent'; text: string };
type VoiceMode = 'idle' | 'connecting' | 'listening' | 'speaking';
const WELCOME_MESSAGE = "Hi, welcome to PJ Web Development. I'm PJ Assistant. What can I help you with today?";
const localDate = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };
const preferredPJVoice = () => {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const english = voices.filter(voice => /^en([_-]|$)/i.test(voice.lang));
  const maleName = /(male|daniel|david|george|james|oliver|ryan|thomas|arthur|alex|fred|aaron|guy|liam|matthew|andrew|mark|tom|lee|rishi|brian)/i;
  return english.find(voice => /en[-_]ZA/i.test(voice.lang) && maleName.test(voice.name))
    || english.find(voice => /en[-_]GB/i.test(voice.lang) && maleName.test(voice.name))
    || english.find(voice => /en[-_]US/i.test(voice.lang) && maleName.test(voice.name))
    || english.find(voice => maleName.test(voice.name))
    || english.find(voice => /en[-_]ZA/i.test(voice.lang))
    || english.find(voice => /en[-_]GB/i.test(voice.lang))
    || english[0] || null;
};
const makeSpeechFriendly = (value: string) => value
  .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/^\s*\|?[-:\s|]+\|?\s*$/gm, '')
  .replace(/\|/g, ', ')
  .replace(/^\s*[-*+]\s+/gm, '')
  .replace(/\*\*|__|[*_~#]/g, '')
  .split(String.fromCharCode(96)).join('')
  .replace(/\s*\/\s*/g, ' or ')
  .replace(/[—–]/g, ', ')
  .replace(/\s{2,}/g, ' ')
  .trim();

function SunsetOrb({ mode }: { mode: VoiceMode }) {
  return <div className={'orb-stage orb-' + mode} aria-label={mode === 'listening' ? 'PJ Assistant is listening' : mode === 'speaking' ? 'PJ Assistant is speaking' : 'PJ sunset assistant'}>
    <div className="orb-aura aura-one" /><div className="orb-aura aura-two" /><div className="orb-ring ring-one" /><div className="orb-ring ring-two" />
    <div className="sun-orb"><div className="sun-corona" /><div className="sun-gloss" /><div className="sun-plasma plasma-one" /><div className="sun-plasma plasma-two" /><div className="sun-limb" /></div>
    <div className="mist mist-back" /><div className="mist mist-front" /><div className="orb-spark spark-one" /><div className="orb-spark spark-two" /><div className="orb-spark spark-three" />
  </div>;
}

export default function PJAssistant() {
  const nextMessageId = useRef(2);
  const speechRecognitionRef = useRef<any>(null);
  const voiceSessionRef = useRef<ReturnType<typeof createPJVoiceSession> | null>(null);
  const lastVoiceStateRef = useRef<string>('idle');
  const liveAssistantTextRef = useRef('');
  const [liveAssistantDraft, setLiveAssistantDraft] = useState('');
  const [voiceLevel, setVoiceLevel] = useState(0);
  const liveFinalTranscriptRef = useRef('');
  const liveActiveRef = useRef(false);
  const liveRestartTimerRef = useRef<number | null>(null);
  const [isLiveRecording, setIsLiveRecording] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<VoiceMode>('idle');
  const [liveDraft, setLiveDraft] = useState('');
  const [status, setStatus] = useState('Ready when you are');
  const [messages, setMessages] = useState<ChatLine[]>([{ id: 1, role: 'agent', text: WELCOME_MESSAGE }]);
  const chatSessionIdRef = useRef('pjassistant-' + (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)));
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const recordingIntervalRef = useRef<number | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
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
  const [leadPromptVisible, setLeadPromptVisible] = useState(false);
  const [leadFormOpen, setLeadFormOpen] = useState(false);
  const [leadReviewOpen, setLeadReviewOpen] = useState(false);
  const [leadSaving, setLeadSaving] = useState(false);
  const [leadId, setLeadId] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadProjectType, setLeadProjectType] = useState('');
  const [leadTimeframe, setLeadTimeframe] = useState('');
  const [leadSummary, setLeadSummary] = useState('');
  const [leadError, setLeadError] = useState('');
  const [leadSavedMessage, setLeadSavedMessage] = useState('');

  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, liveDraft]);
  useEffect(() => { const el = inputRef.current; if (!el) return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 112) + 'px'; }, [draft, textMode, mode]);
  useEffect(() => {
    if (!bookingOpen) return;
    let cancelled = false;
    setSlots([]); setSelectedSlot(''); setBookingError('');
    getConsultationAvailability(date)
      .then(availableSlots => { if (!cancelled) setSlots(availableSlots); })
      .catch(error => { if (!cancelled) setBookingError(error.message || 'Unable to load availability.'); });
    return () => { cancelled = true; };
  }, [date, bookingOpen]);
  useEffect(() => {
    document.title = 'PJ Assistant — Talk with PJ';
    return () => {
      const activeVoiceSession = voiceSessionRef.current;
      voiceSessionRef.current = null;
      try { activeVoiceSession?.destroy(); } catch { /* Voice session already closed. */ }
      const recognition = speechRecognitionRef.current;
      speechRecognitionRef.current = null;
      liveActiveRef.current = false;
      if (liveRestartTimerRef.current !== null) window.clearTimeout(liveRestartTimerRef.current);
      try { recognition?.stop(); } catch { /* Recognition may already be stopped. */ }
      try { window.speechSynthesis?.cancel(); } catch { /* Speech may already be stopped. */ }
      if (recordingTimeoutRef.current !== null) window.clearTimeout(recordingTimeoutRef.current);
      try {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.onstop = null;
          mediaRecorderRef.current.ondataavailable = null;
          mediaRecorderRef.current.onerror = null;
          if (mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
        }
      } catch { /* Recorder may already be stopped. */ }
      recordingStreamRef.current?.getTracks().forEach(track => track.stop());
      recordingStreamRef.current = null;
    };
  }, []);

  const addLine = (role: ChatLine['role'], text: string) => {
    const clean = text?.trim();
    if (clean) {
      setMessages(previous => [...previous, { id: nextMessageId.current++, role, text: clean }].slice(-60));
      if (role === 'user' && !leadId && /(i need|i want|looking for|interested in|want to build|need a|website|online store|chatbot|voice assistant|web app|redesign|quote|quotation|pricing)/i.test(clean)) setLeadPromptVisible(true);
    }
  };

  const sendLiveTurn = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || !voiceSessionRef.current) return;
    addLine('user', text);
    setLiveDraft('');
    const accepted = voiceSessionRef.current.sendUserText(text);
    if (!accepted) setError('PJ Live is reconnecting. Please try speaking again.');
  };

  const switchToLive = async () => {
    const BrowserSpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!BrowserSpeechRecognition) {
      setError('Hands-free Live Talk needs Chrome on Android with microphone permission enabled.');
      return;
    }
    setError('');
    // Live Talk speaks its own greeting; remove the static chat greeting so it is not shown twice.
    setMessages([]);
    setTextMode(true); setDraft(''); setLiveDraft(''); setLiveAssistantDraft('');
    // The voice agent owns the single welcome message; do not also insert a UI greeting.
    liveActiveRef.current = true;
    lastVoiceStateRef.current = 'connecting';
    liveAssistantTextRef.current = '';
    const session = createPJVoiceSession({
      getSessionId: () => chatSessionIdRef.current,
      setSessionId: (sessionId) => { chatSessionIdRef.current = sessionId; },
      onEvent: (event: any) => {
        if (event.type === 'state') {
          const next = event.state === 'speaking' ? 'speaking'
            : event.state === 'thinking' ? 'connecting'
            : event.state === 'listening' ? 'listening' : 'connecting';
          if (event.state === 'listening' && lastVoiceStateRef.current === 'speaking' && liveAssistantTextRef.current.trim()) {
            addLine('agent', liveAssistantTextRef.current);
            liveAssistantTextRef.current = '';
            setLiveAssistantDraft('');
          }
          lastVoiceStateRef.current = event.state;
          setMode(next as VoiceMode);
          setStatus(next === 'speaking' ? 'PJ is speaking' : next === 'connecting' ? 'PJ is thinking' : 'Listening — speak when the tone is ready');
        } else if (event.type === 'stt') {
          const text = event.turnComplete ? event.text : [event.committed || '', event.text || ''].join(' ').trim();
          setLiveDraft(text || '');
          if (event.turnComplete && text.trim()) {
            addLine('user', text.trim());
            setLiveDraft('');
          }
        } else if (event.type === 'assistant') {
          const text = String(event.text || event.full || '').trim();
          if (text) {
            liveAssistantTextRef.current = String(event.full || text).trim();
            setLiveAssistantDraft(text);
          }
        } else if (event.type === 'level') {
          setVoiceLevel(Math.max(0, Math.min(1, Number(event.level) || 0)));
        } else if (event.type === 'error') {
          const message = event.error?.message || String(event.error || 'PJ Live encountered a voice error.');
          setError(message);
          // Never leave the orb claiming to speak/listen after the recognizer has failed.
          lastVoiceStateRef.current = 'error';
          setMode('idle');
          setStatus('Voice connection needs attention — close Live Talk and reconnect.');
          setVoiceLevel(0);
        }
      },
    });
    voiceSessionRef.current = session;
    setMode('connecting'); setStatus('Connecting microphone…');
    try {
      await session.start();
      void session.notify('[PJ_GREETING]');
    } catch (err: any) {
      voiceSessionRef.current = null;
      liveActiveRef.current = false;
      setMode('idle');
      setError(err?.message || 'PJ Live could not start. Check microphone permission and try again.');
    }
  };

  const endVoice = () => {
    liveActiveRef.current = false;
    if (liveRestartTimerRef.current !== null) window.clearTimeout(liveRestartTimerRef.current);
    liveRestartTimerRef.current = null;
    const session = voiceSessionRef.current;
    voiceSessionRef.current = null;
    try { session?.destroy(); } catch { /* Session may already be closed. */ }
    const recognition = speechRecognitionRef.current;
    speechRecognitionRef.current = null;
    try { recognition?.stop(); } catch { /* Legacy recognition may already be stopped. */ }
    try { window.speechSynthesis?.cancel(); } catch { /* Legacy speech may already be stopped. */ }
    liveAssistantTextRef.current = '';
    setIsLiveRecording(false); setMode('idle'); setLiveDraft(''); setLiveAssistantDraft('');
    setVoiceLevel(0);
    setStatus('Ready for your message');
  };

  const toggleLiveRecording = () => {
    if (voiceSessionRef.current) {
      setError('PJ Live listens automatically. Close Live to end the conversation.');
    }
  };

  const saveLeadDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (leadSaving) return; setLeadSaving(true); setLeadError('');
    try {
      const result = await submitPJAssistantLead({ leadId: leadId || undefined, name: leadName, phone: leadPhone, email: leadEmail, projectType: leadProjectType, timeframe: leadTimeframe, summary: leadSummary, conversationId: chatSessionIdRef.current, stage: 'draft' });
      setLeadId(result.leadId); setLeadFormOpen(false); setLeadPromptVisible(false);
      setLeadSavedMessage('Your contact details are safely saved. We can keep discussing your project, then review everything together.');
      addLine('agent', 'Thanks — I’ve saved your contact details and project outline. Let’s talk through the details, and when you’re ready we can review the full summary together.');
    } catch (err: any) { setLeadError(err?.message || 'I could not save your enquiry. Please try again.'); } finally { setLeadSaving(false); }
  };
  const buildLeadSummary = () => {
    const conversation = messages.slice(-12).map(line => (line.role === 'user' ? 'Customer: ' : 'PJ: ') + line.text).join('\n');
    const outline = leadSummary.trim();
    setLeadSummary([outline ? 'Customer project outline: ' + outline : '', 'Conversation notes:\n' + conversation].filter(Boolean).join('\n\n').slice(0, 5500));
    setLeadReviewOpen(true);
  };
  const confirmLead = async () => {
    if (!leadId || leadSaving) return; setLeadSaving(true); setLeadError('');
    try {
      await submitPJAssistantLead({ leadId, name: leadName, phone: leadPhone, email: leadEmail, projectType: leadProjectType, timeframe: leadTimeframe, summary: leadSummary, conversationId: chatSessionIdRef.current, stage: 'qualified' });
      setLeadReviewOpen(false); setLeadSavedMessage('Your project enquiry is confirmed and has been sent to PJ for follow-up.');
      addLine('agent', 'Perfect — your project brief is confirmed. PJ has received your enquiry and can follow up using the contact details you provided.');
    } catch (err: any) { setLeadError(err?.message || 'I could not confirm your project brief. Please try again.'); } finally { setLeadSaving(false); }
  };
  const sendText = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft('');
    if (mode !== 'idle') {
      await sendLiveTurn(text);
      return;
    }
    setIsSending(true); setError('');
    addLine('user', text);
    try {
      const body = await sendAssistantMessage({
        message: text, sessionId: chatSessionIdRef.current,
        history: messages.filter(line => line.id !== 1).slice(-20).map(line => ({ role: line.role === 'agent' ? 'assistant' as const : 'user' as const, content: line.text })),
      });
      if (body.sessionId) chatSessionIdRef.current = body.sessionId;
      addLine('agent', body.reply);
    } catch (err: any) { setError(err?.message || 'That message could not be sent. Please try again.'); }
    finally { setIsSending(false); }
  };

  const toggleDictation = async () => {
    if (mode !== 'idle') { setError('PJ Live is already listening hands-free. Close Live to use a separate voice note.'); return; }
    if (isDictating) {
      try {
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      } catch {
        setError('The recording could not be stopped. Please try again.');
      }
      return;
    }
    if (isTranscribing) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Audio recording is not supported in this browser. Please use Chrome or type your message.');
      return;
    }

    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      recordingStreamRef.current = stream;
      const supportedTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      const mimeType = supportedTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recordingChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = event => {
        if (event.data?.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        recorder.onstop = null;
        recorder.ondataavailable = null;
        if (recordingTimeoutRef.current !== null) window.clearTimeout(recordingTimeoutRef.current);
        if (recordingIntervalRef.current !== null) window.clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
        recordingTimeoutRef.current = null;
        setError('The microphone recording stopped unexpectedly. Please try again.');
        recordingStreamRef.current?.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        recordingChunksRef.current = [];
        setIsDictating(false);
      };
      recorder.onstop = async () => {
        if (recordingTimeoutRef.current !== null) window.clearTimeout(recordingTimeoutRef.current);
        if (recordingIntervalRef.current !== null) window.clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
        recordingTimeoutRef.current = null;
        const audio = new Blob(recordingChunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        recordingChunksRef.current = [];
        recordingStreamRef.current?.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
        mediaRecorderRef.current = null;
        setIsDictating(false);

        if (!audio.size) {
          setError('I did not receive any audio. Please try recording again.');
          return;
        }
        setIsTranscribing(true);
        setStatus('Transcribing your voice message…');
        try {
          const transcript = await transcribeAssistantAudio(audio);
          setDraft(previous => (previous ? previous + ' ' : '') + transcript);
          setStatus('Ready for your message');
          inputRef.current?.focus();
        } catch (err: any) {
          setError(err?.message || 'Your recording could not be transcribed. Please try again or type your message.');
          setStatus('Ready for your message');
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start(250);
      setIsDictating(true);
      setStatus('Listening — tap the microphone again to finish');
      recordingTimeoutRef.current = window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      }, 30000);
    } catch (err: any) {
      recordingStreamRef.current?.getTracks().forEach(track => track.stop());
      recordingStreamRef.current = null;
      mediaRecorderRef.current = null;
      setIsDictating(false);
      setError(/not.?allowed|permission|denied/i.test(err?.message || '')
        ? 'Microphone access was blocked. In Chrome, open Site settings for assistant.pjwebdev.online, allow Microphone, then try again.'
        : err?.message || 'The microphone could not start. Check browser permission and try again.');
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
    <header className="pj-topbar">
      <a className="pj-brand" href="https://pjwebdev.online" aria-label="PJ Web Development home"><img src="https://raw.githubusercontent.com/pjoker01/Pj-ai-chat-platform-/main/public/pj-ai-icon-512.jpg" alt="" /><span>PJ <span style={{ color: '#ffb978' }}>ASSISTANT</span></span></a>
      <div className="pj-top-actions"><button className="pj-quiet-button" onClick={() => setBookingOpen(true)}><BriefcaseBusiness size={14} /> Send Your Project</button><a className="pj-quiet-button" href="https://pjwebdev.online" aria-label="Visit PJ Web Development"><ArrowLeft size={14} /> Website</a></div>
    </header>
    <section className={mode !== 'idle' ? 'pj-center pj-live-view' : 'pj-center pj-chat-view'}>
      {mode !== 'idle' ? <>
        <div className="pj-live-minihead"><span className="pj-live-mark"><span className="pj-status-dot" /> PJ LIVE</span><button className="pj-quiet-button" onClick={endVoice}><X size={14} /> Close live</button></div>
        <SunsetOrb mode={mode} />
        <div className={"pj-transcript pj-live-transcript pj-live-cloud" + (mode === "listening" ? " is-recording" : "")} style={{ ["--pj-voice-level" as any]: voiceLevel }} aria-live="polite" aria-relevant="additions text">
          {messages.filter(line => line.id !== 1).slice(-5).map(line => <div key={line.id} className={'pj-line ' + line.role}>{line.text}</div>)}
          {liveDraft && <div className="pj-line user pj-live-interim" aria-label="Live transcription">{liveDraft}</div>}
          {liveAssistantDraft && <div className="pj-line agent pj-live-interim" aria-label="PJ speaking">{liveAssistantDraft}</div>}
          <div ref={transcriptEndRef} />
        </div>
        {leadPromptVisible && !leadId && !leadFormOpen && <div className="pj-lead-invite"><div><strong>Want PJ to follow up on your project?</strong><p>Share a few details and keep chatting. It only takes a moment.</p></div><button type="button" onClick={() => setLeadFormOpen(true)}>Add my details</button><button type="button" className="pj-lead-dismiss" onClick={() => setLeadPromptVisible(false)}>Not now</button></div>}
        {leadFormOpen && <form className="pj-lead-card" onSubmit={saveLeadDraft}><div className="pj-lead-card-head"><strong>Let’s keep your project together</strong><span>Quick enquiry</span></div><label>Your name<input required minLength={2} maxLength={100} value={leadName} onChange={e => setLeadName(e.target.value)} placeholder="Full name" /></label><label>Phone or WhatsApp<input required minLength={5} maxLength={40} value={leadPhone} onChange={e => setLeadPhone(e.target.value)} placeholder="+27…" /></label><label>Email (optional)<input type="email" maxLength={120} value={leadEmail} onChange={e => setLeadEmail(e.target.value)} placeholder="you@example.com" /></label><label>What do you want to build?<input required maxLength={120} value={leadProjectType} onChange={e => setLeadProjectType(e.target.value)} placeholder="Website, online store, AI assistant…" /></label><label>When would you like to start?<select required value={leadTimeframe} onChange={e => setLeadTimeframe(e.target.value)}><option value="">Choose a timeframe</option><option>As soon as possible</option><option>Within 2–4 weeks</option><option>Within 1–3 months</option><option>More than 3 months</option><option>Just exploring</option></select></label><label>Project outline<textarea required minLength={8} maxLength={1500} rows={2} value={leadSummary} onChange={e => setLeadSummary(e.target.value)} placeholder="A few words about what you need…" /></label>{leadError && <p role="alert">{leadError}</p>}<div className="pj-lead-actions"><button type="submit" disabled={leadSaving}>{leadSaving ? "Saving…" : "Save details and continue"}</button><button type="button" className="pj-lead-dismiss" onClick={() => setLeadFormOpen(false)}>Not now</button></div></form>}
        {leadId && !leadReviewOpen && <div className="pj-lead-saved"><span>{leadSavedMessage || "Your contact details are saved."}</span><button type="button" onClick={buildLeadSummary}>Review project summary</button></div>}
        {leadReviewOpen && <div className="pj-lead-card"><div className="pj-lead-card-head"><strong>Review your project brief</strong><span>Final check</span></div><p>Check the details and conversation summary. You can edit the summary before sending it to PJ.</p><label>Project summary<textarea rows={5} value={leadSummary} onChange={e => setLeadSummary(e.target.value)} /></label>{leadError && <p role="alert">{leadError}</p>}<div className="pj-lead-actions"><button type="button" onClick={confirmLead} disabled={leadSaving}>{leadSaving ? "Confirming…" : "Confirm and send to PJ"}</button><button type="button" className="pj-lead-dismiss" onClick={() => setLeadReviewOpen(false)}>Keep discussing</button></div></div>}
        {leadPromptVisible && !leadId && !leadFormOpen && <div className="pj-lead-invite"><strong>Would you like PJ to follow up on your project?</strong><button type="button" onClick={() => setLeadFormOpen(true)}>Add contact details</button><button type="button" onClick={() => setLeadPromptVisible(false)}>Not now</button></div>}
        {leadFormOpen && <form className="pj-lead-card" onSubmit={saveLeadDraft}><strong>Project enquiry</strong><label>Your name<input required value={leadName} onChange={e => setLeadName(e.target.value)} /></label><label>Phone or WhatsApp<input required value={leadPhone} onChange={e => setLeadPhone(e.target.value)} /></label><label>Email (optional)<input type="email" value={leadEmail} onChange={e => setLeadEmail(e.target.value)} /></label><label>Project type<input required value={leadProjectType} onChange={e => setLeadProjectType(e.target.value)} placeholder="Website, online store, AI assistant…" /></label><label>When would you like to start?<select required value={leadTimeframe} onChange={e => setLeadTimeframe(e.target.value)}><option value="">Choose timeframe</option><option>As soon as possible</option><option>Within 2–4 weeks</option><option>Within 1–3 months</option><option>More than 3 months</option><option>Just exploring</option></select></label><label>Project outline<textarea required minLength={8} value={leadSummary} onChange={e => setLeadSummary(e.target.value)} /></label>{leadError && <p role="alert">{leadError}</p>}<button type="submit" disabled={leadSaving}>{leadSaving ? "Saving…" : "Save details and continue"}</button><button type="button" onClick={() => setLeadFormOpen(false)}>Cancel</button></form>}
        {leadId && <div className="pj-lead-saved"><span>{leadSavedMessage || "Your contact details are saved."}</span><button type="button" onClick={buildLeadSummary}>Review project summary</button></div>}
        {leadReviewOpen && <div className="pj-lead-card"><strong>Review your project brief</strong><textarea rows={5} value={leadSummary} onChange={e => setLeadSummary(e.target.value)} /><p>Confirm only when the summary is correct.</p>{leadError && <p role="alert">{leadError}</p>}<button type="button" onClick={confirmLead} disabled={leadSaving}>{leadSaving ? "Confirming…" : "Confirm and send to PJ"}</button><button type="button" onClick={() => setLeadReviewOpen(false)}>Keep discussing</button></div>}
        <div className={'pj-live-status is-' + mode} role="status"><span className="pj-status-dot" />{mode === 'speaking' ? 'Speaking' : mode === 'connecting' ? 'Connecting' : 'Listening'}</div>
        {leadPromptVisible && !leadId && !leadFormOpen && <div className="pj-lead-invite"><div><strong>Want PJ to follow up on your project?</strong><p>Share a few details and keep chatting. It only takes a moment.</p></div><button type="button" onClick={() => setLeadFormOpen(true)}>Add my details</button><button type="button" className="pj-lead-dismiss" onClick={() => setLeadPromptVisible(false)}>Not now</button></div>}
        {leadFormOpen && <form className="pj-lead-card" onSubmit={saveLeadDraft}><div className="pj-lead-card-head"><strong>Let’s keep your project together</strong><span>Quick enquiry</span></div><label>Your name<input required minLength={2} maxLength={100} value={leadName} onChange={e => setLeadName(e.target.value)} placeholder="Full name" /></label><label>Phone or WhatsApp<input required minLength={5} maxLength={40} value={leadPhone} onChange={e => setLeadPhone(e.target.value)} placeholder="+27…" /></label><label>Email (optional)<input type="email" maxLength={120} value={leadEmail} onChange={e => setLeadEmail(e.target.value)} placeholder="you@example.com" /></label><label>What do you want to build?<input required maxLength={120} value={leadProjectType} onChange={e => setLeadProjectType(e.target.value)} placeholder="Website, online store, AI assistant…" /></label><label>When would you like to start?<select required value={leadTimeframe} onChange={e => setLeadTimeframe(e.target.value)}><option value="">Choose a timeframe</option><option>As soon as possible</option><option>Within 2–4 weeks</option><option>Within 1–3 months</option><option>More than 3 months</option><option>Just exploring</option></select></label><label>Project outline<textarea required minLength={8} maxLength={1500} rows={2} value={leadSummary} onChange={e => setLeadSummary(e.target.value)} placeholder="A few words about what you need…" /></label>{leadError && <p role="alert">{leadError}</p>}<div className="pj-lead-actions"><button type="submit" disabled={leadSaving}>{leadSaving ? "Saving…" : "Save details and continue"}</button><button type="button" className="pj-lead-dismiss" onClick={() => setLeadFormOpen(false)}>Not now</button></div></form>}
        {leadId && !leadReviewOpen && <div className="pj-lead-saved"><span>{leadSavedMessage || "Your contact details are saved."}</span><button type="button" onClick={buildLeadSummary}>Review project summary</button></div>}
        {leadReviewOpen && <div className="pj-lead-card"><div className="pj-lead-card-head"><strong>Review your project brief</strong><span>Final check</span></div><p>Check the details and conversation summary. You can edit the summary before sending it to PJ.</p><label>Project summary<textarea rows={5} value={leadSummary} onChange={e => setLeadSummary(e.target.value)} /></label>{leadError && <p role="alert">{leadError}</p>}<div className="pj-lead-actions"><button type="button" onClick={confirmLead} disabled={leadSaving}>{leadSaving ? "Confirming…" : "Confirm and send to PJ"}</button><button type="button" className="pj-lead-dismiss" onClick={() => setLeadReviewOpen(false)}>Keep discussing</button></div></div>}
        {leadPromptVisible && !leadId && !leadFormOpen && <div className="pj-lead-invite"><strong>Would you like PJ to follow up on your project?</strong><button type="button" onClick={() => setLeadFormOpen(true)}>Add contact details</button><button type="button" onClick={() => setLeadPromptVisible(false)}>Not now</button></div>}
        {leadFormOpen && <form className="pj-lead-card" onSubmit={saveLeadDraft}><strong>Project enquiry</strong><label>Your name<input required value={leadName} onChange={e => setLeadName(e.target.value)} /></label><label>Phone or WhatsApp<input required value={leadPhone} onChange={e => setLeadPhone(e.target.value)} /></label><label>Email (optional)<input type="email" value={leadEmail} onChange={e => setLeadEmail(e.target.value)} /></label><label>Project type<input required value={leadProjectType} onChange={e => setLeadProjectType(e.target.value)} placeholder="Website, online store, AI assistant…" /></label><label>When would you like to start?<select required value={leadTimeframe} onChange={e => setLeadTimeframe(e.target.value)}><option value="">Choose timeframe</option><option>As soon as possible</option><option>Within 2–4 weeks</option><option>Within 1–3 months</option><option>More than 3 months</option><option>Just exploring</option></select></label><label>Project outline<textarea required minLength={8} value={leadSummary} onChange={e => setLeadSummary(e.target.value)} /></label>{leadError && <p role="alert">{leadError}</p>}<button type="submit" disabled={leadSaving}>{leadSaving ? "Saving…" : "Save details and continue"}</button><button type="button" onClick={() => setLeadFormOpen(false)}>Cancel</button></form>}
        {leadId && <div className="pj-lead-saved"><span>{leadSavedMessage || "Your contact details are saved."}</span><button type="button" onClick={buildLeadSummary}>Review project summary</button></div>}
        {leadReviewOpen && <div className="pj-lead-card"><strong>Review your project brief</strong><textarea rows={5} value={leadSummary} onChange={e => setLeadSummary(e.target.value)} /><p>Confirm only when the summary is correct.</p>{leadError && <p role="alert">{leadError}</p>}<button type="button" onClick={confirmLead} disabled={leadSaving}>{leadSaving ? "Confirming…" : "Confirm and send to PJ"}</button><button type="button" onClick={() => setLeadReviewOpen(false)}>Keep discussing</button></div>}
        {error && <div className="pj-error" role="alert">{error}</div>}
        <div className="pj-controls pj-live-controls">
          <div className="pj-main-controls">
            <div className={"pj-live-mic-indicator" + (mode === "listening" ? " is-active" : "")} aria-live="polite"><span className="pj-mic-wave"><i></i><i></i><i></i><i></i><i></i></span><span>{mode === "listening" ? "Listening for your next message" : mode === "speaking" ? "PJ is speaking — your turn starts when PJ finishes" : "PJ is thinking…"}</span></div>
          </div>
          <form className="pj-text-entry" onSubmit={sendText}><textarea ref={inputRef} rows={1} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Type a message…" aria-label="Message PJ Assistant" maxLength={2000} /><button className="pj-send" type="submit" disabled={!draft.trim() || isSending} aria-label="Send message"><ArrowUp size={18} /></button></form>
          <button className="pj-text-toggle" onClick={() => inputRef.current?.focus()}><Sparkles size={14} /> Review and edit your message</button>
        </div>
      </> : <>
        <div className="pj-chat-window pj-chat-window-clean" aria-live="polite" aria-relevant="additions text">
          {messages.map(line => <div key={line.id} className={'pj-chat-message ' + line.role}><span>{line.role === 'user' ? 'You' : 'PJ Assistant'}</span><p>{line.text}</p></div>)}
          {isSending && <div className="pj-chat-message agent pj-chat-thinking"><span>PJ Assistant</span><p>Thinking…</p></div>}
          {isTranscribing && <div className="pj-chat-message agent pj-chat-thinking"><span>PJ Assistant</span><p>Transcribing your voice message…</p></div>}
          <div ref={transcriptEndRef} />
        </div>
        {error && <div className="pj-error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ marginLeft: 8, color: '#ffe2d8', background: 'transparent', border: 0, cursor: 'pointer' }}><X size={12} style={{ display: 'inline' }} /> Dismiss</button>
        </div>}
        <div className="pj-chat-compose">
          <form className="pj-text-entry pj-chat-input-row" onSubmit={sendText}>
            <textarea ref={inputRef} rows={1} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Message PJ Assistant…" aria-label="Message PJ Assistant" maxLength={2000} />
            <button className={'pj-icon-action pj-dictation-button' + (isDictating ? ' is-active' : '')} type="button" onClick={toggleDictation} disabled={isTranscribing || (!isDictating && mode !== 'idle')} aria-label={isDictating ? 'Stop recording' : isTranscribing ? 'Transcribing recording' : 'Record a voice message'} title={isDictating ? 'Recording — tap to finish' : isTranscribing ? 'Transcribing recording' : 'Record a voice message'}>{isDictating ? <MicOff size={17} /> : <Mic size={17} />}</button>
            <button className="pj-icon-action pj-inline-live" type="button" onClick={switchToLive} aria-label="Start Live Talk" title="Start Live Talk"><AudioLines size={18} /></button>
            <button className="pj-send" type="submit" disabled={!draft.trim() || isSending || isTranscribing} aria-label="Send message"><ArrowUp size={18} /></button>
          </form>
          <p className="pj-chat-note">AI assistant · Don't share passwords or payment details.</p>
        </div>
        <footer className="pj-footer"><span>© {new Date().getFullYear()} PJ Web Development</span><span>·</span><button onClick={() => setBookingOpen(true)}>Book a consultation</button></footer>
      </>}
    </section>
    {bookingOpen && <div className="pj-booking-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setBookingOpen(false); }}>
      <section className="pj-booking-panel" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}><div><p style={{ margin: 0, color: '#ffbd82', fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase' }}>Let's build something</p><h2 id="booking-title" style={{ margin: '7px 0', fontSize: 23, letterSpacing: '-.04em' }}>Send Your Project</h2><p style={{ margin: 0, color: '#b7a7a0', fontSize: 12, lineHeight: 1.7 }}>Tell me the essentials. PJ will review your idea and follow up with the next steps.</p></div><button className="pj-quiet-button" onClick={() => setBookingOpen(false)} aria-label="Close project form"><X size={16} /></button></div>
        <form onSubmit={submitBooking} className="pj-project-form" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12, marginTop: 20 }}>
          <div className="pj-form-section-title"><span>01</span><strong>Your details</strong><small>How PJ can reach you</small></div>
          <label>Your name<input value={customerName} onChange={e => setCustomerName(e.target.value)} minLength={2} maxLength={120} required placeholder="Full name" /></label>
          <label>Business or project name<input value={businessName} onChange={e => setBusinessName(e.target.value)} minLength={2} maxLength={160} required placeholder="Business name or project title" /></label>
          <div className="pj-form-section-title"><span>02</span><strong>Project details</strong><small>What you want to build</small></div>
          <label>Project type<select value={businessType} onChange={e => setBusinessType(e.target.value)} required><option value="">Choose a project</option><option>Business website</option><option>Online store</option><option>AI chatbot / assistant</option><option>Web app or dashboard</option><option>Website redesign</option><option>Other digital project</option></select></label>
          <label>Your location<input value={projectLocation} onChange={e => setProjectLocation(e.target.value)} minLength={2} maxLength={120} required placeholder="City or area" /></label>
          <div className="pj-form-section-title"><span>03</span><strong>Consultation</strong><small>Choose a suitable time to discuss it</small></div>
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
