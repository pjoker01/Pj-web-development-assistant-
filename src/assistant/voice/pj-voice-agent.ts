import { sendAssistantMessage, type AssistantHistoryItem } from '../api/assistant-api';

export type PJVoiceAgentOptions = {
  getSessionId: () => string;
  setSessionId: (sessionId: string) => void;
  onEvent: (event: any) => void;
  canContinueWithoutLead?: () => boolean;
  initialHistory?: AssistantHistoryItem[];
};

type SpeechRecognitionResultLike = { isFinal: boolean; [index: number]: { transcript: string } };
type RecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> }) => void) | null;
  onerror: ((event: { error?: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void; stop: () => void; abort?: () => void;
};
type RecognitionConstructor = new () => RecognitionLike;

const greeting = 'Hey, welcome to PJ Web Development. I’m PJ Assistant. What are you looking to build, improve or figure out?';
const cleanForSpeech = (value: string) => value
  .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/^\s*[-*+]\s+/gm, '')
  .replace(/^\s*\d+[.)]\s+/gm, '')
  .replace(/\|/g, ', ')
  .replace(/\*\*|__|[*_~#`]/g, '')
  .replace(/[—–-]{2,}/g, ', ')
  .replace(/\s+-\s+/g, ', ')
  .replace(/\s{2,}/g, ' ')
  .trim();

function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * PJ-owned, browser-native voice loop. Recognition and speech playback are
 * deliberately half-duplex: listen -> think -> speak -> listen. This avoids
 * feeding PJ's own speaker output back into Android's microphone recognizer.
 */
export function createPJVoiceAgent({ getSessionId, setSessionId, onEvent, canContinueWithoutLead, initialHistory }: PJVoiceAgentOptions) {
  let recognition: RecognitionLike | null = null;
  let active = false;
  let destroyed = false;
  let listening = false;
  let speaking = false;
  let thinking = false;
  let restartRequested = false;
  let interim = '';
  let history: AssistantHistoryItem[] = [...(initialHistory || [])].slice(-20);
  let turnController: AbortController | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let talkbackCount = 0;
  const MAX_TALKBACKS = 2;
  const SILENCE_MS = 22000;

  const clearSilenceTimer = () => {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = null;
  };

  const chooseLocalTalkback = () => {
    const context = history.slice(-8).map(item => item.content).join(' ').toLowerCase();
    if (/online store|e-?commerce|product|cart|checkout|payment|shipping/.test(context)) {
      return 'No rush. We can take the store one step at a time. What kind of products are you thinking of selling?';
    }
    if (/website|web site|homepage|pages|design|business site/.test(context)) {
      return 'Take your time. I’m here when you’re ready. What would you most like your website to help your customers do?';
    }
    if (/price|pricing|cost|budget|quote/.test(context)) {
      return 'Just checking in. Would it help if I explained the options and what affects the price?';
    }
    if (/assistant|chatbot|ai chat|automate/.test(context)) {
      return 'I’m still here. What would you like your assistant to help your customers with first?';
    }
    if (/contact|email|phone|whatsapp|name/.test(context)) {
      return 'No pressure. You can carry on whenever you’re ready, and I can help with the next step.';
    }
    return 'Just checking in. Are you still with me, or would you like a moment to think?';
  };

  const scheduleSilenceCheck = () => {
    clearSilenceTimer();
    if (!active || destroyed || talkbackCount >= MAX_TALKBACKS) return;
    silenceTimer = setTimeout(() => {
      silenceTimer = null;
      if (!active || destroyed || speaking || thinking || !listening || talkbackCount >= MAX_TALKBACKS) return;
      talkbackCount += 1;
      stopRecognition();
      speak(chooseLocalTalkback());
    }, SILENCE_MS);
  };

  const emit = (type: string, data: Record<string, unknown> = {}) => onEvent({ type, ...data });
  const state = (value: 'listening' | 'thinking' | 'speaking' | 'idle') => emit('state', { state: value });

  const stopRecognition = () => {
    if (!recognition || !listening) return;
    listening = false;
    try { recognition.stop(); } catch { /* Native recognizer may already be stopped. */ }
  };

  const startRecognition = () => {
    if (!active || destroyed || speaking || thinking || listening || !recognition) return;
    interim = '';
    try {
      recognition.start();
      listening = true;
      state('listening');
      if (!silenceTimer) scheduleSilenceCheck();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The microphone could not start.';
      emit('error', { error: new Error(message) });
    }
  };

  const speak = (rawText: string) => {
    const text = cleanForSpeech(rawText);
    if (!text || !active || destroyed) {
      if (active && !destroyed) startRecognition();
      return;
    }
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      emit('error', { error: new Error('Speech playback is not available in this browser. You can still read PJ’s replies and use the text chat.') });
      startRecognition();
      return;
    }
    speaking = true;
    state('speaking');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-ZA';
    utterance.rate = 0.98;
    utterance.pitch = 0.82;
    const voices = window.speechSynthesis.getVoices();
    // Prefer an explicitly masculine English voice; voice gender metadata is
    // not standardised, so use common masculine voice names as the signal.
    const maleName = /\b(daniel|david|george|james|oliver|ryan|thomas|arthur|alex|fred|aaron|guy|liam|matthew|andrew|mark|tom|lee|rishi|brian|male)\b/i;
    const femaleName = /\b(female|zira|samantha|victoria|karen|susan|hazel|ava|emma|sara|aria|jenny|sonia|libby|natasha)\b/i;
    const english = voices.filter(item => /^en/i.test(item.lang));
    const voice = english.find(item => /^en[-_]ZA/i.test(item.lang) && maleName.test(item.name) && !femaleName.test(item.name))
      || english.find(item => /^en[-_]GB/i.test(item.lang) && maleName.test(item.name) && !femaleName.test(item.name))
      || english.find(item => /^en[-_]US/i.test(item.lang) && maleName.test(item.name) && !femaleName.test(item.name))
      || english.find(item => maleName.test(item.name) && !femaleName.test(item.name))
      || english.find(item => /^en[-_]ZA/i.test(item.lang) && !femaleName.test(item.name))
      || english.find(item => /^en[-_]GB/i.test(item.lang) && !femaleName.test(item.name))
      || english.find(item => !femaleName.test(item.name));
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      speaking = false;
      if (active && !destroyed) startRecognition();
      else state('idle');
    };
    utterance.onerror = () => {
      speaking = false;
      if (active && !destroyed) startRecognition();
      else state('idle');
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const answer = async (incoming: string) => {
    const message = incoming.trim();
    if (!message || !active || destroyed) return false;
    if (canContinueWithoutLead && !canContinueWithoutLead()) {
      emit('lead-required', { message: 'Please add your contact details so PJ can follow up with you.' });
      return false;
    }
    clearSilenceTimer();
    stopRecognition();
    thinking = true;
    state('thinking');
    turnController?.abort();
    const controller = new AbortController();
    turnController = controller;
    try {
      const body = await sendAssistantMessage({
        message: message + "\n\nVoice style: Reply naturally and briefly, in no more than two short sentences unless the visitor asks for detail. Avoid long paragraphs and ask just one useful follow-up question when appropriate.",
        sessionId: getSessionId(),
        history: history.slice(-20),
        signal: controller.signal,
      });
      if (!active || destroyed || controller.signal.aborted) return false;
      if (body.sessionId) setSessionId(body.sessionId);
      const reply = body.reply.trim();
      history = [...history, { role: 'user' as const, content: message }, { role: 'assistant' as const, content: reply }].slice(-20);
      emit('assistant', { text: reply, full: reply });
      thinking = false;
      speak(reply);
      return true;
    } catch (error) {
      if (controller.signal.aborted || !active || destroyed) return false;
      thinking = false;
      emit('error', { error });
      startRecognition();
      return false;
    } finally {
      if (turnController === controller) turnController = null;
    }
  };

  const createRecognition = () => {
    const Constructor = getRecognitionConstructor();
    if (!Constructor) throw new Error('Live Talk needs a browser with built-in speech recognition, such as Chrome on Android. You can still use text chat.');
    const instance = new Constructor();
    instance.lang = 'en-ZA';
    instance.continuous = false;
    instance.interimResults = true;
    instance.maxAlternatives = 1;
    instance.onresult = event => {
      let finalText = '';
      let interimText = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript || '';
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      interim = interimText;
      if (finalText.trim() || interimText.trim()) scheduleSilenceCheck();
      emit('stt', { text: [finalText, interimText].filter(Boolean).join(' ').trim(), turnComplete: Boolean(finalText.trim()) });
      if (finalText.trim()) void answer(finalText.trim());
    };
    instance.onerror = event => {
      listening = false;
      const reason = event.error || 'unknown';
      if (reason === 'no-speech' || reason === 'aborted') {
        if (active && !destroyed && !thinking && !speaking) window.setTimeout(startRecognition, 250);
        return;
      }
      emit('error', { error: new Error(reason === 'not-allowed' || reason === 'service-not-allowed'
        ? 'Microphone permission is blocked. Allow Microphone for assistant.pjwebdev.online in your browser site settings, then start Live Talk again.'
        : 'Speech recognition stopped (' + reason + '). Tap End Live and reconnect, or use text chat.') });
    };
    instance.onend = () => {
      listening = false;
      if (active && !destroyed && !thinking && !speaking) window.setTimeout(startRecognition, 250);
    };
    return instance;
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    active = false;
    listening = false;
    turnController?.abort();
    turnController = null;
    clearSilenceTimer();
    try { recognition?.abort?.(); recognition?.stop(); } catch { /* Already closed. */ }
    recognition = null;
    try { if (typeof window !== 'undefined') window.speechSynthesis?.cancel(); } catch { /* No active utterance. */ }
    speaking = false;
    thinking = false;
    state('idle');
  };

  return {
    async start() {
      if (active || destroyed) return;
      if (typeof window === 'undefined') throw new Error('Live Talk is only available in a browser.');
      if (!('speechSynthesis' in window)) throw new Error('This browser does not support speech playback. Please use Chrome or text chat.');
      recognition = createRecognition();
      active = true;
      // Unlock speech output from the user's tap before any asynchronous work.
      window.speechSynthesis.getVoices();
      window.speechSynthesis.cancel();
      // Recognition intentionally stays stopped during the welcome utterance.
      // speak() restarts it from onend/onerror, preventing startup echo capture.
    },
    destroy,
    notify(message: string) {
      if (!active || destroyed) return Promise.reject(new Error('PJ Live Talk is not active.'));
      if (message === '[PJ_GREETING]') {
        clearSilenceTimer();
        talkbackCount = 0;
        stopRecognition();
        emit('assistant', { text: greeting, full: greeting });
        speak(greeting);
        return Promise.resolve();
      }
      if (message === '[PJ_SILENCE_CHECKIN]') return answer('Based on our conversation so far, gently check in with the visitor. Ask one short, relevant follow-up question. Do not repeat the opening greeting.').then(() => undefined);
      return answer(message).then(() => undefined);
    },
    sendUserText(message: string) {
      if (!active || destroyed) return false;
      void answer(message);
      return true;
    },
  };
}

type VoiceAgentLike = Pick<ReturnType<typeof createPJVoiceAgent>, 'start' | 'destroy' | 'notify' | 'sendUserText'>;
type VoiceAgentFactory = (options: PJVoiceAgentOptions) => VoiceAgentLike;
export type PJVoiceSession = ReturnType<typeof createPJVoiceSession>;

/** Owns the one PJ-native voice session and makes teardown idempotent. */
export function createPJVoiceSession(
  options: PJVoiceAgentOptions,
  agentFactory: VoiceAgentFactory = createPJVoiceAgent,
) {
  const agent = agentFactory(options);
  let started = false;
  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    started = false;
    try { agent.destroy(); } catch { /* Already closed. */ }
  };
  return {
    async start() {
      if (started || destroyed) return;
      started = true;
      try { await agent.start(); }
      catch (error) { destroy(); throw error; }
    },
    destroy,
    notify(message: string) {
      if (!started || destroyed) return Promise.reject(new Error('PJ Live Talk is not active.'));
      return agent.notify(message);
    },
    sendUserText(message: string) {
      if (!started || destroyed) return false;
      return agent.sendUserText(message);
    },
  };
}
