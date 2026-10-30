import { PiperTTS, VoiceAgent, unlockAudio } from '@todoforai/voiceloop';
import { sendAssistantMessage } from '../api/assistant-api';

export type PJVoiceAgentOptions = {
  getSessionId: () => string;
  setSessionId: (sessionId: string) => void;
  onEvent: (event: any) => void;
};

/** Speech profile and platform-backed LLM adapter for PJ Live Talk. */
export function createPJVoiceAgent({ getSessionId, setSessionId, onEvent }: PJVoiceAgentOptions) {
  return new VoiceAgent({
    sttProvider: 'webspeech',
    sttLang: 'en-ZA',
    tts: new PiperTTS('en_US-ryan-high'),
    speed: 1.02,
    bargeInMinChars: 2,
    keyterms: ['PJ Web Development', 'PJ Assistant', 'Pretoria', 'Sunnyside', 'WhatsApp', 'website', 'ecommerce'],
    persona: 'You are PJ Assistant, the official spoken assistant for PJ Web Development. Use a warm, confident, relaxed conversational English delivery. Prefer familiar South African wording where natural, but do not claim or imitate an accent the selected voice model does not provide. Avoid call-centre delivery, robotic phrasing, exaggerated enthusiasm or long monologues. Use contractions and natural pauses. You are an AI assistant; never claim to be human.',
    sysmsg: 'This is a live voice conversation on the public PJ Web Development website. Be conversational and helpful. Answer directly, remember the conversation, and ask one relevant follow-up when useful. Keep spoken answers concise unless the visitor asks for detail.',
    llm: async function* (history: any[], _system: string, signal: AbortSignal) {
      const lastIndex = history.length - 1;
      const last = history[lastIndex];
      const lastContent = typeof last?.content === 'string'
        ? last.content
        : Array.isArray(last?.content)
          ? last.content.filter((part: any) => part?.type === 'text').map((part: any) => part.text || '').join(' ')
          : '';
      const incoming = String(lastContent || '').trim();
      if (!incoming) throw new Error('I did not catch that. Please try again.');
      if (incoming === '[PJ_GREETING]') {
        yield { text: 'Hey, welcome to PJ Web Development. I’m PJ Assistant. What are you looking to build, improve or figure out?' };
        return;
      }

      const isCheckin = incoming === '[PJ_SILENCE_CHECKIN]';
      const message = isCheckin
        ? 'Based on our conversation so far, gently check in with the visitor. Ask one short, relevant follow-up question. Do not repeat the opening greeting.'
        : incoming;
      const priorHistory = history.slice(0, lastIndex).slice(-20).map((item: any) => ({
        role: item.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: typeof item.content === 'string'
          ? item.content
          : Array.isArray(item.content)
            ? item.content.filter((part: any) => part?.type === 'text').map((part: any) => part.text || '').join(' ')
            : '',
      })).filter((item: any) => item.content);

      const body = await sendAssistantMessage({
        message,
        sessionId: getSessionId(),
        history: priorHistory,
        signal,
      });
      if (body.sessionId) setSessionId(body.sessionId);
      yield { text: body.reply.trim() };
    },
    onEvent,
  });
}

type VoiceAgentLike = Pick<VoiceAgent, 'start' | 'destroy' | 'notify' | 'sendUserText'>;
type VoiceAgentFactory = (options: PJVoiceAgentOptions) => VoiceAgentLike;

export type PJVoiceSession = ReturnType<typeof createPJVoiceSession>;

/** Owns the one Live Talk microphone session and makes teardown idempotent. */
export function createPJVoiceSession(
  options: PJVoiceAgentOptions,
  agentFactory: VoiceAgentFactory = createPJVoiceAgent,
  unlockAudioFn: () => void = unlockAudio,
) {
  const agent = agentFactory(options);
  let started = false;
  let destroyed = false;

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    started = false;
    try { agent.destroy(); } catch { /* The underlying agent may already be closed. */ }
  };

  return {
    async start() {
      if (started || destroyed) return;
      // Must execute synchronously in the user's tap before the first await.
      unlockAudioFn();
      started = true;
      try {
        await agent.start();
      } catch (error) {
        destroy();
        throw error;
      }
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
